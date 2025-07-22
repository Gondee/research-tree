import { inngest } from "../client"
import { prisma } from "@/lib/prisma"
import { openAIClient } from "@/lib/openai-client"
import { geminiClient } from "@/lib/gemini-client"

export const processResearchTask = inngest.createFunction(
  {
    id: "process-research-task",
    retries: 3,
    throttle: {
      limit: 10,
      period: "60s",
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
          node: true
        }
      })
    })

    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }

    // Step 2: Update task status to processing
    await step.run("update-status-processing", async () => {
      return await prisma.researchTask.update({
        where: { id: taskId },
        data: {
          status: "processing",
          startedAt: new Date(),
        },
      })
    })

    // Step 3: Call OpenAI Deep Research
    const researchResult = await step.run("call-openai", async () => {
      try {
        return await openAIClient.deepResearch({
          prompt: task.prompt,
          maxTime: 1200, // 20 minutes
          includeSources: true,
          model: task.node.modelId || 'gpt-4o',
        })
      } catch (error) {
        // Update task with error
        await prisma.researchTask.update({
          where: { id: taskId },
          data: {
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
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
  },
  { event: "table/generation.requested" },
  async ({ event, step }) => {
    const { nodeId } = event.data
    
    console.log(`Table generation started for node ${nodeId}`)

    try {
      // Step 1: Get node and its configuration
      const node = await step.run("get-node", async () => {
        return await prisma.researchNode.findUnique({
          where: { id: nodeId },
          include: {
            tasks: true,
            tableConfig: true,
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
          tableData: tableResult, // Save the entire result including columns
        },
      })
    })

    // Step 5: Update node status
    await step.run("update-node-status", async () => {
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
        return await prisma.researchNode.update({
          where: { id: nodeId },
          data: {
            status: "failed",
            completedAt: new Date(),
            errorMessage: `Table generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
  },
  { event: "research/batch.created" },
  async ({ event, step }) => {
    const { nodeId, tasks } = event.data
    
    console.log(`Batch processing ${tasks.length} tasks for node ${nodeId}`)
    
    // Get the node to check the model being used
    const node = await step.run("get-node-model", async () => {
      return await prisma.researchNode.findUnique({
        where: { id: nodeId },
        select: { modelId: true }
      })
    })
    
    // Check if using reasoning models (o1, o3) which have stricter rate limits
    const isReasoningModel = node?.modelId && (
      node.modelId.includes('o1') || 
      node.modelId.includes('o3') || 
      node.modelId.includes('deep-research')
    )
    if (isReasoningModel) {
      console.log(`Using reasoning model (${node.modelId}) with stricter API rate limits. Processing with delays.`)
    }

    // Update node status
    await step.run("update-node-processing", async () => {
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
            name: "research/task.created",
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
          name: "research/task.created",
          data: { taskId, nodeId },
        })
      )
      
      await Promise.all(eventPromises)
    }
    
    console.log(`All ${tasks.length} task events sent`)

    return { nodeId, tasksTriggered: tasks.length }
  }
)