const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugParentData() {
  try {
    // Find a few tasks with parentRowData
    const tasksWithParentData = await prisma.researchTask.findMany({
      where: {
        parentRowData: {
          not: null
        }
      },
      take: 5,
      select: {
        id: true,
        nodeId: true,
        rowIndex: true,
        parentRowData: true,
        status: true,
        node: {
          select: {
            id: true,
            promptTemplate: true,
            level: true
          }
        }
      }
    });

    console.log('=== Tasks with parentRowData ===');
    console.log(JSON.stringify(tasksWithParentData, null, 2));

    // Now check if these tasks' nodes have children with generated tables
    for (const task of tasksWithParentData) {
      const nodeWithChildren = await prisma.researchNode.findUnique({
        where: { id: task.nodeId },
        include: {
          children: {
            include: {
              generatedTable: {
                select: {
                  id: true,
                  createdAt: true
                }
              },
              tasks: {
                select: {
                  id: true,
                  rowIndex: true,
                  parentRowData: true
                }
              }
            }
          }
        }
      });

      if (nodeWithChildren?.children?.length > 0) {
        console.log(`\n=== Node ${task.nodeId} has ${nodeWithChildren.children.length} children ===`);
        
        for (const child of nodeWithChildren.children) {
          console.log(`Child ${child.id}:`);
          console.log(`  - Has generated table: ${!!child.generatedTable}`);
          console.log(`  - Number of tasks: ${child.tasks.length}`);
          console.log(`  - Tasks with parentRowData: ${child.tasks.filter(t => t.parentRowData).length}`);
          
          // Show first task with parentRowData
          const taskWithData = child.tasks.find(t => t.parentRowData);
          if (taskWithData) {
            console.log(`  - Sample parentRowData:`, JSON.stringify(taskWithData.parentRowData, null, 2));
          }
        }
      }
    }

    // Check a specific node's combined view
    const recentNode = await prisma.researchNode.findFirst({
      where: {
        children: {
          some: {
            generatedTable: {
              isNot: null
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      include: {
        children: {
          include: {
            tasks: true,
            generatedTable: true
          }
        }
      }
    });

    if (recentNode) {
      console.log(`\n=== Recent parent node with child tables: ${recentNode.id} ===`);
      console.log(`Node prompt: ${recentNode.promptTemplate.substring(0, 50)}...`);
      console.log(`Children: ${recentNode.children.length}`);
      
      for (const child of recentNode.children) {
        if (child.generatedTable) {
          console.log(`\nChild ${child.id} table data sample:`);
          const tableData = typeof child.generatedTable.tableData === 'string' 
            ? JSON.parse(child.generatedTable.tableData)
            : child.generatedTable.tableData;
          
          // Show structure
          if (tableData.tableData && Array.isArray(tableData.tableData)) {
            console.log(`  - Rows in table: ${tableData.tableData.length}`);
            console.log(`  - First row keys:`, Object.keys(tableData.tableData[0] || {}));
          }
          
          // Check if tasks have parent data
          const tasksWithParent = child.tasks.filter(t => t.parentRowData);
          console.log(`  - Tasks with parentRowData: ${tasksWithParent.length}/${child.tasks.length}`);
        }
      }
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugParentData();