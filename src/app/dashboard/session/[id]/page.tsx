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
import { 
  ArrowLeft, 
  Loader2, 
  TreePine,
  Table,
  Activity,
  FileDown,
  RefreshCw
} from 'lucide-react'

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
  nodes: Array<{
    id: string
    title?: string
    level: number
    status: string
    tasks?: any[]
    tables?: any[]
  }>
}

export default function SessionPage({ params }: SessionPageProps) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [researchSession, setResearchSession] = useState<ResearchSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
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
    
    const allTasks = researchSession.nodes?.flatMap(node => node.tasks || []) || []
    const hasActiveTasks = allTasks.some(t => t.status === 'pending' || t.status === 'processing')
    
    if (hasActiveTasks) {
      const interval = setInterval(() => {
        loadSession()
      }, 5000) // Poll every 5 seconds
      
      return () => clearInterval(interval)
    }
  }, [researchSession, sessionId])

  const loadSession = async () => {
    if (!sessionId) return
    
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
  // Collect all tasks from all nodes
  const allTasks = researchSession.nodes?.flatMap(node => node.tasks || []) || []
  const activeTasks = allTasks.filter(t => t.status === 'pending' || t.status === 'running')

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
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
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
              {selectedNode ? (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Data Table: {selectedNode.title}</CardTitle>
                        <CardDescription>
                          View and export structured data from this research node
                        </CardDescription>
                      </div>
                      {selectedNode.tables && selectedNode.tables.length > 0 && (
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
                    <NodeDataTable nodeId={selectedNode.id} />
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
            </TabsContent>

            <TabsContent value="activity" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Activity Log</CardTitle>
                  <CardDescription>
                    Track all research tasks and their status
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {allTasks.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No activity yet
                      </p>
                    ) : (
                      allTasks.map((task: any) => {
                        // Find the node this task belongs to
                        const taskNode = researchSession.nodes?.find(n => 
                          n.tasks?.some(t => t.id === task.id)
                        )
                        return (
                          <div 
                            key={task.id} 
                            className="flex items-center justify-between p-4 border rounded-lg"
                          >
                            <div className="space-y-1 flex-1">
                              <p className="font-medium">
                                Research Task #{task.rowIndex + 1}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Level {taskNode?.level || 0}
                              </p>
                              {task.status === 'completed' && task.prompt && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Prompt: {task.prompt.substring(0, 100)}...
                                </p>
                              )}
                              {task.status === 'completed' && task.openaiResponse && (
                                <div className="mt-2 p-2 bg-muted rounded-md">
                                  <p className="text-xs font-medium mb-1">Response Preview:</p>
                                  <p className="text-xs text-muted-foreground">
                                    {task.openaiResponse.substring(0, 200)}...
                                  </p>
                                </div>
                              )}
                            </div>
                          <div className="text-sm">
                            <span className={`
                              px-2 py-1 rounded-full text-xs font-medium
                              ${task.status === 'completed' ? 'bg-green-100 text-green-700' : ''}
                              ${task.status === 'running' ? 'bg-blue-100 text-blue-700' : ''}
                              ${task.status === 'pending' ? 'bg-gray-100 text-gray-700' : ''}
                              ${task.status === 'failed' ? 'bg-red-100 text-red-700' : ''}
                            `}>
                              {task.status}
                            </span>
                          </div>
                        </div>
                      )
                    })
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