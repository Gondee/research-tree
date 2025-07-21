'use client'

import React, { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  Handle,
  Position,
  NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ResearchNode } from '@/types'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Clock,
  ChevronDown,
  ChevronRight,
  Plus,
  FileText,
  Table,
} from 'lucide-react'

interface ResearchTreeProps {
  sessionId: string
  nodes: ResearchNode[]
  onNodeClick: (nodeId: string) => void
  onAddLevel: (parentNodeId: string) => void
}

interface TreeNodeData {
  researchNode: ResearchNode
  onNodeClick: (nodeId: string) => void
  onAddLevel: (parentNodeId: string) => void
}

const TreeNode = ({ data }: NodeProps) => {
  const typedData = data as unknown as TreeNodeData
  const { researchNode, onNodeClick, onAddLevel } = typedData
  const [isExpanded, setIsExpanded] = React.useState(true)

  const statusIcon = useMemo(() => {
    switch (researchNode.status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-muted-foreground" />
      case 'processing':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />
    }
  }, [researchNode.status])

  const taskStats = useMemo(() => {
    if (!researchNode.tasks) return null
    const total = researchNode.tasks.length
    const completed = researchNode.tasks.filter((t: any) => t.status === 'completed').length
    const failed = researchNode.tasks.filter((t: any) => t.status === 'failed').length
    return { total, completed, failed }
  }, [researchNode.tasks])

  return (
    <>
      <Handle type="target" position={Position.Top} className="w-2 h-2" />
      <Card className={cn(
        "min-w-[250px] max-w-[350px] cursor-pointer transition-all",
        "hover:shadow-lg hover:border-primary",
        researchNode.status === 'processing' && "border-blue-500",
        researchNode.status === 'failed' && "border-red-500",
        researchNode.status === 'completed' && "border-green-500"
      )}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              {statusIcon}
              <span className="text-xs text-muted-foreground">
                Level {researchNode.level}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {researchNode.generatedTable && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    onNodeClick(researchNode.id)
                  }}
                >
                  <Table className="h-3 w-3" />
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsExpanded(!isExpanded)
                }}
              >
                {isExpanded ? 
                  <ChevronDown className="h-3 w-3" /> : 
                  <ChevronRight className="h-3 w-3" />
                }
              </Button>
            </div>
          </div>

          <h3 
            className="font-medium text-sm mb-2 line-clamp-2 cursor-pointer"
            onClick={() => onNodeClick(researchNode.id)}
          >
            {researchNode.promptTemplate}
          </h3>

          {isExpanded && (
            <>
              {taskStats && (
                <div className="text-xs text-muted-foreground mb-2">
                  Tasks: {taskStats.completed}/{taskStats.total}
                  {taskStats.failed > 0 && (
                    <span className="text-red-500 ml-1">
                      ({taskStats.failed} failed)
                    </span>
                  )}
                </div>
              )}

              {researchNode.status === 'completed' && (
                <div className="flex items-center justify-between mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      onNodeClick(researchNode.id)
                    }}
                  >
                    <FileText className="h-3 w-3 mr-1" />
                    View Results
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation()
                      onAddLevel(researchNode.id)
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Level
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2" />
    </>
  )
}

const nodeTypes = {
  researchNode: TreeNode,
}

export function ResearchTree({ 
  sessionId, 
  nodes, 
  onNodeClick, 
  onAddLevel 
}: ResearchTreeProps) {
  const [flowNodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Convert research nodes to flow nodes
  React.useEffect(() => {
    const layoutNodes = (nodes: ResearchNode[], parentX = 0, level = 0): Node[] => {
      const levelNodes: Node[] = []
      const nodeWidth = 400
      const nodeHeight = 200
      const horizontalSpacing = nodeWidth + 100
      const verticalSpacing = nodeHeight + 100

      nodes.forEach((node, index) => {
        const x = parentX + (index - (nodes.length - 1) / 2) * horizontalSpacing
        const y = level * verticalSpacing

        levelNodes.push({
          id: node.id,
          type: 'researchNode',
          position: { x, y },
          data: {
            researchNode: node,
            onNodeClick,
            onAddLevel,
          },
        })

        if (node.children && node.children.length > 0) {
          levelNodes.push(...layoutNodes(node.children, x, level + 1))
        }
      })

      return levelNodes
    }

    const rootNodes = nodes.filter(n => !n.parentId)
    const flowNodes = layoutNodes(rootNodes)
    setNodes(flowNodes as any)

    // Create edges
    const flowEdges: Edge[] = []
    const addEdges = (nodes: ResearchNode[]) => {
      nodes.forEach(node => {
        if (node.children) {
          node.children.forEach(child => {
            flowEdges.push({
              id: `${node.id}-${child.id}`,
              source: node.id,
              target: child.id,
              type: 'smoothstep',
            })
          })
          addEdges(node.children)
        }
      })
    }
    addEdges(rootNodes)
    setEdges(flowEdges as any)
  }, [nodes, setNodes, setEdges, onNodeClick, onAddLevel])

  return (
    <div className="w-full h-[600px] border rounded-lg">
      <ReactFlow
        nodes={flowNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        className="bg-background"
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}