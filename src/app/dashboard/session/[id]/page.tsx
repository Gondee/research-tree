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
  nodes: any[]
  tasks: any[]
}

export default function SessionPage({ params }: SessionPageProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [researchSession, setResearchSession] = useState<ResearchSession | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('tree')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  useEffect(() => {
    params.then(p => setSessionId(p.id))
  }, [params])

  useEffect(() => {
    if (!session) {
      router.push('/auth/login')
    } else if (sessionId) {
      loadSession()
    }
  }, [session, sessionId, router])

  const loadSession = async () => {
    if (!sessionId) return
    
    try {
      const res = await fetch(`/api/sessions/${sessionId}`)
      if (res.ok) {
        const data = await res.json()
        setResearchSession(data)
        // Select first node by default if available
        if (data.nodes.length > 0 && !selectedNodeId) {
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

  if (!session || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!researchSession) {
    return null
  }

  const selectedNode = researchSession.nodes.find(n => n.id === selectedNodeId)
  const activeTasks = researchSession.tasks.filter(t => t.status === 'pending' || t.status === 'running')

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
              <TaskProgress sessionId={researchSession.id} />
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
                    {researchSession.tasks.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No activity yet
                      </p>
                    ) : (
                      researchSession.tasks.map((task: any) => (
                        <div 
                          key={task.id} 
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="space-y-1">
                            <p className="font-medium">
                              {task.type === 'research' ? 'Research Task' : 'Table Generation'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Node: {task.node?.title || 'Unknown'}
                            </p>
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