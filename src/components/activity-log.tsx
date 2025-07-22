'use client'

import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Activity, CheckCircle, AlertCircle, Clock, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ActivityLogProps {
  sessionId: string
}

interface ActivityLogEntry {
  id: string
  sessionId: string
  nodeId?: string
  taskId?: string
  level: number
  eventType: string
  status?: string
  message: string
  details?: string
  metadata?: any
  createdAt: string
}

const getEventIcon = (eventType: string) => {
  switch (eventType) {
    case 'task_completed':
    case 'node_completed':
      return <CheckCircle className="h-4 w-4 text-green-600" />
    case 'task_failed':
    case 'node_failed':
      return <AlertCircle className="h-4 w-4 text-red-600" />
    case 'task_started':
    case 'task_retry':
      return <RefreshCw className="h-4 w-4 text-blue-600" />
    default:
      return <Clock className="h-4 w-4 text-gray-600" />
  }
}

const getEventColor = (eventType: string) => {
  if (eventType.includes('completed')) return 'success'
  if (eventType.includes('failed')) return 'destructive'
  if (eventType.includes('started') || eventType.includes('retry')) return 'default'
  return 'secondary'
}

export function ActivityLog({ sessionId }: ActivityLogProps) {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const loadLogs = async () => {
    try {
      const params = new URLSearchParams({
        sessionId,
        limit: '50'
      })
      const res = await fetch(`/api/activity-logs?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs)
      }
    } catch (error) {
      console.error('Failed to load activity logs:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(loadLogs, 5000)
    return () => clearInterval(interval)
  }, [sessionId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8">
        <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No activity yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-2 max-h-[600px] overflow-y-auto">
      {logs.map((log) => (
        <Card key={log.id} className="p-3">
          <div className="flex items-start gap-3">
            {getEventIcon(log.eventType)}
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{log.message}</span>
                {log.level > 0 && (
                  <Badge variant="outline" className="text-xs">
                    Level {log.level}
                  </Badge>
                )}
              </div>
              {log.details && (
                <p className="text-xs text-muted-foreground">{log.details}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {new Date(log.createdAt).toLocaleString()}
              </p>
            </div>
            <Badge variant={getEventColor(log.eventType) as any} className="text-xs">
              {log.eventType.replace(/_/g, ' ')}
            </Badge>
          </div>
        </Card>
      ))}
    </div>
  )
}