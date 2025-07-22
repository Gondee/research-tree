import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { inngest } from "@/lib/inngest/client"
import { ActivityLogger } from "@/lib/activity-logger"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; nodeId: string }> }
) {
  try {
    const { id, nodeId } = await params
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get optional parameter to retry all tasks
    const body = await req.json().catch(() => ({}))
    const { retryAll = false } = body

    // Verify ownership
    const node = await prisma.researchNode.findFirst({
      where: { 
        id: nodeId,
        session: {
          id: id,
          userId: session.user.id,
        },
      },
      include: {
        tasks: retryAll ? true : {
          where: {
            status: "failed",
          },
        },
      },
    })

    if (!node) {
      return NextResponse.json(
        { error: "Node not found" },
        { status: 404 }
      )
    }

    // Determine which tasks to retry
    const tasksToRetry = retryAll ? node.tasks : node.tasks.filter((t: any) => t.status === 'failed')
    const taskIds = tasksToRetry.map((t: any) => t.id)

    if (taskIds.length === 0) {
      return NextResponse.json({
        message: "No tasks to retry",
        retriedTasks: 0,
      })
    }

    // Reset tasks based on retry mode
    if (retryAll) {
      // If retrying all, delete any existing generated table to avoid conflicts
      await prisma.generatedTable.deleteMany({
        where: { nodeId: nodeId }
      })
      
      // Reset all tasks to pending
      await prisma.researchTask.updateMany({
        where: {
          nodeId: nodeId,
        },
        data: {
          status: "pending",
          errorMessage: null,
          openaiResponse: null,
          startedAt: null,
          completedAt: null,
          retryCount: {
            increment: 1,
          },
        },
      })
      
      // Log retry for all tasks
      for (const task of tasksToRetry) {
        await ActivityLogger.taskRetry(
          id,
          nodeId,
          task.id,
          task.rowIndex,
          node.level,
          (task.retryCount || 0) + 1
        )
      }
    } else {
      // Reset only failed tasks
      await prisma.researchTask.updateMany({
        where: {
          nodeId: nodeId,
          status: "failed",
        },
        data: {
          status: "pending",
          errorMessage: null,
          retryCount: {
            increment: 1,
          },
        },
      })
      
      // Log retry for failed tasks
      for (const task of tasksToRetry) {
        await ActivityLogger.taskRetry(
          id,
          nodeId,
          task.id,
          task.rowIndex,
          node.level,
          (task.retryCount || 0) + 1
        )
      }
    }

    // Update node status
    await prisma.researchNode.update({
      where: { id: nodeId },
      data: {
        status: "processing",
        errorMessage: null,
        completedAt: null,
      },
    })
    
    // Trigger batch processing for the tasks
    await inngest.send({
      name: "research/batch.created",
      data: {
        nodeId: nodeId,
        tasks: taskIds,
      },
    })

    return NextResponse.json({
      retriedTasks: taskIds.length,
      retryAll: retryAll,
    })
  } catch (error) {
    console.error("Failed to retry tasks:", error)
    return NextResponse.json(
      { error: "Failed to retry tasks" },
      { status: 500 }
    )
  }
}