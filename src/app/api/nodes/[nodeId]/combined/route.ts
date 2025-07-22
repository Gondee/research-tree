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

    // Get the node with its children
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
        generatedTable: true,
        children: {
          include: {
            tasks: {
              orderBy: {
                rowIndex: 'asc'
              }
            },
            generatedTable: true,
          }
        }
      }
    })

    if (!node) {
      return NextResponse.json(
        { error: "Node not found" },
        { status: 404 }
      )
    }

    // If the node has children, combine their data
    if (node.children && node.children.length > 0) {
      // Combine all tasks from child nodes
      const allTasks = node.children.flatMap(child => child.tasks || [])
      
      // Combine all generated tables from child nodes
      const childTables = node.children
        .filter(child => child.generatedTable?.tableData)
        .map(child => {
          try {
            const tableData = typeof child.generatedTable!.tableData === 'string' 
              ? JSON.parse(child.generatedTable!.tableData as string)
              : child.generatedTable!.tableData
            
            // Extract rows from various formats
            if (tableData.tableData && Array.isArray(tableData.tableData)) {
              return tableData.tableData
            } else if (tableData.data && Array.isArray(tableData.data)) {
              return tableData.data
            } else if (Array.isArray(tableData)) {
              return tableData
            }
            return []
          } catch (error) {
            console.error('Error parsing child table data:', error)
            return []
          }
        })
        .flat()

      // Create a combined view
      const combinedData = {
        ...node,
        isCombined: true,
        childCount: node.children.length,
        // Override tasks with combined tasks from children
        tasks: allTasks,
        // Create a combined table if children have tables
        generatedTable: childTables.length > 0 ? {
          tableData: {
            columns: childTables.length > 0 && childTables[0] 
              ? Object.keys(childTables[0]) 
              : [],
            tableData: childTables,
            combined: true,
            sourceNodes: node.children.length
          }
        } : node.generatedTable,
        // Keep original node data available
        originalNodeData: {
          tasks: node.tasks,
          generatedTable: node.generatedTable
        }
      }

      return NextResponse.json(combinedData)
    }

    // If no children, return the node as-is
    return NextResponse.json({
      ...node,
      isCombined: false,
      childCount: 0
    })
  } catch (error) {
    console.error("Failed to fetch combined node data:", error)
    return NextResponse.json(
      { error: "Failed to fetch combined node data" },
      { status: 500 }
    )
  }
}