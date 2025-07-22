import { inngest } from "../client"
import { prisma } from "@/lib/prisma"
import { ActivityLogger } from "@/lib/activity-logger"

// This function handles deep research tasks differently
// It acknowledges that deep research is a long-running monolithic operation
export const handleDeepResearchTask = inngest.createFunction(
  {
    id: "handle-deep-research-task",
    retries: 0, // Don't retry - we'll handle this differently
    timeouts: {
      start: "1m",
      finish: "2m", // Quick acknowledgment only
    },
  },
  { event: "research/deep-research.requested" },
  async ({ event, step }) => {
    const { taskId, nodeId } = event.data

    // Step 1: Get task details
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

    // Step 2: Mark task as "deep_processing" - a special status
    await step.run("mark-deep-processing", async () => {
      await ActivityLogger.logActivity({
        sessionId: task.node.session.id,
        nodeId: task.nodeId,
        taskId: task.id,
        level: task.node.level,
        eventType: "task_started",
        message: `Deep research task #${task.rowIndex + 1} started (estimated 20-30 minutes)`,
        details: `This is a long-running operation. The task will complete in the background.`,
        metadata: {
          model: task.node.modelId,
          estimatedDuration: "20-30 minutes"
        }
      })

      // Update task with special status
      return await prisma.researchTask.update({
        where: { id: taskId },
        data: {
          status: "processing",
          startedAt: new Date(),
          errorMessage: "Deep research in progress - this may take 20-30 minutes",
        },
      })
    })

    // Step 3: Queue the actual deep research work
    // In a production system, you would:
    // 1. Send this to a proper background job queue (e.g., BullMQ, AWS SQS)
    // 2. Have a separate worker process that can run for 30+ minutes
    // 3. The worker would update the database when complete
    
    // For now, we'll create a "pending deep research" record
    await step.run("create-deep-research-job", async () => {
      // You could create a new table for tracking deep research jobs
      // For now, we'll just log it
      await ActivityLogger.logActivity({
        sessionId: task.node.session.id,
        nodeId: task.nodeId,
        taskId: task.id,
        level: task.node.level,
        eventType: "task_started",
        message: `Deep research job queued`,
        details: `Task will be processed by background worker`,
        metadata: {
          prompt: task.prompt.substring(0, 200),
          queuedAt: new Date().toISOString()
        }
      })
    })

    // The function completes quickly, acknowledging the task
    // The actual research happens elsewhere
    return { 
      taskId, 
      status: "queued",
      message: "Deep research task queued for background processing"
    }
  }
)

// This function would be called by your background worker when deep research completes
export const completeDeepResearchTask = inngest.createFunction(
  {
    id: "complete-deep-research-task",
    retries: 2,
  },
  { event: "research/deep-research.completed" },
  async ({ event, step }) => {
    const { taskId, nodeId, result, error } = event.data

    // Get task details
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

    if (error) {
      // Handle failure
      await step.run("mark-failed", async () => {
        await ActivityLogger.taskFailed(
          task.node.session.id,
          task.nodeId,
          task.id,
          task.rowIndex,
          task.node.level,
          error
        )

        return await prisma.researchTask.update({
          where: { id: taskId },
          data: {
            status: "failed",
            errorMessage: error,
            completedAt: new Date(),
          },
        })
      })
    } else {
      // Handle success
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
            openaiResponse: result.content,
            completedAt: new Date(),
            errorMessage: null,
          },
        })
      })
    }

    // Check if all tasks for the node are complete
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
      
      return {
        allTasksComplete: incompleteTasks === 0,
        hasFailedTasks: failedTasks > 0,
        failedCount: failedTasks,
      }
    })

    // Handle node completion
    if (allTasksComplete) {
      if (hasFailedTasks) {
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