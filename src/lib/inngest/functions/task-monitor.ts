import { inngest } from "../client"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/activity-logger"

// Monitor long-running tasks and provide progress updates
export const monitorLongRunningTask = inngest.createFunction(
  {
    id: "monitor-long-running-task",
    retries: 1,
  },
  { event: "research/task.monitor" },
  async ({ event, step }) => {
    const { taskId, startTime, checkNumber = 1 } = event.data
    
    // Wait 5 minutes before checking
    await step.sleep("wait-before-check", "5m")
    
    // Check task status
    const task = await step.run("check-task-status", async () => {
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
      return { status: "task_not_found" }
    }
    
    // If task is already completed or failed, stop monitoring
    if (task.status === "completed" || task.status === "failed") {
      return { status: task.status }
    }
    
    // Calculate elapsed time
    const elapsedMinutes = Math.floor(
      (new Date().getTime() - new Date(startTime).getTime()) / 60000
    )
    
    // Update heartbeat and log progress
    await step.run("update-progress", async () => {
      // Update task metadata with heartbeat
      await prisma.researchTask.update({
        where: { id: taskId },
        data: {
          metadata: {
            ...(task.metadata as any || {}),
            lastHeartbeat: new Date().toISOString(),
            elapsedMinutes,
            checkNumber
          }
        }
      })
      
      // Log progress update
      await logActivity({
        sessionId: task.node.session.id,
        nodeId: task.nodeId,
        taskId: task.id,
        level: task.node.level,
        eventType: "task_started", // Using existing event type
        status: "processing",
        message: `Research still in progress (${elapsedMinutes} minutes elapsed)`,
        details: `Check #${checkNumber} - Task is still processing. ${
          task.node.modelId?.includes('deep-research') 
            ? 'Deep research models can take 30-50 minutes.' 
            : 'Standard models typically complete in 5-15 minutes.'
        }`,
        metadata: {
          elapsedMinutes,
          checkNumber
        }
      })
    })
    
    // Schedule next check if still processing and under timeout threshold
    if (elapsedMinutes < 45) { // Stop monitoring after 45 minutes
      await step.sendEvent("schedule-next-check", {
        name: "research/task.monitor",
        data: {
          taskId,
          startTime,
          checkNumber: checkNumber + 1
        }
      })
    }
    
    return { 
      status: "monitoring", 
      elapsedMinutes,
      checkNumber 
    }
  }
)

// Start monitoring when a deep research task begins
export const startTaskMonitoring = inngest.createFunction(
  {
    id: "start-task-monitoring",
    retries: 1,
  },
  { event: "research/task.started" },
  async ({ event, step }) => {
    const { taskId, isDeepResearch } = event.data
    
    // Only monitor deep research tasks or tasks that might take long
    if (!isDeepResearch) {
      return { status: "monitoring_not_needed" }
    }
    
    // Send first monitoring event
    await step.sendEvent("start-monitoring", {
      name: "research/task.monitor",
      data: {
        taskId,
        startTime: new Date().toISOString(),
        checkNumber: 1
      }
    })
    
    return { status: "monitoring_started" }
  }
)