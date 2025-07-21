import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { inngest } from "@/lib/inngest/client"

export async function POST(
  req: Request,
  { params }: { params: { id: string; nodeId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify ownership
    const node = await prisma.researchNode.findFirst({
      where: { 
        id: params.nodeId,
        session: {
          id: params.id,
          userId: session.user.id,
        },
      },
      include: {
        tasks: {
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

    // Reset failed tasks
    await prisma.researchTask.updateMany({
      where: {
        nodeId: params.nodeId,
        status: "failed",
      },
      data: {
        status: "pending",
        retryCount: {
          increment: 1,
        },
      },
    })

    // Update node status
    await prisma.researchNode.update({
      where: { id: params.nodeId },
      data: {
        status: "processing",
      },
    })

    // Retrigger processing for failed tasks
    const failedTaskIds = node.tasks.map(t => t.id)
    
    if (failedTaskIds.length > 0) {
      await inngest.send({
        name: "research/batch.created",
        data: {
          nodeId: params.nodeId,
          tasks: failedTaskIds,
        },
      })
    }

    return NextResponse.json({
      retriedTasks: failedTaskIds.length,
    })
  } catch (error) {
    console.error("Failed to retry tasks:", error)
    return NextResponse.json(
      { error: "Failed to retry tasks" },
      { status: 500 }
    )
  }
}