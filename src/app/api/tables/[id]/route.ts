import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { tableData } = await req.json()

    // Verify ownership
    const table = await prisma.generatedTable.findFirst({
      where: { 
        id: id,
        node: {
          session: {
            userId: session.user.id,
          },
        },
      },
    })

    if (!table) {
      return NextResponse.json(
        { error: "Table not found" },
        { status: 404 }
      )
    }

    // Update table
    const updatedTable = await prisma.generatedTable.update({
      where: { id: id },
      data: {
        tableData,
        edited: true,
        version: {
          increment: 1,
        },
      },
    })

    return NextResponse.json(updatedTable)
  } catch (error) {
    console.error("Failed to update table:", error)
    return NextResponse.json(
      { error: "Failed to update table" },
      { status: 500 }
    )
  }
}