import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(
  req: Request,
  { params }: { params: { id: string; nodeId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const node = await prisma.researchNode.findFirst({
      where: { 
        id: params.nodeId,
        session: {
          id: params.id,
          userId: session.user.id,
        },
      },
      include: {
        tasks: true,
        tableConfig: true,
        generatedTable: true,
        children: {
          include: {
            tasks: {
              select: {
                id: true,
                status: true,
              },
            },
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

    return NextResponse.json(node)
  } catch (error) {
    console.error("Failed to fetch node:", error)
    return NextResponse.json(
      { error: "Failed to fetch node" },
      { status: 500 }
    )
  }
}