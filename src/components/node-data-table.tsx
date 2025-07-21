'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, FileText, ExternalLink, Layers } from 'lucide-react'
import { NextLevelResearchModal } from './next-level-research-modal'

interface NodeDataTableProps {
  nodeId: string
  sessionId?: string
}

interface NodeData {
  id: string
  promptTemplate: string
  status: string
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
}

export function NodeDataTable({ nodeId, sessionId }: NodeDataTableProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [nodeData, setNodeData] = useState<NodeData | null>(null)
  const [activeTab, setActiveTab] = useState<'research' | 'table'>('research')
  const [showNextLevelModal, setShowNextLevelModal] = useState(false)

  useEffect(() => {
    loadNodeData()
  }, [nodeId])

  const loadNodeData = async () => {
    try {
      const res = await fetch(`/api/nodes/${nodeId}`)
      if (res.ok) {
        const data = await res.json()
        setNodeData(data)
      }
    } catch (error) {
      console.error('Failed to load node data:', error)
    } finally {
      setIsLoading(false)
    }
  }

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

  return (
    <div className="space-y-4">
      {/* Tab buttons */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'research' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('research')}
        >
          Research Results
        </Button>
        <Button
          variant={activeTab === 'table' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('table')}
          disabled={!nodeData.generatedTable}
        >
          Generated Table
        </Button>
      </div>

      {/* Content */}
      {activeTab === 'research' && (
        <div className="space-y-4">
          {nodeData.tasks.map((task, index) => (
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
          ))}
        </div>
      )}

      {activeTab === 'table' && nodeData.generatedTable && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Structured Data Table</CardTitle>
                <CardDescription>Data extracted and structured by AI</CardDescription>
              </div>
              {nodeData.status === 'completed' && sessionId && (
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
          <CardContent>
            {(() => {
              // Parse the tableData JSON if it's a string
              const tableData = typeof nodeData.generatedTable.tableData === 'string' 
                ? JSON.parse(nodeData.generatedTable.tableData)
                : nodeData.generatedTable.tableData;
              
              // Check if tableData is an object with columns and data properties
              const hasStructuredFormat = tableData && typeof tableData === 'object' && 
                'columns' in tableData && 'data' in tableData;
              
              const columns = hasStructuredFormat 
                ? tableData.columns.map((col: any) => col.id || col)
                : (tableData && Array.isArray(tableData) && tableData.length > 0)
                  ? Object.keys(tableData[0])
                  : [];
              
              const rows = hasStructuredFormat
                ? tableData.data
                : Array.isArray(tableData) ? tableData : [];

              if (columns.length === 0 || rows.length === 0) {
                return (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No table data available</p>
                  </div>
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead>
                      <tr>
                        {columns.map((col: string) => (
                          <th
                            key={col}
                            className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {rows.map((row: any, idx: number) => (
                        <tr key={idx}>
                          {columns.map((col: string) => (
                            <td key={col} className="px-4 py-2 text-sm">
                              {row[col] !== null && row[col] !== undefined 
                                ? String(row[col]) 
                                : '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
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
            const tableData = typeof nodeData.generatedTable.tableData === 'string' 
              ? JSON.parse(nodeData.generatedTable.tableData)
              : nodeData.generatedTable.tableData;
            
            const hasStructuredFormat = tableData && typeof tableData === 'object' && 
              'columns' in tableData && 'data' in tableData;
            
            const columns = hasStructuredFormat 
              ? tableData.columns.map((col: any) => col.id || col)
              : (tableData && Array.isArray(tableData) && tableData.length > 0)
                ? Object.keys(tableData[0])
                : [];
            
            return columns;
          })()}
          rowCount={(() => {
            const tableData = typeof nodeData.generatedTable.tableData === 'string' 
              ? JSON.parse(nodeData.generatedTable.tableData)
              : nodeData.generatedTable.tableData;
            
            const hasStructuredFormat = tableData && typeof tableData === 'object' && 
              'columns' in tableData && 'data' in tableData;
            
            const rows = hasStructuredFormat
              ? tableData.data
              : Array.isArray(tableData) ? tableData : [];
            
            return rows.length;
          })()}
          onSuccess={() => {
            setShowNextLevelModal(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}