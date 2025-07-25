import { inngest } from "../client"
import { prisma } from "@/lib/prisma"
import { openAIClient } from "@/lib/openai-client"
import { geminiClient } from "@/lib/gemini-client"
import { ActivityLogger, logActivity } from "@/lib/activity-logger"

export const processResearchTask = inngest.createFunction(
  {
    id: "process-research-task",
    retries: 3,
    throttle: {
      limit: 10,
      period: "60s",
    },
    timeouts: {
      start: "5m",     // Allow 5 minutes to start  
      finish: "55m",   // Reduced to 55 minutes to avoid platform timeouts
    },
  },
  { event: "research/task.created" },
  async ({ event, step }) => {
    const { taskId, nodeId } = event.data

    // Step 1: Get task details with node info
    const task = await step.run("get-task", async () => {
      return await prisma.researchTask.findUnique({
        where: { id: taskId },
        include: {
          node: {
            include: {
              session: true
            }
          }
        }
      })
    })

    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }
    
    // Check if this is a deep research task - if so, skip it
    // The deep research handler will process this
    if (task.node.modelId?.includes('deep-research')) {
      console.log(`[RESEARCH] Skipping deep research task ${taskId} - should be handled by processDeepResearchTask`)
      return { taskId, status: "skipped", reason: "deep-research-model" }
    }

    // Step 2: Update task status to processing
    await step.run("update-status-processing", async () => {
      await ActivityLogger.taskStarted(
        task.node.session.id,
        task.nodeId,
        task.id,
        task.rowIndex,
        task.node.level
      )
      
      // Log warning for reasoning/deep research models
      const isReasoningModel = task.node.modelId && (
        task.node.modelId.includes('o1') || 
        task.node.modelId.includes('o3') || 
        task.node.modelId.includes('o4') || 
        task.node.modelId.includes('deep-research')
      )
      
      if (isReasoningModel) {
        await logActivity({
          sessionId: task.node.session.id,
          nodeId: task.nodeId,
          taskId: task.id,
          level: task.node.level,
          eventType: "task_started",
          message: `⚠️ Reasoning model detected - this may take 30-50 minutes`,
          details: `Using ${task.node.modelId}. Note: Very long research tasks may timeout. Consider breaking complex queries into smaller parts.`,
        })
      }
      
      return await prisma.researchTask.update({
        where: { id: taskId },
        data: {
          status: "processing",
          startedAt: new Date(),
          metadata: {
            lastHeartbeat: new Date().toISOString(),
            expectedDuration: task.node.modelId?.includes('deep-research') ? '30-50 minutes' : '5-15 minutes'
          }
        },
      })
    })
    
    // Step 2.5: Start monitoring for reasoning/deep research tasks
    const isReasoningModel = task.node.modelId && (
      task.node.modelId.includes('o1') || 
      task.node.modelId.includes('o3') || 
      task.node.modelId.includes('o4') || 
      task.node.modelId.includes('deep-research')
    )
    
    if (isReasoningModel) {
      await step.sendEvent("start-monitoring", {
        name: "research/task.started",
        data: { 
          taskId, 
          isDeepResearch: true 
        },
      })
    }

    // Step 3: Call OpenAI Deep Research
    const researchResult = await step.run("call-openai", async () => {
      try {
        // For reasoning models, use a more conservative timeout
        const isReasoningModel = task.node.modelId && (
          task.node.modelId.includes('o1') || 
          task.node.modelId.includes('o3') || 
          task.node.modelId.includes('o4') || 
          task.node.modelId.includes('deep-research')
        )
        
        // Log the model being used
        console.log(`Processing task with model: ${task.node.modelId}`)
        
        const maxTime = isReasoningModel ? 3000 : 1800 // 50 minutes for reasoning, 30 for others
        
        return await openAIClient.deepResearch({
          prompt: task.prompt,
          maxTime: maxTime,
          includeSources: true,
          model: task.node.modelId || 'gpt-4o',
        })
      } catch (error: any) {
        // Check if this is a timeout error
        const isTimeout = error?.message?.includes('timeout') || 
                         error?.message?.includes('FUNCTION_INVOCATION_TIMEOUT') ||
                         error?.code === 'ECONNABORTED' ||
                         error?.code === 'ETIMEDOUT'
        
        // Update task with error
        const errorMessage = isTimeout 
          ? `Request timed out. Deep research models may exceed Inngest's practical timeout limits. Consider breaking down your research into smaller, more focused queries.`
          : error instanceof Error ? error.message : "Unknown error"
        
        await ActivityLogger.taskFailed(
          task.node.session.id,
          task.nodeId,
          task.id,
          task.rowIndex,
          task.node.level,
          errorMessage
        )
        
        await prisma.researchTask.update({
          where: { id: taskId },
          data: {
            status: "failed",
            errorMessage: errorMessage,
            completedAt: new Date(),
          },
        })
        
        // Check if this was the last task for the node
        const remainingTasks = await prisma.researchTask.count({
          where: {
            nodeId,
            status: { in: ["pending", "processing"] },
            id: { not: taskId }, // Exclude current task
          },
        })
        
        // If no more pending tasks, update node status
        if (remainingTasks === 0) {
          const failedTaskCount = await prisma.researchTask.count({
            where: {
              nodeId,
              status: "failed",
            },
          })
          
          await prisma.researchNode.update({
            where: { id: nodeId },
            data: {
              status: "failed",
              completedAt: new Date(),
              errorMessage: `${failedTaskCount} task(s) failed during processing`,
            },
          })
        }
        
        throw error
      }
    })

    // Step 4: Save research results
    await step.run("save-results", async () => {
      await ActivityLogger.taskCompleted(
        task.node.session.id,
        task.nodeId,
        task.id,
        task.rowIndex,
        task.node.level
      )
      
      return await prisma.researchTask.update({
        where: { id: taskId },
        data: {
          status: "completed",
          openaiResponse: researchResult.content,
          completedAt: new Date(),
        },
      })
    })

    // Step 5: Check if all tasks for the node are complete or failed
    const { allTasksComplete, hasFailedTasks, failedCount } = await step.run("check-node-completion", async () => {
      const [incompleteTasks, failedTasks, totalTasks] = await Promise.all([
        prisma.researchTask.count({
          where: {
            nodeId,
            status: { in: ["pending", "processing"] },
          },
        }),
        prisma.researchTask.count({
          where: {
            nodeId,
            status: "failed",
          },
        }),
        prisma.researchTask.count({
          where: { nodeId },
        }),
      ])
      
      console.log(`Node ${nodeId}: ${incompleteTasks} incomplete, ${failedTasks} failed, ${totalTasks} total`)
      return {
        allTasksComplete: incompleteTasks === 0,
        hasFailedTasks: failedTasks > 0,
        failedCount: failedTasks,
      }
    })

    // Step 6: Handle completion or failure
    if (allTasksComplete) {
      if (hasFailedTasks) {
        console.log(`Node ${nodeId} has ${failedCount} failed tasks, marking as partially failed`)
        
        // Update node status to failed
        await step.run("update-node-failed", async () => {
          await ActivityLogger.nodeFailed(
            task.node.session.id,
            nodeId,
            task.node.level,
            failedCount
          )
          
          return await prisma.researchNode.update({
            where: { id: nodeId },
            data: {
              status: "failed",
              completedAt: new Date(),
              errorMessage: `${failedCount} task(s) failed during processing`,
            },
          })
        })
      } else {
        console.log(`All tasks complete for node ${nodeId}, triggering table generation`)
        
        // All tasks succeeded - trigger table generation
        await step.sendEvent("trigger-table-gen", {
          name: "table/generation.requested",
          data: { nodeId },
        })
        
        // Also check if parent needs aggregate table
        const nodeWithParent = await step.run("get-node-parent", async () => {
          return await prisma.researchNode.findUnique({
            where: { id: nodeId },
            select: { parentId: true }
          })
        })
        
        if (nodeWithParent?.parentId) {
          await step.sendEvent("check-parent-completion", {
            name: "node/children.completed",
            data: { parentNodeId: nodeWithParent.parentId },
          })
        }
      }
    } else {
      console.log(`Not all tasks complete for node ${nodeId}, waiting...`)
    }

    return { taskId, status: "completed" }
  }
)

