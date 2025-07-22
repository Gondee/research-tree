import { prisma } from "@/lib/prisma"

export type ActivityEventType = 
  | "task_created" 
  | "task_started" 
  | "task_completed" 
  | "task_failed" 
  | "task_retry"
  | "node_created"
  | "node_started"
  | "node_completed"
  | "node_failed"
  | "table_generation_started"
  | "table_generated"
  | "table_generation_failed"
  | "session_created"
  | "session_completed"
  | "error"

interface LogActivityParams {
  sessionId: string
  nodeId?: string
  taskId?: string
  level?: number
  eventType: ActivityEventType
  status?: string
  message: string
  details?: string
  metadata?: any
}

export async function logActivity(params: LogActivityParams) {
  try {
    return await prisma.activityLog.create({
      data: {
        sessionId: params.sessionId,
        nodeId: params.nodeId,
        taskId: params.taskId,
        level: params.level || 0,
        eventType: params.eventType,
        status: params.status,
        message: params.message,
        details: params.details,
        metadata: params.metadata,
      },
    })
  } catch (error) {
    console.error("Failed to log activity:", error)
    // Don't throw - we don't want logging failures to break the main flow
  }
}

// Helper functions for common activity types
export const ActivityLogger = {
  taskCreated: (sessionId: string, nodeId: string, taskId: string, taskIndex: number, prompt: string) =>
    logActivity({
      sessionId,
      nodeId,
      taskId,
      eventType: "task_created",
      message: `Task #${taskIndex + 1} created`,
      details: prompt.substring(0, 200) + (prompt.length > 200 ? '...' : ''),
    }),

  taskStarted: (sessionId: string, nodeId: string, taskId: string, taskIndex: number, level: number) =>
    logActivity({
      sessionId,
      nodeId,
      taskId,
      level,
      eventType: "task_started",
      status: "processing",
      message: `Task #${taskIndex + 1} started processing`,
    }),

  taskCompleted: (sessionId: string, nodeId: string, taskId: string, taskIndex: number, level: number) =>
    logActivity({
      sessionId,
      nodeId,
      taskId,
      level,
      eventType: "task_completed",
      status: "completed",
      message: `Task #${taskIndex + 1} completed successfully`,
    }),

  taskFailed: (sessionId: string, nodeId: string, taskId: string, taskIndex: number, level: number, error: string) =>
    logActivity({
      sessionId,
      nodeId,
      taskId,
      level,
      eventType: "task_failed",
      status: "failed",
      message: `Task #${taskIndex + 1} failed`,
      details: error,
    }),

  taskRetry: (sessionId: string, nodeId: string, taskId: string, taskIndex: number, level: number, retryCount: number) =>
    logActivity({
      sessionId,
      nodeId,
      taskId,
      level,
      eventType: "task_retry",
      status: "pending",
      message: `Task #${taskIndex + 1} queued for retry (attempt ${retryCount})`,
    }),

  nodeCreated: (sessionId: string, nodeId: string, level: number, promptTemplate: string) =>
    logActivity({
      sessionId,
      nodeId,
      level,
      eventType: "node_created",
      message: `Level ${level} research node created`,
      details: promptTemplate.substring(0, 200) + (promptTemplate.length > 200 ? '...' : ''),
    }),

  nodeStarted: (sessionId: string, nodeId: string, level: number, taskCount: number) =>
    logActivity({
      sessionId,
      nodeId,
      level,
      eventType: "node_started",
      status: "processing",
      message: `Level ${level} research started with ${taskCount} tasks`,
    }),

  nodeCompleted: (sessionId: string, nodeId: string, level: number, taskCount: number) =>
    logActivity({
      sessionId,
      nodeId,
      level,
      eventType: "node_completed",
      status: "completed",
      message: `Level ${level} research completed (${taskCount} tasks)`,
    }),

  nodeFailed: (sessionId: string, nodeId: string, level: number, failedCount: number, error?: string) =>
    logActivity({
      sessionId,
      nodeId,
      level,
      eventType: "node_failed",
      status: "failed",
      message: `Level ${level} research failed (${failedCount} tasks failed)`,
      details: error,
    }),

  tableGenerationStarted: (sessionId: string, nodeId: string, level: number) =>
    logActivity({
      sessionId,
      nodeId,
      level,
      eventType: "table_generation_started",
      message: `Table generation started for level ${level}`,
    }),

  tableGenerated: (sessionId: string, nodeId: string, level: number, rowCount?: number) =>
    logActivity({
      sessionId,
      nodeId,
      level,
      eventType: "table_generated",
      message: `Table generated for level ${level}${rowCount ? ` with ${rowCount} rows` : ''}`,
    }),

  tableGenerationFailed: (sessionId: string, nodeId: string, level: number, error: string) =>
    logActivity({
      sessionId,
      nodeId,
      level,
      eventType: "table_generation_failed",
      message: `Table generation failed for level ${level}`,
      details: error,
    }),

  sessionCreated: (sessionId: string, name: string, description?: string) =>
    logActivity({
      sessionId,
      eventType: "session_created",
      message: `Research session "${name}" created`,
      details: description,
    }),

  error: (sessionId: string, message: string, error: any, metadata?: any) =>
    logActivity({
      sessionId,
      eventType: "error",
      message,
      details: error?.message || String(error),
      metadata: { ...metadata, error: error?.stack },
    }),
}