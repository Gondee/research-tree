import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ nodeId: string }> }
) {
  try {
    const { nodeId } = await params
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get node with tasks and generated table
    const node = await prisma.researchNode.findFirst({
      where: { 
        id: nodeId,
        session: {
          userId: session.user.id
        }
      },
      include: {
        tasks: {
          orderBy: {
            rowIndex: 'asc'
          }
        },
        generatedTable: true
      }
    })

    if (!node) {
      return NextResponse.json(
        { error: "Node not found" },
        { status: 404 }
      )
    }

    return NextResponse.json(node)
  } catch (error) {
    console.error("Failed to fetch node:", error)
    return NextResponse.json(
      { error: "Failed to fetch node" },
      { status: 500 }
    )
  }
}