export const generateTable = inngest.createFunction(
  {
    id: "generate-table",
    retries: 2,
    timeouts: {
      start: "2m",
      finish: "30m",  // Increased for large table generation
    },
  },
  { event: "table/generation.requested" },
  async ({ event, step }) => {
    const { nodeId } = event.data
    
    console.log(`Table generation started for node ${nodeId}`)
    
    let node: any = null

    try {
      // Step 1: Get node and its configuration
      node = await step.run("get-node", async () => {
        return await prisma.researchNode.findUnique({
          where: { id: nodeId },
          include: {
            tasks: true,
            tableConfig: true,
            session: true,
          },
        })
      })

      if (!node || !node.tableConfig) {
        throw new Error(`Node ${nodeId} or table config not found`)
      }
      
      console.log(`Found ${node.tasks.length} tasks for node ${nodeId}`)

    // Step 2: Collect all research outputs with parent row data
    const researchOutputs = await step.run("collect-outputs", async () => {
      return node.tasks
        .filter((task: any) => task.status === "completed" && task.openaiResponse)
        .map((task: any) => ({
          research: task.openaiResponse!,
          parentRowData: task.parentRowData,
          rowIndex: task.rowIndex
        }))
    })

    // Step 3: Generate table using Gemini
    const tableResult = await step.run("generate-table", async () => {
      await ActivityLogger.tableGenerationStarted(
        node.session.id,
        node.id,
        node.level
      )
      
      // Prepare context with parent row data
      const contextWithLineage = researchOutputs.map((output: any) => {
        if (output.parentRowData) {
          return `Parent Row Data: ${JSON.stringify(output.parentRowData)}\n\nResearch Output:\n${output.research}`
        }
        return output.research
      })
      
      // Calculate total context size
      const totalContextSize = contextWithLineage.reduce((sum: number, ctx: string) => sum + ctx.length, 0)
      console.log(`Total context size for table generation: ${totalContextSize} characters, ${contextWithLineage.length} reports`)
      
      // If context is too large, batch the processing
      const MAX_CONTEXT_SIZE = 500000 // ~500KB of text (increased for Gemini 2.5 Flash)
      if (totalContextSize > MAX_CONTEXT_SIZE && contextWithLineage.length > 10) {
        console.log(`Context too large (${totalContextSize} chars), processing in batches`)
        
        // Process in smaller batches
        const batchSize = Math.max(3, Math.floor(contextWithLineage.length / Math.ceil(totalContextSize / MAX_CONTEXT_SIZE)))
        const results = await geminiClient.processLargeContext(
          node.tableConfig!.geminiPrompt + 
            (researchOutputs.some((o: any) => o.parentRowData) 
              ? "\n\nIMPORTANT: Include the parent row properties in the output table. Each row should preserve the original properties that were used in the research prompt."
              : ""),
          contextWithLineage,
          batchSize
        )
        
        // Return the merged result
        return results[0]
      }
      
      const enhancedPrompt = node.tableConfig!.geminiPrompt + 
        (researchOutputs.some((o: any) => o.parentRowData) 
          ? "\n\nIMPORTANT: Include the parent row properties in the output table. Each row should preserve the original properties that were used in the research prompt."
          : "")
      
      return await geminiClient.generateTable({
        prompt: enhancedPrompt,
        context: contextWithLineage,
      })
    })

    // Step 4: Save generated table
    await step.run("save-table", async () => {
      return await prisma.generatedTable.create({
        data: {
          nodeId,
          tableConfigId: node.tableConfig!.id,
          tableData: tableResult, // Save the entire result including columns
        },
      })
    })

    // Step 5: Update node status
    await step.run("update-node-status", async () => {
      // Count rows in generated table
      let rowCount = 0
      try {
        const parsedTable = typeof tableResult === 'string' ? JSON.parse(tableResult) : tableResult
        if (parsedTable.tableData && Array.isArray(parsedTable.tableData)) {
          rowCount = parsedTable.tableData.length
        } else if (parsedTable.data && Array.isArray(parsedTable.data)) {
          rowCount = parsedTable.data.length
        } else if (Array.isArray(parsedTable)) {
          rowCount = parsedTable.length
        }
      } catch (e) {
        // Ignore parsing errors
      }
      
      await ActivityLogger.tableGenerated(
        node.session.id,
        node.id,
        node.level,
        rowCount
      )
      
      await ActivityLogger.nodeCompleted(
        node.session.id,
        node.id,
        node.level,
        node.tasks.length
      )
      
      return await prisma.researchNode.update({
        where: { id: nodeId },
        data: {
          status: "completed",
          completedAt: new Date(),
        },
      })
    })

      return { nodeId, tableGenerated: true }
    } catch (error) {
      console.error(`Table generation failed for node ${nodeId}:`, error)
      
      // Update node status to failed
      await step.run("update-node-failed-table-gen", async () => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        if (node?.session?.id) {
          await ActivityLogger.tableGenerationFailed(
            node.session.id,
            nodeId,
            node.level,
            errorMessage
          )
        }
        
        return await prisma.researchNode.update({
          where: { id: nodeId },
          data: {
            status: "failed",
            completedAt: new Date(),
            errorMessage: `Table generation failed: ${errorMessage}`,
          },
        })
      })
      
      throw error
    }
  }
)

