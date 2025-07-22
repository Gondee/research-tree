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
  RefreshCw
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

export default function SessionPage({ params }: SessionPageProps) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [researchSession, setResearchSession] = useState<ResearchSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState('tree')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

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
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="tree" className="gap-2">
                <TreePine className="h-4 w-4" />
                Research Tree
              </TabsTrigger>
              <TabsTrigger value="data" className="gap-2">
                <Table className="h-4 w-4" />
                Data Tables
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
          </Tabs>
          
          {/* Activity Log Link */}
          <div className="mt-6 text-center">
            <Link 
              href={`/dashboard/activity?sessionId=${researchSession.id}`}
              className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
            >
              <Activity className="h-4 w-4" />
              View detailed activity log
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}