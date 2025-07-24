'use client'

import { useEffect, useState } from 'react'
import { useVisibilityPolling } from '@/hooks/use-visibility-polling'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  Loader2, 
  Activity,
  Filter,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Layers,
  FileText,
  Table,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ActivityLog {
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
  session: {
    id: string
    name: string
  }
}

interface Pagination {
  page: number
  limit: number
  totalCount: number
  totalPages: number
}

const EVENT_TYPE_ICONS = {
  task_created: <FileText className="h-4 w-4" />,
  task_started: <Loader2 className="h-4 w-4 animate-spin" />,
  task_completed: <CheckCircle className="h-4 w-4" />,
  task_failed: <XCircle className="h-4 w-4" />,
  task_retry: <RefreshCw className="h-4 w-4" />,
  node_created: <Layers className="h-4 w-4" />,
  node_started: <Loader2 className="h-4 w-4 animate-spin" />,
  node_completed: <CheckCircle className="h-4 w-4" />,
  node_failed: <XCircle className="h-4 w-4" />,
  table_generation_started: <Table className="h-4 w-4" />,
  table_generated: <Table className="h-4 w-4" />,
  table_generation_failed: <Table className="h-4 w-4" />,
  session_created: <Activity className="h-4 w-4" />,
  error: <AlertCircle className="h-4 w-4" />,
}

const EVENT_TYPE_COLORS = {
  task_created: "border-blue-200 bg-blue-50",
  task_started: "border-blue-300 bg-blue-100",
  task_completed: "border-green-200 bg-green-50",
  task_failed: "border-red-200 bg-red-50",
  task_retry: "border-yellow-200 bg-yellow-50",
  node_created: "border-purple-200 bg-purple-50",
  node_started: "border-purple-300 bg-purple-100",
  node_completed: "border-green-300 bg-green-100",
  node_failed: "border-red-300 bg-red-100",
  table_generation_started: "border-indigo-200 bg-indigo-50",
  table_generated: "border-indigo-300 bg-indigo-100",
  table_generation_failed: "border-red-200 bg-red-50",
  session_created: "border-gray-200 bg-gray-50",
  error: "border-orange-200 bg-orange-50",
}

export default function ActivityLogPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    totalCount: 0,
    totalPages: 0,
  })
  
  // Filters
  const [sessionId, setSessionId] = useState<string>('all')
  const [eventType, setEventType] = useState<string>('all')
  const [sessions, setSessions] = useState<Array<{id: string, name: string}>>([])

  useEffect(() => {
    if (status === 'loading') return
    
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    } else if (status === 'authenticated') {
      loadSessions()
      loadLogs()
    }
  }, [status, router])

  useEffect(() => {
    if (status === 'authenticated') {
      loadLogs()
    }
  }, [pagination.page, sessionId, eventType])

  // Auto-refresh logs with optimized polling
  useVisibilityPolling(
    () => loadLogs(true),
    15000, // Poll every 15 seconds (reduced from 5 seconds)
    status === 'authenticated'
  )

  const loadSessions = async () => {
    try {
      const res = await fetch('/api/sessions')
      if (res.ok) {
        const data = await res.json()
        setSessions(data.map((s: any) => ({ id: s.id, name: s.name })))
      }
    } catch (error) {
      console.error('Failed to load sessions:', error)
    }
  }

  const loadLogs = async (silent = false) => {
    if (!silent) {
      setIsLoading(true)
    } else {
      setIsRefreshing(true)
    }
    
    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      })
      
      if (sessionId && sessionId !== 'all') params.append('sessionId', sessionId)
      if (eventType && eventType !== 'all') params.append('eventType', eventType)
      
      const res = await fetch(`/api/activity-logs?${params}`)
      if (res.ok) {
        const data = await res.json()
        setLogs(data.logs)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Failed to load activity logs:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const handleRefresh = () => {
    loadLogs()
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const seconds = Math.floor(diff / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    if (seconds > 0) return `${seconds}s ago`
    return 'just now'
  }

  const formatEventType = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/dashboard" 
                className="text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="flex items-center gap-3">
                <Activity className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-xl font-semibold">Activity Log</h1>
                  <p className="text-sm text-muted-foreground">
                    Real-time view of all research activities
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isRefreshing && (
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Updating...
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                className="gap-2"
                disabled={isRefreshing}
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Session</label>
                  <Select value={sessionId} onValueChange={setSessionId}>
                    <SelectTrigger>
                      <SelectValue placeholder="All sessions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All sessions</SelectItem>
                      {sessions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-2 block">Event Type</label>
                  <Select value={eventType} onValueChange={setEventType}>
                    <SelectTrigger>
                      <SelectValue placeholder="All events" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All events</SelectItem>
                      <SelectItem value="task_created">Task Created</SelectItem>
                      <SelectItem value="task_started">Task Started</SelectItem>
                      <SelectItem value="task_completed">Task Completed</SelectItem>
                      <SelectItem value="task_failed">Task Failed</SelectItem>
                      <SelectItem value="task_retry">Task Retry</SelectItem>
                      <SelectItem value="node_created">Node Created</SelectItem>
                      <SelectItem value="node_completed">Node Completed</SelectItem>
                      <SelectItem value="node_failed">Node Failed</SelectItem>
                      <SelectItem value="table_generated">Table Generated</SelectItem>
                      <SelectItem value="error">Errors</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSessionId('all')
                      setEventType('all')
                      setPagination(prev => ({ ...prev, page: 1 }))
                    }}
                    className="w-full"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity Logs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Activity Timeline</CardTitle>
                  <CardDescription>
                    {pagination.totalCount} total events
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                    disabled={pagination.page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {logs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No activity logs found. Start a research session to see events appear here.
                  </p>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className={cn(
                        "flex items-start gap-3 p-3 border rounded-lg transition-colors",
                        EVENT_TYPE_COLORS[log.eventType as keyof typeof EVENT_TYPE_COLORS] || "bg-gray-50"
                      )}
                    >
                      <div className="flex-shrink-0 mt-0.5">
                        {EVENT_TYPE_ICONS[log.eventType as keyof typeof EVENT_TYPE_ICONS] || <Activity className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-sm">{log.message}</p>
                            {log.level > 0 && (
                              <Badge variant="outline" className="text-xs">
                                Level {log.level}
                              </Badge>
                            )}
                            <Badge variant="secondary" className="text-xs">
                              {formatEventType(log.eventType)}
                            </Badge>
                          </div>
                          <time className="text-xs text-muted-foreground flex-shrink-0">
                            {formatTime(log.createdAt)}
                          </time>
                        </div>
                        
                        <p className="text-xs text-muted-foreground mb-1">
                          Session: {log.session.name}
                        </p>
                        
                        {log.details && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {log.details}
                          </p>
                        )}
                        
                        {log.nodeId && (
                          <Link
                            href={`/dashboard/session/${log.sessionId}?nodeId=${log.nodeId}`}
                            className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                          >
                            View in session
                            <ArrowLeft className="h-3 w-3 rotate-180" />
                          </Link>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}