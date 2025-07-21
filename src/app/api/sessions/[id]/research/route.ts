import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { inngest } from "@/lib/inngest/client"

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { parentNodeId, promptTemplate, dataSource } = await req.json()

    // Verify session ownership
    const researchSession = await prisma.researchSession.findFirst({
      where: { 
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!researchSession) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      )
    }

    // Get parent node level if exists
    let level = 0
    if (parentNodeId) {
      const parentNode = await prisma.researchNode.findUnique({
        where: { id: parentNodeId },
      })
      if (parentNode) {
        level = parentNode.level + 1
      }
    }

    // Create research node
    const node = await prisma.researchNode.create({
      data: {
        sessionId: params.id,
        parentId: parentNodeId,
        promptTemplate,
        level,
        status: "pending",
      },
    })

    // Create table config
    await prisma.tableConfig.create({
      data: {
        nodeId: node.id,
        geminiPrompt: "Extract structured data from the research reports",
        inputData: {},
      },
    })

    // Generate tasks based on data source
    let tasks: any[] = []
    
    if (dataSource?.tableId) {
      // Get table data
      const sourceTable = await prisma.generatedTable.findUnique({
        where: { id: dataSource.tableId },
      })

      if (sourceTable && sourceTable.tableData) {
        const rows = sourceTable.tableData as any[]
        
        // Create a task for each row
        tasks = await Promise.all(
          rows.map(async (row, index) => {
            // Replace template variables with row data
            let prompt = promptTemplate
            dataSource.columns.forEach((col: string) => {
              prompt = prompt.replace(new RegExp(`{${col}}`, 'g'), row[col] || '')
            })

            return prisma.researchTask.create({
              data: {
                nodeId: node.id,
                rowIndex: index,
                prompt,
                status: "pending",
              },
            })
          })
        )
      }
    } else {
      // Single task with the template as-is
      const task = await prisma.researchTask.create({
        data: {
          nodeId: node.id,
          rowIndex: 0,
          prompt: promptTemplate,
          status: "pending",
        },
      })
      tasks = [task]
    }

    // Trigger background processing
    await inngest.send({
      name: "research/batch.created",
      data: {
        nodeId: node.id,
        tasks: tasks.map(t => t.id),
      },
    })

    return NextResponse.json({
      nodeId: node.id,
      tasksCreated: tasks.length,
      estimatedDuration: `${Math.ceil(tasks.length * 2)}-${Math.ceil(tasks.length * 3)} minutes`,
    })
  } catch (error) {
    console.error("Failed to start research:", error)
    return NextResponse.json(
      { error: "Failed to start research" },
      { status: 500 }
    )
  }
}