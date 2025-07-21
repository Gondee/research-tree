import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { inngest } from "@/lib/inngest/client"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const { nodeId } = await params
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { geminiPrompt } = await req.json()

    if (!geminiPrompt) {
      return NextResponse.json(
        { error: "Gemini prompt is required" },
        { status: 400 }
      )
    }

    // Verify ownership and get node
    const node = await prisma.researchNode.findFirst({
      where: { 
        id: nodeId,
        session: {
          userId: session.user.id,
        },
      },
      include: {
        tasks: {
          where: {
            status: "completed",
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

    // Update table config
    await prisma.tableConfig.update({
      where: { nodeId: nodeId },
      data: {
        geminiPrompt,
      },
    })

    // Trigger table generation
    await inngest.send({
      name: "table/generation.requested",
      data: {
        nodeId: nodeId,
      },
    })

    return NextResponse.json({
      message: "Table generation started",
    })
  } catch (error) {
    console.error("Failed to generate table:", error)
    return NextResponse.json(
      { error: "Failed to generate table" },
      { status: 500 }
    )
  }
}