export const batchProcessResearch = inngest.createFunction(
  {
    id: "batch-process-research",
    concurrency: {
      limit: 5,
    },
    timeouts: {
      start: "5m",
      finish: "55m",   // Reduced to avoid platform timeouts
    },
  },
  { event: "research/batch.created" },
  async ({ event, step }) => {
    const { nodeId, tasks } = event.data
    
    console.log(`Batch processing ${tasks.length} tasks for node ${nodeId}`)
    
    // Get the node to check the model being used
    const node = await step.run("get-node-model", async () => {
      return await prisma.researchNode.findUnique({
        where: { id: nodeId },
        select: { 
          modelId: true,
          sessionId: true,
          level: true 
        }
      })
    })
    
    // Check if using reasoning models (o1, o3) which have stricter rate limits
    const isReasoningModel = node?.modelId && (
      node.modelId.includes('o1') || 
      node.modelId.includes('o3') || 
      node.modelId.includes('deep-research')
    )
    const isDeepResearch = node?.modelId && node.modelId.includes('deep-research')
    
    console.log(`Node ${nodeId} model details:`, {
      modelId: node?.modelId,
      isReasoningModel,
      isDeepResearch,
      eventName: isDeepResearch ? 'research/deep-research.created' : 'research/task.created'
    })
    
    if (isReasoningModel) {
      console.log(`Using reasoning model (${node.modelId}) with stricter API rate limits. Processing with delays.`)
    }

    // Update node status
    await step.run("update-node-processing", async () => {
      if (node) {
        await ActivityLogger.nodeStarted(
          node.sessionId,
          nodeId,
          node.level,
          tasks.length
        )
      }
      
      return await prisma.researchNode.update({
        where: { id: nodeId },
        data: {
          status: "processing",
          startedAt: new Date(),
        },
      })
    })

    // Trigger tasks with rate limit considerations
    if (isReasoningModel && tasks.length > 5) {
      // Reasoning models have lower RPM limits (25-50 RPM for o3-mini)
      console.log(`Reasoning model detected. Processing ${tasks.length} tasks in batches to respect API rate limits`)
      
      const batchSize = 3 // Process 3 at a time for reasoning models
      for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize)
        const eventName = node?.modelId?.includes('deep-research') ? "research/deep-research.created" : "research/task.created"
        console.log(`[BATCH] Sending event ${eventName} for tasks in batch (model: ${node?.modelId})`)
        console.log(`[BATCH] Event data:`, { taskId: batch[0], nodeId })
        
        const batchPromises = batch.map((taskId: string, batchIndex: number) => {
          console.log(`[BATCH] Sending event ${i + batchIndex}: ${eventName} with taskId: ${taskId}`)
          return step.sendEvent(`trigger-task-${i + batchIndex}`, {
            name: eventName,
            data: { taskId, nodeId },
          })
        })
        
        await Promise.all(batchPromises)
        
        // Add delay between batches to respect RPM limits (e.g., 25-50 RPM for o3-mini)
        if (i + batchSize < tasks.length) {
          await step.sleep("batch-delay-" + i, "15s") // 15 second delay = ~12-15 requests/minute
        }
      }
    } else {
      // Standard models can handle more parallel requests
      console.log(`Triggering ${tasks.length} research tasks in parallel`)
      
      const eventName = node?.modelId?.includes('deep-research') ? "research/deep-research.created" : "research/task.created"
      console.log(`[BATCH] Sending event ${eventName} for all tasks (model: ${node?.modelId})`)
      console.log(`[BATCH] Task IDs:`, tasks)
      
      const eventPromises = tasks.map((taskId: string, index: number) => {
        console.log(`[BATCH] Sending event ${index}: ${eventName} with taskId: ${taskId}`)
        return step.sendEvent(`trigger-task-${index}`, {
          name: eventName,
          data: { taskId, nodeId },
        })
      })
      
      await Promise.all(eventPromises)
    }
    
    console.log(`All ${tasks.length} task events sent`)

    return { nodeId, tasksTriggered: tasks.length }
  }
)