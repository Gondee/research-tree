import { inngest } from "../client"
import { prisma } from "@/lib/prisma"
import { deepResearchClient } from "@/lib/openai-deep-research"
import { ActivityLogger, logActivity } from "@/lib/activity-logger"

// Process deep research tasks with proper background mode and polling
export const processDeepResearchTask = inngest.createFunction(
  {
    id: "process-deep-research-task",
    retries: 3,
  },
  { event: "research/deep-research.created" },
  async ({ event, step }) => {
    const { taskId, nodeId } = event.data
    console.log(`[DEEP-RESEARCH] Handler triggered!`)
    console.log(`[DEEP-RESEARCH] Task ID: ${taskId}`)
    console.log(`[DEEP-RESEARCH] Node ID: ${nodeId}`)

    // Step 1: Get task details with node info
    const task = await step.run("get-task", async () => {
      return await prisma.researchTask.findUnique({
        where: { id: taskId },
        include: {
          node: {
            include: {
              session: true
            }
          }
        }
      })
    })

    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }

    // Step 2: Update task status to processing
    await step.run("update-status-processing", async () => {
      await ActivityLogger.taskStarted(
        task.node.session.id,
        task.nodeId,
        task.id,
        task.rowIndex,
        task.node.level
      )
      
      await logActivity({
        sessionId: task.node.session.id,
        nodeId: task.nodeId,
        taskId: task.id,
        level: task.node.level,
        eventType: "task_started",
        message: `⚠️ Deep research started - this may take 5-30 minutes`,
        details: `Using ${task.node.modelId}. Deep research runs in background mode with web search capabilities.`,
      })
      
      return await prisma.researchTask.update({
        where: { id: taskId },
        data: {
          status: "processing",
          startedAt: new Date(),
          metadata: {
            lastHeartbeat: new Date().toISOString(),
            expectedDuration: '5-30 minutes',
            processingMode: 'background'
          }
        },
      })
    })

    let deepResearchTaskId: string

    try {
      // Step 3: Start deep research in background mode
      const startResult = await step.run("start-deep-research", async () => {
        console.log(`Starting deep research for model: ${task.node.modelId}`)
        const response = await deepResearchClient.startDeepResearch({
          prompt: task.prompt,
          model: task.node.modelId || 'gpt-4o',
          includeSources: true,
        })
        
        // Store the OpenAI task ID in metadata
        await prisma.researchTask.update({
          where: { id: taskId },
          data: {
            metadata: {
              ...(task.metadata as any || {}),
              openaiTaskId: response.id,
              openaiStatus: response.status,
              lastChecked: new Date().toISOString()
            }
          }
        })
        
        return { deepResearchTaskId: response.id }
      })

      deepResearchTaskId = startResult.deepResearchTaskId

      // Step 4: Poll for completion - Each poll is a separate step to avoid timeouts
      const maxPollingAttempts = 60 // 30 minutes with 30s intervals
      let finalResponse = null
      
      for (let attempt = 0; attempt < maxPollingAttempts; attempt++) {
        // Wait before checking (except first attempt)
        if (attempt > 0) {
          await step.sleep(`poll-wait-${attempt}`, "30s")
        }

        // Check status in a separate step (this resets the timeout)
        const status = await step.run(`check-status-${attempt}`, async () => {
          console.log(`[DEEP-RESEARCH] Checking status attempt ${attempt + 1}/${maxPollingAttempts}`)
          
          try {
            const response = await deepResearchClient.checkDeepResearchStatus(deepResearchTaskId)
            
            // Update metadata with latest status
            await prisma.researchTask.update({
              where: { id: taskId },
              data: {
                metadata: {
                  ...(task.metadata as any || {}),
                  openaiTaskId: deepResearchTaskId,
                  openaiStatus: response.status,
                  lastChecked: new Date().toISOString(),
                  pollAttempt: attempt + 1
                }
              }
            })
            
            // Log progress every 5 attempts (2.5 minutes)
            if (attempt % 5 === 0 && attempt > 0) {
              await logActivity({
                sessionId: task.node.session.id,
                nodeId: task.nodeId,
                taskId: task.id,
                level: task.node.level,
                eventType: "task_started",
                status: "processing",
                message: `Deep research in progress (${Math.floor(attempt * 0.5)} minutes elapsed)`,
                details: `Status: ${response.status}. Deep research is analyzing multiple sources...`,
                metadata: {
                  elapsedMinutes: Math.floor(attempt * 0.5),
                  checkNumber: attempt + 1
                }
              })
            }
            
            return response
          } catch (error) {
            console.error(`[DEEP-RESEARCH] Status check failed at attempt ${attempt + 1}:`, error)
            // Don't fail immediately on status check errors
            if (attempt < 5) {
              // Early in the process, the task might not be ready yet
              return { status: 'in_progress' }
            }
            throw error
          }
        })

        if (status.status === 'completed') {
          finalResponse = status
          break
        } else if (status.status === 'failed') {
          throw new Error(status.error || 'Deep research task failed')
        }
      }

      if (!finalResponse) {
        throw new Error('Deep research timed out after maximum polling attempts')
      }

      // Step 5: Extract and save results
      await step.run("save-results", async () => {
        const { content, sources, reasoning } = deepResearchClient.extractResearchContent(finalResponse)
        
        // Format the response with sources
        let formattedContent = content
        if (sources.length > 0) {
          formattedContent += '\n\n## Sources\n'
          sources.forEach((source, index) => {
            formattedContent += `\n${index + 1}. [${source.title}](${source.url})\n   ${source.snippet}\n`
          })
        }
        
        await ActivityLogger.taskCompleted(
          task.node.session.id,
          task.nodeId,
          task.id,
          task.rowIndex,
          task.node.level
        )
        
        return await prisma.researchTask.update({
          where: { id: taskId },
          data: {
            status: "completed",
            openaiResponse: formattedContent,
            completedAt: new Date(),
            metadata: {
              ...(task.metadata as any || {}),
              openaiTaskId: deepResearchTaskId,
              sourceCount: sources.length,
              hasReasoning: !!reasoning,
              completedAt: new Date().toISOString()
            }
          },
        })
      })

      // Step 6: Check if all tasks for the node are complete
      await step.run("check-node-completion", async () => {
        const [incompleteTasks, failedTasks] = await Promise.all([
          prisma.researchTask.count({
            where: {
              nodeId,
              status: { in: ["pending", "processing"] },
            },
          }),
          prisma.researchTask.count({
            where: {
              nodeId,
              status: "failed",
            },
          }),
        ])
        
        if (incompleteTasks === 0) {
          if (failedTasks > 0) {
            await prisma.researchNode.update({
              where: { id: nodeId },
              data: {
                status: "failed",
                completedAt: new Date(),
                errorMessage: `${failedTasks} task(s) failed during processing`,
              },
            })
          } else {
            // Trigger table generation
            await step.sendEvent("trigger-table-gen", {
              name: "table/generation.requested",
              data: { nodeId },
            })
          }
        }
      })

      return { taskId, status: "completed", deepResearchTaskId }
      
    } catch (error) {
      // Handle errors with better logging
      console.error('[DEEP-RESEARCH] Error occurred:', error)
      console.error('[DEEP-RESEARCH] Error type:', typeof error)
      console.error('[DEEP-RESEARCH] Error details:', JSON.stringify(error, null, 2))
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : typeof error === 'string' 
        ? error 
        : JSON.stringify(error)
      
      await step.run("handle-error", async () => {
        await ActivityLogger.taskFailed(
          task.node.session.id,
          task.nodeId,
          task.id,
          task.rowIndex,
          task.node.level,
          errorMessage
        )
        
        // Update task with error and any deep research task ID we might have
        await prisma.researchTask.update({
          where: { id: taskId },
          data: {
            status: "failed",
            errorMessage: errorMessage,
            completedAt: new Date(),
            metadata: {
              ...(task.metadata as any || {}),
              openaiTaskId: deepResearchTaskId || null,
              failureReason: 'deep_research_error',
              errorDetails: JSON.stringify(error)
            }
          },
        })
      })
      
      // Always throw a proper Error instance
      throw new Error(errorMessage)
    }
  }
)