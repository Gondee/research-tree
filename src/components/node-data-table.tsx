'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, FileText, ExternalLink, Layers, RefreshCw } from 'lucide-react'
import { NextLevelResearchModal } from './next-level-research-modal'
import { ErrorBoundary } from './error-boundary'
import { SafeTableRenderer } from './safe-table-renderer'
import { ExcelTableCompact } from './excel-table-compact'
import { cn } from '@/lib/utils'

interface NodeDataTableProps {
  nodeId: string
  sessionId?: string
}

interface NodeData {
  id: string
  promptTemplate: string
  status: string
  errorMessage?: string
  tasks: Array<{
    id: string
    prompt: string
    status: string
    openaiResponse?: string
    errorMessage?: string
  }>
  generatedTable?: {
    tableData: any // This is JSON data from the database
  }
  isCombined?: boolean
  childCount?: number
  originalNodeData?: {
    tasks: any[]
    generatedTable?: any
  }
}

export function NodeDataTable({ nodeId, sessionId }: NodeDataTableProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [nodeData, setNodeData] = useState<NodeData | null>(null)
  const [activeTab, setActiveTab] = useState<'research' | 'table'>('research')
  const [showNextLevelModal, setShowNextLevelModal] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  useEffect(() => {
    loadNodeData()
  }, [nodeId])

  const loadNodeData = async () => {
    try {
      // First try to load combined data (includes children)
      const combinedRes = await fetch(`/api/nodes/${nodeId}/combined`)
      if (combinedRes.ok) {
        const data = await combinedRes.json()
        setNodeData(data)
        // Default to table view if this is combined data with children
        if (data.isCombined && data.childCount > 0 && data.generatedTable) {
          setActiveTab('table')
        }
      } else {
        // Fallback to regular node endpoint
        const res = await fetch(`/api/nodes/${nodeId}`)
        if (res.ok) {
          const data = await res.json()
          setNodeData(data)
        }
      }
    } catch (error) {
      console.error('Failed to load node data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRetry = async (retryAll = false) => {
    if (!sessionId || !nodeData) return
    
    setIsRetrying(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/nodes/${nodeId}/retry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ retryAll }),
      })
      
      if (res.ok) {
        const data = await res.json()
        console.log(`Retrying ${data.retriedTasks} tasks (retryAll: ${data.retryAll})`)
        
        // Refresh the node data
        await loadNodeData()
        
        // Refresh the entire page to update the tree
        router.refresh()
      } else {
        console.error('Failed to retry tasks')
      }
    } catch (error) {
      console.error('Error retrying tasks:', error)
    } finally {
      setIsRetrying(false)
    }
  }

  const handleRetryAll = () => handleRetry(true)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  if (!nodeData) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">No data available for this node</p>
      </div>
    )
  }

  // Show error state if node failed
  if (nodeData.status === 'failed') {
    return (
      <div className="space-y-4">
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-red-700">Research Failed</CardTitle>
                <CardDescription className="text-red-600">
                  {nodeData.errorMessage || 'An error occurred during research processing'}
                </CardDescription>
              </div>
              {sessionId && (
                <Button
                  onClick={() => handleRetry(false)}
                  disabled={isRetrying}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  {isRetrying ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4" />
                      Retry Failed Tasks
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-red-600 mb-4">
              Some or all tasks in this research node failed to complete. Check the details below for more information.
            </p>
            {nodeData.tasks && nodeData.tasks.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Task Status:</h4>
                {nodeData.tasks.map((task, index) => (
                  <div key={task.id} className="flex items-center justify-between text-sm p-2 rounded bg-white">
                    <span>Task #{index + 1}</span>
                    <span className={cn(
                      "px-2 py-1 rounded text-xs",
                      task.status === 'failed' ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"
                    )}>
                      {task.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="space-y-4">
        {/* Show combined data indicator */}
        {nodeData.isCombined && nodeData.childCount && nodeData.childCount > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-blue-800">
              <Layers className="inline h-4 w-4 mr-1" />
              Showing combined data from {nodeData.childCount} child nodes
            </p>
          </div>
        )}
        
        {/* Tab buttons */}
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'research' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('research')}
          >
            Research Results {nodeData.isCombined && `(${nodeData.tasks.length} tasks)`}
          </Button>
          <Button
            variant={activeTab === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('table')}
            disabled={!nodeData || !nodeData.generatedTable}
          >
            Generated Table {nodeData.isCombined && nodeData.generatedTable && '(Combined)'}
          </Button>
        </div>

      {/* Content */}
      {activeTab === 'research' && nodeData && (
        <div className="space-y-4">
          {/* Retry button for completed nodes */}
          {nodeData.status === 'completed' && sessionId && (
            <div className="flex justify-end">
              <Button
                onClick={() => handleRetryAll()}
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={isRetrying}
              >
                {isRetrying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Regenerate Research
                  </>
                )}
              </Button>
            </div>
          )}
          
          {(!nodeData.tasks || !Array.isArray(nodeData.tasks) || nodeData.tasks.length === 0) ? (
            <p className="text-center text-muted-foreground py-8">No research tasks available</p>
          ) : (
            nodeData.tasks.map((task, index) => (
            <Card key={task.id}>
              <CardHeader>
                <CardTitle className="text-base">Research Task #{index + 1}</CardTitle>
                <CardDescription>{task.prompt}</CardDescription>
              </CardHeader>
              <CardContent>
                {task.status === 'completed' && task.openaiResponse ? (
                  <div className="prose prose-sm max-w-none">
                    <div className="whitespace-pre-wrap text-sm">
                      {task.openaiResponse}
                    </div>
                  </div>
                ) : task.status === 'failed' ? (
                  <p className="text-red-600 text-sm">Error: {task.errorMessage}</p>
                ) : (
                  <p className="text-muted-foreground text-sm">Task {task.status}...</p>
                )}
              </CardContent>
            </Card>
          ))
          )}
        </div>
      )}

      {activeTab === 'table' && nodeData.generatedTable && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Structured Data Table</CardTitle>
                <CardDescription>
                  {nodeData.isCombined && nodeData.childCount && nodeData.childCount > 0
                    ? `Combined data from ${nodeData.childCount} research branches`
                    : 'Data extracted and structured by AI'}
                </CardDescription>
              </div>
              {nodeData.status === 'completed' && sessionId && !nodeData.isCombined && (
                <Button
                  onClick={() => setShowNextLevelModal(true)}
                  className="gap-2"
                >
                  <Layers className="h-4 w-4" />
                  Start Next Level Research
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-2">
            <div className="h-[600px]">
              <ExcelTableCompact 
                tableData={nodeData.generatedTable?.tableData} 
                sessionName={nodeData.promptTemplate?.slice(0, 50) || 'research-data'}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next Level Research Modal */}
      {nodeData && nodeData.generatedTable && sessionId && (
        <NextLevelResearchModal
          open={showNextLevelModal}
          onClose={() => setShowNextLevelModal(false)}
          parentNodeId={nodeId}
          sessionId={sessionId}
          tableColumns={(() => {
            try {
              const tableData = typeof nodeData.generatedTable.tableData === 'string' 
                ? JSON.parse(nodeData.generatedTable.tableData)
                : nodeData.generatedTable.tableData;
              
              let columns: string[] = [];
              
              // Check for Gemini response format (columns + tableData)
              if (tableData && typeof tableData === 'object' && 'columns' in tableData && 'tableData' in tableData) {
                if (Array.isArray(tableData.columns)) {
                  columns = tableData.columns.map((col: any) => {
                    if (typeof col === 'string') return col;
                    if (col && typeof col === 'object' && col.id) return col.id;
                    return String(col);
                  });
                }
              }
              // Check for alternative format (columns + data)
              else if (tableData && typeof tableData === 'object' && 'columns' in tableData && 'data' in tableData) {
                if (Array.isArray(tableData.columns)) {
                  columns = tableData.columns.map((col: any) => {
                    if (typeof col === 'string') return col;
                    if (col && typeof col === 'object' && col.id) return col.id;
                    return String(col);
                  });
                }
              }
              // Fallback: if it's just an array of objects, get keys from first row
              else if (Array.isArray(tableData) && tableData.length > 0) {
                columns = Object.keys(tableData[0]);
              }
              // Additional fallback: check if tableData has a nested tableData property with array
              else if (tableData && tableData.tableData && Array.isArray(tableData.tableData) && tableData.tableData.length > 0) {
                columns = Object.keys(tableData.tableData[0]);
              }
              
              return columns;
            } catch (error) {
              console.error('Error parsing table columns:', error);
              return [];
            }
          })()}
          rowCount={(() => {
            try {
              const tableData = typeof nodeData.generatedTable.tableData === 'string' 
                ? JSON.parse(nodeData.generatedTable.tableData)
                : nodeData.generatedTable.tableData;
              
              let rows: any[] = [];
              
              // Check for Gemini response format (columns + tableData)
              if (tableData && typeof tableData === 'object' && 'tableData' in tableData && Array.isArray(tableData.tableData)) {
                rows = tableData.tableData;
              }
              // Check for alternative format (columns + data)
              else if (tableData && typeof tableData === 'object' && 'data' in tableData && Array.isArray(tableData.data)) {
                rows = tableData.data;
              }
              // Fallback: if it's just an array
              else if (Array.isArray(tableData)) {
                rows = tableData;
              }
              
              return rows.length;
            } catch (error) {
              console.error('Error counting rows:', error);
              return 0;
            }
          })()}
          onSuccess={() => {
            setShowNextLevelModal(false)
            router.refresh()
          }}
        />
      )}
      </div>
    </ErrorBoundary>
  )
}