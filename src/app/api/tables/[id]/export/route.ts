import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { stringify } from "csv-stringify/sync"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get table with ownership check
    const table = await prisma.generatedTable.findFirst({
      where: { 
        id: id,
        node: {
          session: {
            userId: session.user.id,
          },
        },
      },
      include: {
        node: {
          select: {
            promptTemplate: true,
            session: {
              select: {
                name: true,
              },
            },
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

    // Convert table data to CSV
    const tableData = table.tableData as any[]
    
    if (!Array.isArray(tableData) || tableData.length === 0) {
      return NextResponse.json(
        { error: "No data to export" },
        { status: 400 }
      )
    }

    // Extract headers from first row
    const headers = Object.keys(tableData[0])
    
    // Generate CSV
    const csv = stringify(tableData, {
      header: true,
      columns: headers,
    })

    // Create filename
    const filename = `research-${table.node.session.name.replace(/[^a-z0-9]/gi, '-')}-${new Date().toISOString().split('T')[0]}.csv`

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error("Failed to export table:", error)
    return NextResponse.json(
      { error: "Failed to export table" },
      { status: 500 }
    )
  }
}