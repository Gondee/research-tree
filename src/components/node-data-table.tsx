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
          disabled={!nodeData || !nodeData.generatedTable}
        >
          Generated Table
        </Button>
      </div>

      {/* Content */}
      {activeTab === 'research' && nodeData && (
        <div className="space-y-4">
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
              try {
                if (!nodeData || !nodeData.generatedTable || !nodeData.generatedTable.tableData) {
                  return (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No table data available</p>
                    </div>
                  );
                }
                
                // Parse the tableData JSON if it's a string
                const rawTableData = nodeData.generatedTable.tableData;
                const tableData = typeof rawTableData === 'string' 
                  ? JSON.parse(rawTableData)
                  : rawTableData;
                
                // Initialize columns and rows
                let columns: string[] = [];
                let rows: any[] = [];
                
                // Check different data structures
                if (tableData && typeof tableData === 'object') {
                  // Case 1: Structured format with columns and data
                  if ('columns' in tableData && 'data' in tableData) {
                    if (Array.isArray(tableData.columns)) {
                      columns = tableData.columns.map((col: any) => {
                        if (typeof col === 'string') return col;
                        if (col && typeof col === 'object' && col.id) return col.id;
                        return String(col);
                      });
                    }
                    if (Array.isArray(tableData.data)) {
                      rows = tableData.data;
                    }
                  }
                  // Case 2: Nested tableData structure
                  else if ('tableData' in tableData && Array.isArray(tableData.tableData)) {
                    rows = tableData.tableData;
                    if (rows.length > 0) {
                      columns = Object.keys(rows[0]);
                    }
                  }
                  // Case 3: Direct array of objects
                  else if (Array.isArray(tableData)) {
                    rows = tableData;
                    if (rows.length > 0) {
                      columns = Object.keys(rows[0]);
                    }
                  }
                }

              if (columns.length === 0 || rows.length === 0) {
                return (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">No table data available</p>
                  </div>
                );
              }

              // Ensure we have valid arrays before rendering
              if (!Array.isArray(columns) || !Array.isArray(rows)) {
                return (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Invalid table data format</p>
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
                              {row && row[col] !== null && row[col] !== undefined 
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
              } catch (error) {
                console.error('Error parsing table data:', error);
                return (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">Error loading table data</p>
                  </div>
                );
              }
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
            try {
              const tableData = typeof nodeData.generatedTable.tableData === 'string' 
                ? JSON.parse(nodeData.generatedTable.tableData)
                : nodeData.generatedTable.tableData;
              
              const hasStructuredFormat = tableData && typeof tableData === 'object' && 
                'columns' in tableData && 'data' in tableData;
              
              let columns: string[] = [];
              if (hasStructuredFormat && Array.isArray(tableData.columns)) {
                columns = tableData.columns.map((col: any) => {
                  if (typeof col === 'string') return col;
                  if (col && typeof col === 'object' && col.id) return col.id;
                  return String(col);
                });
              } else if (Array.isArray(tableData) && tableData.length > 0) {
                columns = Object.keys(tableData[0]);
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
              
              const hasStructuredFormat = tableData && typeof tableData === 'object' && 
                'columns' in tableData && 'data' in tableData;
              
              let rows: any[] = [];
              if (hasStructuredFormat && Array.isArray(tableData.data)) {
                rows = tableData.data;
              } else if (Array.isArray(tableData)) {
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
  )
}