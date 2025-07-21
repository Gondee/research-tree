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

    // Step 5: Check if all tasks for the node are complete
    const allTasksComplete = await step.run("check-node-completion", async () => {
      const incompleteTasks = await prisma.researchTask.count({
        where: {
          nodeId,
          status: { in: ["pending", "processing"] },
        },
      })
      return incompleteTasks === 0
    })

    // Step 6: If all tasks complete, update node status and trigger table generation
    if (allTasksComplete) {
      await step.run("update-node-status", async () => {
        return await prisma.researchNode.update({
          where: { id: nodeId },
          data: {
            status: "completed",
            completedAt: new Date(),
          },
        })
      })
      
      await step.sendEvent("trigger-table-gen", {
        name: "table/generation.requested",
        data: { nodeId },
      })
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
          tableData: tableResult.tableData,
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

    // Trigger individual task processing
    for (let i = 0; i < tasks.length; i++) {
      await step.sendEvent(`trigger-task-${i}`, {
        name: "research/task.created",
        data: { taskId: tasks[i], nodeId },
      })
    }

    return { nodeId, tasksTriggered: tasks.length }
  }
)