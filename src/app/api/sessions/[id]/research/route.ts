import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { inngest } from "@/lib/inngest/client"

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { parentNodeId, promptTemplate, dataSource, modelId = 'gpt-4o', geminiPrompt } = await req.json()

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
        sessionId: id,
        parentId: parentNodeId,
        promptTemplate,
        modelId,
        level,
        status: "pending",
      },
    })

    // Create table config
    await prisma.tableConfig.create({
      data: {
        nodeId: node.id,
        geminiPrompt: geminiPrompt || "Extract structured data from the research reports",
        inputData: dataSource || {},
      },
    })

    // Generate tasks based on data source
    let tasks: any[] = []
    
    if (dataSource === 'table' && parentNodeId) {
      // Get parent node's generated table
      const parentNode = await prisma.researchNode.findUnique({
        where: { id: parentNodeId },
        include: { generatedTable: true }
      })

      if (parentNode?.generatedTable?.tableData) {
        // Parse table data
        const tableData = typeof parentNode.generatedTable.tableData === 'string'
          ? JSON.parse(parentNode.generatedTable.tableData as string)
          : parentNode.generatedTable.tableData
        
        // Extract rows from the table data
        console.log('Parent table data structure:', tableData)
        const rows = tableData.tableData || tableData.data || tableData // Handle Gemini format, alternative format, or simple array
        
        if (Array.isArray(rows)) {
          console.log(`Creating ${rows.length} tasks for table rows`)
          // Create a task for each row
          tasks = await Promise.all(
            rows.map(async (row, index) => {
              // Replace template variables with row data
              let prompt = promptTemplate
              
              // Replace variables in format {{columnName}}
              Object.keys(row).forEach((key) => {
                const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g')
                prompt = prompt.replace(regex, row[key] || '')
              })
              
              console.log(`Task ${index}: ${prompt.substring(0, 100)}...`)

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
        } else {
          console.log('No rows found in parent table data')
        }
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