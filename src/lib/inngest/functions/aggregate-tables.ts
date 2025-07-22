import { inngest } from "../client"
import { prisma } from "@/lib/prisma"
import { geminiClient } from "@/lib/gemini-client"
import { ActivityLogger, logActivity } from "@/lib/activity-logger"

// This function generates aggregate tables for parent nodes
export const generateAggregateTable = inngest.createFunction(
  {
    id: "generate-aggregate-table",
    retries: 2,
    timeouts: {
      start: "2m",
      finish: "10m",
    },
  },
  { event: "table/aggregate.requested" },
  async ({ event, step }) => {
    const { nodeId } = event.data
    
    console.log(`Aggregate table generation started for parent node ${nodeId}`)
    
    let node: any = null

    try {
      // Step 1: Get node with children and their tables
      node = await step.run("get-node-with-children", async () => {
        return await prisma.researchNode.findUnique({
          where: { id: nodeId },
          include: {
            tasks: true,
            tableConfig: true,
            session: true,
            children: {
              include: {
                generatedTable: true,
                tasks: true,
              }
            }
          },
        })
      })

      if (!node) {
        throw new Error(`Node ${nodeId} not found`)
      }

      // Check if this node has children with generated tables
      const childrenWithTables = node.children?.filter(
        (child: any) => child.generatedTable?.tableData
      ) || []

      if (childrenWithTables.length === 0) {
        console.log(`No child tables to aggregate for node ${nodeId}`)
        return { nodeId, message: "No child tables to aggregate" }
      }

      console.log(`Found ${childrenWithTables.length} child nodes with tables`)

      // Step 2: Extract and combine all child table data
      const combinedTableData = await step.run("combine-child-tables", async () => {
        const allRows: any[] = []
        const tableStructures: any[] = []

        for (const child of childrenWithTables) {
          try {
            const tableData = typeof child.generatedTable.tableData === 'string' 
              ? JSON.parse(child.generatedTable.tableData)
              : child.generatedTable.tableData

            // Extract rows based on different formats
            let rows = []
            if (tableData.tableData && Array.isArray(tableData.tableData)) {
              rows = tableData.tableData
              tableStructures.push({ 
                columns: tableData.columns || Object.keys(rows[0] || {}),
                source: child.id 
              })
            } else if (tableData.data && Array.isArray(tableData.data)) {
              rows = tableData.data
              tableStructures.push({ 
                columns: tableData.columns || Object.keys(rows[0] || {}),
                source: child.id 
              })
            } else if (Array.isArray(tableData)) {
              rows = tableData
              tableStructures.push({ 
                columns: Object.keys(rows[0] || {}),
                source: child.id 
              })
            }

            // Add source node ID to each row for traceability
            rows.forEach((row: any) => {
              allRows.push({
                ...row,
                _sourceNodeId: child.id,
                _sourceLevel: child.level
              })
            })
          } catch (error) {
            console.error(`Error parsing table data from child ${child.id}:`, error)
          }
        }

        return { allRows, tableStructures }
      })

      // Step 3: Generate aggregate table using Gemini
      const aggregatePrompt = node.tableConfig?.geminiPrompt || 
        `Create an aggregate summary table from the following ${combinedTableData.allRows.length} rows of data collected from ${childrenWithTables.length} research branches. 
         Identify patterns, group similar items, and create a comprehensive overview.
         Include summary statistics where appropriate.`

      const aggregateResult = await step.run("generate-aggregate-table", async () => {
        await ActivityLogger.tableGenerationStarted(
          node.session.id,
          node.id,
          node.level
        )

        // For aggregate tables, we might want to pass additional context
        const context = [
          `This is an aggregate table combining data from ${childrenWithTables.length} child research nodes.`,
          `Total rows to aggregate: ${combinedTableData.allRows.length}`,
          `Table structures found: ${JSON.stringify(combinedTableData.tableStructures)}`,
          `Combined data: ${JSON.stringify(combinedTableData.allRows)}`
        ]

        return await geminiClient.generateTable({
          prompt: aggregatePrompt,
          context: context,
        })
      })

      // Step 4: Save aggregate table
      await step.run("save-aggregate-table", async () => {
        // Check if table already exists
        const existingTable = await prisma.generatedTable.findUnique({
          where: { nodeId: nodeId }
        })

        if (existingTable) {
          // Update existing table
          return await prisma.generatedTable.update({
            where: { nodeId: nodeId },
            data: {
              tableData: {
                ...aggregateResult,
                _metadata: {
                  isAggregate: true,
                  sourceNodeCount: childrenWithTables.length,
                  totalRowsAggregated: combinedTableData.allRows.length,
                  generatedAt: new Date().toISOString()
                }
              },
              version: existingTable.version + 1,
            },
          })
        } else {
          // Create new table
          return await prisma.generatedTable.create({
            data: {
              nodeId,
              tableConfigId: node.tableConfig?.id,
              tableData: {
                ...aggregateResult,
                _metadata: {
                  isAggregate: true,
                  sourceNodeCount: childrenWithTables.length,
                  totalRowsAggregated: combinedTableData.allRows.length,
                  generatedAt: new Date().toISOString()
                }
              },
            },
          })
        }
      })

      // Step 5: Log completion
      await step.run("log-aggregate-completion", async () => {
        await ActivityLogger.tableGenerated(
          node.session.id,
          node.id,
          node.level,
          combinedTableData.allRows.length
        )

        await logActivity({
          sessionId: node.session.id,
          nodeId: node.id,
          level: node.level,
          eventType: "table_generated",
          message: `Aggregate table generated from ${childrenWithTables.length} child nodes`,
          details: `Aggregated ${combinedTableData.allRows.length} total rows`,
        })
      })

      return { 
        nodeId, 
        aggregateTableGenerated: true,
        sourceNodes: childrenWithTables.length,
        totalRows: combinedTableData.allRows.length
      }
    } catch (error) {
      console.error(`Aggregate table generation failed for node ${nodeId}:`, error)
      
      // Update node status to indicate aggregate failure
      await step.run("log-aggregate-failure", async () => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        if (node?.session?.id) {
          await ActivityLogger.tableGenerationFailed(
            node.session.id,
            nodeId,
            node.level,
            `Aggregate table generation failed: ${errorMessage}`
          )
        }
      })
      
      throw error
    }
  }
)

