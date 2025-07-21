import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Verify session ownership
  const researchSession = await prisma.researchSession.findFirst({
    where: { 
      id: id,
      userId: session.user.id,
    },
  })

  if (!researchSession) {
    return NextResponse.json(
      { error: "Session not found" },
      { status: 404 }
    )
  }

  // Create SSE response
  const encoder = new TextEncoder()
  const stream = new TransformStream()
  const writer = stream.writable.getWriter()

  // Send progress updates
  const sendProgress = async () => {
    try {
      while (true) {
        // Get all nodes with their task progress
        const nodes = await prisma.researchNode.findMany({
          where: { 
            sessionId: id,
            status: { in: ["processing", "pending"] },
          },
          include: {
            tasks: {
              select: {
                id: true,
                status: true,
                startedAt: true,
                completedAt: true,
              },
            },
          },
        })

        for (const node of nodes) {
          const totalTasks = node.tasks.length
          const completedTasks = node.tasks.filter((t: any) => t.status === "completed").length
          const failedTasks = node.tasks.filter((t: any) => t.status === "failed").length

          const progress = {
            nodeId: node.id,
            totalTasks,
            completedTasks,
            failedTasks,
            tasks: node.tasks.map((t: any) => ({
              id: t.id,
              status: t.status,
              duration: t.completedAt && t.startedAt 
                ? Math.floor((t.completedAt.getTime() - t.startedAt.getTime()) / 1000)
                : undefined,
            })),
          }

          const data = `data: ${JSON.stringify(progress)}\n\n`
          await writer.write(encoder.encode(data))
        }

        // Check if all nodes are complete
        const activeNodes = await prisma.researchNode.count({
          where: { 
            sessionId: id,
            status: { in: ["processing", "pending"] },
          },
        })

        if (activeNodes === 0) {
          await writer.write(encoder.encode(`data: {"complete": true}\n\n`))
          break
        }

        // Wait 2 seconds before next update
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    } catch (error) {
      console.error("SSE error:", error)
    } finally {
      await writer.close()
    }
  }

  // Start sending progress in background
  sendProgress()

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}