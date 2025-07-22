import { inngest } from "../client"
import { prisma } from "@/lib/prisma"
import { openAIClient } from "@/lib/openai-client"
import { geminiClient } from "@/lib/gemini-client"
import { ActivityLogger, logActivity } from "@/lib/activity-logger"

// Main function with proper timeout configuration
export const processResearchTaskV2 = inngest.createFunction(
  {
    id: "process-research-task-v2",
    retries: 3,
    throttle: {
      limit: 10,
      period: "60s",
    },
    timeouts: {
      start: "5m",    // Allow 5 minutes in queue
      finish: "30m",  // Total 30 minutes execution time
    },
  },
  { event: "research/task.created.v2" },
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

    // Check if this is a deep research model that might take long
    const isDeepResearch = task.node.modelId?.includes('deep-research')
    const maxPollingAttempts = isDeepResearch ? 60 : 10 // 30 min vs 5 min
    const pollInterval = "30s"

    // Step 2: Update task status to processing
    await step.run("update-status-processing", async () => {
      await ActivityLogger.taskStarted(
        task.node.session.id,
        task.nodeId,
        task.id,
        task.rowIndex,
        task.node.level
      )
      
      return await prisma.researchTask.update({
        where: { id: taskId },
        data: {
          status: "processing",
          startedAt: new Date(),
        },
      })
    })

    try {
      // Step 3: Start the research (non-blocking for deep research)
      if (isDeepResearch) {
        // For deep research, we'll use a different approach
        // Start the research and get a job ID or similar
        await step.run("start-deep-research", async () => {
          await logActivity({
            sessionId: task.node.session.id,
            nodeId: task.nodeId,
            taskId: task.id,
            eventType: "task_started",
            message: `Deep research task #${task.rowIndex + 1} started (may take up to 30 minutes)`,
            details: `Model: ${task.node.modelId}`,
          })
          
          // Store metadata that we're doing deep research
          await prisma.researchTask.update({
            where: { id: taskId },
            data: {
              status: "processing",
              errorMessage: null, // Clear any previous errors
            },
          })
        })

        // Step 4: Poll for completion
        let attempts = 0
        let researchResult = null
        let lastError = null

        while (attempts < maxPollingAttempts && !researchResult) {
          // Wait before checking
          if (attempts > 0) {
            await step.sleep(`poll-wait-${attempts}`, pollInterval)
          }

          // Try to get the research result
          const attemptResult = await step.run(`poll-research-${attempts}`, async () => {
            try {
              // For now, we'll do the actual API call here
              // In a production system, you might want to use a job queue
              const result = await openAIClient.deepResearch({
                prompt: task.prompt,
                maxTime: 1200, // 20 minutes
                includeSources: true,
                model: task.node.modelId || 'gpt-4o',
              })
              
              return { success: true, data: result }
            } catch (error) {
              // If it's a timeout or rate limit, we might want to retry
              const errorMessage = error instanceof Error ? error.message : "Unknown error"
              console.log(`Attempt ${attempts + 1} failed: ${errorMessage}`)
              
              // Check if this is a retryable error
              if (errorMessage.includes('timeout') || errorMessage.includes('429')) {
                return { success: false, error: errorMessage, retry: true }
              }
              
              // Non-retryable error
              return { success: false, error: errorMessage, retry: false }
            }
          })

          if (attemptResult.success && 'data' in attemptResult) {
            researchResult = attemptResult.data
            break
          } else if ('retry' in attemptResult && !attemptResult.retry) {
            // Non-retryable error, fail immediately
            lastError = 'error' in attemptResult ? attemptResult.error : 'Unknown error'
            break
          }

          lastError = 'error' in attemptResult ? attemptResult.error : 'Unknown error'
          attempts++
          
          // Log progress
          if (attempts % 5 === 0) {
            await step.run(`log-progress-${attempts}`, async () => {
              await logActivity({
                sessionId: task.node.session.id,
                nodeId: task.nodeId,
                taskId: task.id,
                eventType: "task_started",
                message: `Deep research task #${task.rowIndex + 1} still processing (${attempts * 30}s elapsed)`,
              })
            })
          }
        }

        if (!researchResult) {
          throw new Error(lastError || "Deep research timed out after maximum attempts")
        }

        // Step 5: Save results
        await step.run("save-deep-research-results", async () => {
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

      } else {
        // Regular research (non-deep) - use the original approach
        const researchResult = await step.run("call-openai-standard", async () => {
          return await openAIClient.deepResearch({
            prompt: task.prompt,
            maxTime: 300, // 5 minutes for standard models
            includeSources: true,
            model: task.node.modelId || 'gpt-4o',
          })
        })

        // Save results
        await step.run("save-standard-results", async () => {
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
      }
    } catch (error) {
      // Handle errors
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      
      await step.run("handle-error", async () => {
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
      })
      
      // Check if this was the last task for the node
      const remainingTasks = await step.run("check-remaining-tasks", async () => {
        return await prisma.researchTask.count({
          where: {
            nodeId,
            status: { in: ["pending", "processing"] },
            id: { not: taskId },
          },
        })
      })
      
      // If no more pending tasks, update node status
      if (remainingTasks === 0) {
        const failedTaskCount = await step.run("count-failed-tasks", async () => {
          return await prisma.researchTask.count({
            where: {
              nodeId,
              status: "failed",
            },
          })
        })
        
        await step.run("update-node-failed", async () => {
          await ActivityLogger.nodeFailed(
            task.node.session.id,
            nodeId,
            task.node.level,
            failedTaskCount
          )
          
          return await prisma.researchNode.update({
            where: { id: nodeId },
            data: {
              status: "failed",
              completedAt: new Date(),
              errorMessage: `${failedTaskCount} task(s) failed during processing`,
            },
          })
        })
      }
      
      throw error
    }

    // Step 6: Check if all tasks for the node are complete
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

    // Step 7: Handle completion or failure
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
      }
    }

    return { taskId, status: "completed" }
  }
)

// Keep the existing functions but export them with V2 suffix
export const generateTableV2 = inngest.createFunction(
  {
    id: "generate-table-v2",
    retries: 2,
    timeouts: {
      start: "2m",
      finish: "10m",
    },
  },
  { event: "table/generation.requested.v2" },
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

      // Step 2: Collect all research outputs
      const researchOutputs = await step.run("collect-outputs", async () => {
        return node.tasks
          .filter((task: any) => task.status === "completed" && task.openaiResponse)
          .map((task: any) => task.openaiResponse!)
      })

      // Step 3: Generate table using Gemini
      const tableResult = await step.run("generate-table", async () => {
        await ActivityLogger.tableGenerationStarted(
          node.session.id,
          node.id,
          node.level
        )
        
        return await geminiClient.generateTable({
          prompt: node.tableConfig!.geminiPrompt,
          context: researchOutputs,
        })
      })

      // Step 4: Save generated table
      await step.run("save-table", async () => {
        return await prisma.generatedTable.create({
          data: {
            nodeId,
            tableConfigId: node.tableConfig!.id,
            tableData: tableResult,
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

export const batchProcessResearchV2 = inngest.createFunction(
  {
    id: "batch-process-research-v2",
    concurrency: {
      limit: 5,
    },
    timeouts: {
      start: "5m",
      finish: "2h", // Allow up to 2 hours for batch processing
    },
  },
  { event: "research/batch.created.v2" },
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
        const batchPromises = batch.map((taskId: string, batchIndex: number) => 
          step.sendEvent(`trigger-task-${i + batchIndex}`, {
            name: "research/task.created.v2",
            data: { taskId, nodeId },
          })
        )
        
        await Promise.all(batchPromises)
        
        // Add delay between batches to respect RPM limits (e.g., 25-50 RPM for o3-mini)
        if (i + batchSize < tasks.length) {
          await step.sleep("batch-delay-" + i, "15s") // 15 second delay = ~12-15 requests/minute
        }
      }
    } else {
      // Standard models can handle more parallel requests
      console.log(`Triggering ${tasks.length} research tasks in parallel`)
      
      const eventPromises = tasks.map((taskId: string, index: number) => 
        step.sendEvent(`trigger-task-${index}`, {
          name: "research/task.created.v2",
          data: { taskId, nodeId },
        })
      )
      
      await Promise.all(eventPromises)
    }
    
    console.log(`All ${tasks.length} task events sent`)

    return { nodeId, tasksTriggered: tasks.length }
  }
)