// Function to trigger aggregate table generation when all children complete
export const checkAndGenerateAggregateTable = inngest.createFunction(
  {
    id: "check-generate-aggregate-table",
    retries: 1,
  },
  { event: "node/children.completed" },
  async ({ event, step }) => {
    const { parentNodeId } = event.data

    // Check if all children have completed
    const allChildrenComplete = await step.run("check-children-completion", async () => {
      const parent = await prisma.researchNode.findUnique({
        where: { id: parentNodeId },
        include: {
          children: {
            select: {
              id: true,
              status: true,
              generatedTable: true,
            }
          }
        }
      })

      if (!parent || !parent.children || parent.children.length === 0) {
        return false
      }

      // Check if all children are completed and have tables
      const allComplete = parent.children.every(
        child => child.status === 'completed' && child.generatedTable
      )

      return { allComplete, childCount: parent.children.length }
    })

    if (allChildrenComplete && typeof allChildrenComplete === 'object' && allChildrenComplete.allComplete) {
      console.log(`All ${allChildrenComplete.childCount} children completed for parent ${parentNodeId}, triggering aggregate table generation`)
      
      // Trigger aggregate table generation
      await step.sendEvent("trigger-aggregate-table", {
        name: "table/aggregate.requested",
        data: { nodeId: parentNodeId },
      })
    }

    return { 
      parentNodeId, 
      triggered: allChildrenComplete && typeof allChildrenComplete === 'object' 
        ? allChildrenComplete.allComplete 
        : false 
    }
  }
)