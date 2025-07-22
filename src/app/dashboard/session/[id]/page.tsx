'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ResearchTree } from '@/components/research-tree'
import { NodeDataTable } from '@/components/node-data-table'
import { TaskProgress } from '@/components/task-progress'
import { ErrorBoundary } from '@/components/error-boundary'
import { 
  ArrowLeft, 
  Loader2, 
  TreePine,
  Table,
  Activity,
  FileDown,
  RefreshCw,
  FileText
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SessionPageProps {
  params: Promise<{ id: string }>
}

interface ResearchSession {
  id: string
  name: string
  description?: string
  status: string
  createdAt: string
  updatedAt: string
  nodes?: Array<{
    id: string
    title?: string
    level: number
    status: string
    tasks?: Array<{
      id: string
      status: string
      rowIndex: number
      prompt?: string
      openaiResponse?: string
      errorMessage?: string
      startedAt?: string
      completedAt?: string
      retryCount?: number
    }>
    generatedTable?: any
    children?: any[]
  }>
}

interface ActivityEvent {
  id: string
  timestamp: Date
  type: 'task_started' | 'task_completed' | 'task_failed' | 'task_retry' | 'node_completed' | 'node_failed'
  taskId?: string
  nodeId?: string
  level: number
  message: string
  details?: string
}

export default function SessionPage({ params }: SessionPageProps) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [researchSession, setResearchSession] = useState<ResearchSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('tree')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([])
  const [previousTaskStates, setPreviousTaskStates] = useState<Map<string, string>>(new Map())

  useEffect(() => {
    params.then(p => setSessionId(p.id))
  }, [params])

  useEffect(() => {
    if (status === 'loading') return
    
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    } else if (status === 'authenticated' && sessionId) {
      loadSession()
    }
  }, [status, sessionId, router])

  // Auto-refresh when there are active tasks
  useEffect(() => {
    if (!researchSession) return
    
    const allTasks = researchSession.nodes?.flatMap(node => {
      // Ensure tasks is an array
      if (!node.tasks || !Array.isArray(node.tasks)) return []
      return node.tasks
    }) || []
    const hasActiveTasks = allTasks.some(t => t.status === 'pending' || t.status === 'processing')
    
    // Also check if any nodes are processing
    const hasActiveNodes = researchSession.nodes?.some(node => 
      node.status === 'pending' || node.status === 'processing'
    ) || false
    
    if (hasActiveTasks || hasActiveNodes) {
      console.log('Auto-refresh enabled: active tasks or nodes detected')
      const interval = setInterval(() => {
        console.log('Auto-refreshing session data...')
        loadSession()
      }, 5000) // Poll every 5 seconds
      
      return () => clearInterval(interval)
    }
  }, [researchSession, sessionId])

  const loadSession = async () => {
    if (!sessionId) return
    
    // Set refreshing state only if already loaded
    if (!isLoading) {
      setIsRefreshing(true)
    }
    
    try {
      const res = await fetch(`/api/sessions/${sessionId}`)
      if (res.ok) {
        const data = await res.json()
        
        // Generate activity events from task changes
        if (researchSession && data.nodes) {
          generateActivityEvents(researchSession, data)
        }
        
        setResearchSession(data)
        // Select first node by default if available
        if (data.nodes && data.nodes.length > 0 && !selectedNodeId) {
          setSelectedNodeId(data.nodes[0].id)
        }
      } else {
        router.push('/dashboard')
      }
    } catch (error) {
      console.error('Failed to load session:', error)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  const generateActivityEvents = (oldSession: ResearchSession, newSession: ResearchSession) => {
    const newEvents: ActivityEvent[] = []
    const currentTaskStates = new Map(previousTaskStates)
    
    // Check all tasks for status changes
    newSession.nodes?.forEach(node => {
      node.tasks?.forEach(task => {
        const previousStatus = currentTaskStates.get(task.id)
        const currentStatus = task.status
        
        // Task status changed
        if (previousStatus !== currentStatus) {
          let event: ActivityEvent | null = null
          
          if (currentStatus === 'processing' && previousStatus !== 'processing') {
            event = {
              id: `${task.id}-started-${Date.now()}`,
              timestamp: new Date(),
              type: 'task_started',
              taskId: task.id,
              nodeId: node.id,
              level: node.level,
              message: `Task #${task.rowIndex + 1} started processing`,
              details: task.prompt?.substring(0, 100) + '...'
            }
          } else if (currentStatus === 'completed' && previousStatus !== 'completed') {
            event = {
              id: `${task.id}-completed-${Date.now()}`,
              timestamp: new Date(),
              type: 'task_completed',
              taskId: task.id,
              nodeId: node.id,
              level: node.level,
              message: `Task #${task.rowIndex + 1} completed successfully`,
              details: 'Research data collected'
            }
          } else if (currentStatus === 'failed' && previousStatus !== 'failed') {
            event = {
              id: `${task.id}-failed-${Date.now()}`,
              timestamp: new Date(),
              type: 'task_failed',
              taskId: task.id,
              nodeId: node.id,
              level: node.level,
              message: `Task #${task.rowIndex + 1} failed`,
              details: task.errorMessage || 'Unknown error'
            }
          } else if (currentStatus === 'pending' && previousStatus === 'failed') {
            event = {
              id: `${task.id}-retry-${Date.now()}`,
              timestamp: new Date(),
              type: 'task_retry',
              taskId: task.id,
              nodeId: node.id,
              level: node.level,
              message: `Task #${task.rowIndex + 1} queued for retry (attempt ${(task.retryCount || 0) + 1})`,
              details: 'Task reset and queued for processing'
            }
          }
          
          if (event) {
            newEvents.push(event)
          }
          
          // Update the state map
          currentTaskStates.set(task.id, currentStatus)
        }
      })
      
      // Check for node status changes
      const oldNode = oldSession.nodes?.find(n => n.id === node.id)
      if (oldNode && oldNode.status !== node.status) {
        if (node.status === 'completed') {
          newEvents.push({
            id: `${node.id}-completed-${Date.now()}`,
            timestamp: new Date(),
            type: 'node_completed',
            nodeId: node.id,
            level: node.level,
            message: `Level ${node.level} research completed`,
            details: 'All tasks finished successfully'
          })
        } else if (node.status === 'failed') {
          newEvents.push({
            id: `${node.id}-failed-${Date.now()}`,
            timestamp: new Date(),
            type: 'node_failed',
            nodeId: node.id,
            level: node.level,
            message: `Level ${node.level} research failed`,
            details: 'One or more tasks failed'
          })
        }
      }
    })
    
    // Add new events to the beginning of the array (newest first)
    if (newEvents.length > 0) {
      setActivityEvents(prev => [...newEvents, ...prev])
    }
    
    // Update the previous states map
    setPreviousTaskStates(currentTaskStates)
  }

  const handleRefresh = () => {
    loadSession()
  }

  const handleExportCSV = async (nodeId: string) => {
    try {
      const res = await fetch(`/api/tables/export/${nodeId}`)
      if (res.ok) {
        const blob = await res.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `research-data-${nodeId}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Failed to export CSV:', error)
    }
  }

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!researchSession) {
    return null
  }

  const selectedNode = researchSession.nodes?.find(n => n.id === selectedNodeId)
  // Collect all active tasks from all nodes
  const activeTasks = researchSession.nodes?.flatMap(node => {
    // Ensure tasks is an array
    if (!node.tasks || !Array.isArray(node.tasks)) return []
    return node.tasks.filter(t => t.status === 'pending' || t.status === 'processing')
  }) || []

  // Add allTasks to the activity log section
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
                <TreePine className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-xl font-semibold">{researchSession.name}</h1>
                  {researchSession.description && (
                    <p className="text-sm text-muted-foreground">{researchSession.description}</p>
                  )}
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
          {/* Active Tasks Progress */}
          {activeTasks.length > 0 && (
            <div className="mb-6">
              <TaskProgress sessionId={researchSession.id} tasks={activeTasks} />
            </div>
          )}

          {/* Main Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="tree" className="gap-2">
                <TreePine className="h-4 w-4" />
                Research Tree
              </TabsTrigger>
              <TabsTrigger value="data" className="gap-2">
                <Table className="h-4 w-4" />
                Data Tables
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-2">
                <Activity className="h-4 w-4" />
                Activity Log
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tree" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Research Hierarchy</CardTitle>
                  <CardDescription>
                    Visualize your research tree and navigate between nodes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[600px] border rounded-lg">
                    <ResearchTree
                      sessionId={researchSession.id}
                      onNodeSelect={setSelectedNodeId}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="data" className="mt-6">
              <ErrorBoundary>
                {selectedNode ? (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>Data Table: {selectedNode.title || 'Research Node'}</CardTitle>
                          <CardDescription>
                            View and export structured data from this research node
                          </CardDescription>
                        </div>
                        {selectedNode.generatedTable && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleExportCSV(selectedNode.id)}
                            className="gap-2"
                          >
                            <FileDown className="h-4 w-4" />
                            Export CSV
                          </Button>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <NodeDataTable nodeId={selectedNode.id} sessionId={researchSession.id} />
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="text-center py-12">
                      <p className="text-muted-foreground">
                        Select a node from the research tree to view its data
                      </p>
                    </CardContent>
                  </Card>
                )}
              </ErrorBoundary>
            </TabsContent>

            <TabsContent value="activity" className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Activity Log</CardTitle>
                      <CardDescription>
                        Live feed of all research activity
                      </CardDescription>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {activityEvents.length} events
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {activityEvents.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No activity yet. Start a research task to see events appear here.
                      </p>
                    ) : (
                      activityEvents.map((event) => (
                        <div 
                          key={event.id} 
                          className={cn(
                            "flex items-start gap-3 p-3 border rounded-lg transition-colors",
                            event.type === 'task_started' && "border-blue-200 bg-blue-50/50",
                            event.type === 'task_completed' && "border-green-200 bg-green-50/50",
                            event.type === 'task_failed' && "border-red-200 bg-red-50/50",
                            event.type === 'task_retry' && "border-yellow-200 bg-yellow-50/50",
                            event.type === 'node_completed' && "border-green-300 bg-green-100/50",
                            event.type === 'node_failed' && "border-red-300 bg-red-100/50"
                          )}
                        >
                          <div className="flex-shrink-0">
                            {event.type === 'task_started' && (
                              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                                <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                              </div>
                            )}
                            {event.type === 'task_completed' && (
                              <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                                <FileText className="h-4 w-4 text-green-600" />
                              </div>
                            )}
                            {event.type === 'task_failed' && (
                              <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                                <Activity className="h-4 w-4 text-red-600" />
                              </div>
                            )}
                            {event.type === 'task_retry' && (
                              <div className="h-8 w-8 rounded-full bg-yellow-100 flex items-center justify-center">
                                <RefreshCw className="h-4 w-4 text-yellow-600" />
                              </div>
                            )}
                            {(event.type === 'node_completed' || event.type === 'node_failed') && (
                              <div className={cn(
                                "h-8 w-8 rounded-full flex items-center justify-center",
                                event.type === 'node_completed' ? "bg-green-200" : "bg-red-200"
                              )}>
                                <TreePine className={cn(
                                  "h-4 w-4",
                                  event.type === 'node_completed' ? "text-green-700" : "text-red-700"
                                )} />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="font-medium text-sm">
                                {event.message}
                              </p>
                              <time className="text-xs text-muted-foreground flex-shrink-0">
                                {new Date(event.timestamp).toLocaleTimeString()}
                              </time>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              Level {event.level}
                            </p>
                            {event.details && (
                              <p className="text-xs text-muted-foreground mt-1 truncate">
                                {event.details}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}