'use client'

import React from 'react'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useResearchStore } from '@/stores/research-store'
import { formatDuration } from '@/lib/utils'
import { CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react'

interface ProgressTrackerProps {
  nodeId: string
  compact?: boolean
}

export function ProgressTracker({ nodeId, compact = false }: ProgressTrackerProps) {
  const { activeSession, updateProgress } = useResearchStore()
  const [startTime] = React.useState(Date.now())
  const [elapsedTime, setElapsedTime] = React.useState(0)

  // Find the node in the session
  const findNode = React.useCallback((nodes: any[], targetId: string): any => {
    for (const node of nodes) {
      if (node.id === targetId) return node
      if (node.children) {
        const found = findNode(node.children, targetId)
        if (found) return found
      }
    }
    return null
  }, [])

  const node = React.useMemo(() => {
    if (!activeSession?.nodes) return null
    return findNode(activeSession.nodes, nodeId)
  }, [activeSession, nodeId, findNode])

  // Update elapsed time
  React.useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    return () => clearInterval(interval)
  }, [startTime])

  // Subscribe to SSE progress updates
  React.useEffect(() => {
    if (!activeSession?.id || !node || node.status === 'completed') return

    const eventSource = new EventSource(`/api/sessions/${activeSession.id}/progress`)

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data)
      
      if (data.nodeId === nodeId) {
        updateProgress(nodeId, data)
      }
      
      if (data.complete) {
        eventSource.close()
      }
    }

    eventSource.onerror = () => {
      console.error('SSE connection error')
      eventSource.close()
    }

    return () => {
      eventSource.close()
    }
  }, [activeSession?.id, nodeId, node?.status, updateProgress])

  if (!node || !node.tasks) return null

  const totalTasks = node.tasks.length
  const completedTasks = node.tasks.filter((t: any) => t.status === 'completed').length
  const failedTasks = node.tasks.filter((t: any) => t.status === 'failed').length
  const processingTasks = node.tasks.filter((t: any) => t.status === 'processing').length
  const progress = (completedTasks / totalTasks) * 100

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {completedTasks}/{totalTasks} tasks
          </span>
          <span className="text-muted-foreground">
            {formatDuration(elapsedTime)}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
        {failedTasks > 0 && (
          <p className="text-xs text-red-500">{failedTasks} tasks failed</p>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Research Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Overall Progress
            </span>
            <span className="text-sm text-muted-foreground">
              {completedTasks}/{totalTasks} tasks
            </span>
          </div>
          <Progress value={progress} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">Status</p>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span>{completedTasks}</span>
              </div>
              {processingTasks > 0 && (
                <div className="flex items-center gap-1">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span>{processingTasks}</span>
                </div>
              )}
              {failedTasks > 0 && (
                <div className="flex items-center gap-1">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span>{failedTasks}</span>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">Time Elapsed</p>
            <div className="flex items-center gap-1 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span>{formatDuration(elapsedTime)}</span>
            </div>
          </div>
        </div>

        {node.status === 'processing' && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Processing research tasks...
            </p>
            <div className="space-y-1">
              {node.tasks
                .filter((t: any) => t.status === 'processing')
                .slice(0, 3)
                .map((task: any) => (
                  <div key={task.id} className="flex items-center gap-2">
                    <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                    <span className="text-xs truncate">
                      Task {task.rowIndex + 1}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}