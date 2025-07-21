'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, FileText, ExternalLink } from 'lucide-react'

interface NodeDataTableProps {
  nodeId: string
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
    tableData: any
    columns: string[]
  }
}

export function NodeDataTable({ nodeId }: NodeDataTableProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [nodeData, setNodeData] = useState<NodeData | null>(null)
  const [activeTab, setActiveTab] = useState<'research' | 'table'>('research')

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
            <CardTitle>Structured Data Table</CardTitle>
            <CardDescription>Data extracted and structured by AI</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    {nodeData.generatedTable.columns.map((col) => (
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
                  {(nodeData.generatedTable.tableData as any[]).map((row, idx) => (
                    <tr key={idx}>
                      {nodeData.generatedTable!.columns.map((col) => (
                        <td key={col} className="px-4 py-2 text-sm">
                          {row[col]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}