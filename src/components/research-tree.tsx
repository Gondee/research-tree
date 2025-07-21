'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronRight, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ResearchTreeProps {
  sessionId: string
  onNodeSelect?: (nodeId: string) => void
}

interface TreeNode {
  id: string
  title?: string
  promptTemplate: string
  status: string
  level: number
  children?: TreeNode[]
  _count?: {
    tasks: number
  }
}

export function ResearchTree({ sessionId, onNodeSelect }: ResearchTreeProps) {
  const [nodes, setNodes] = useState<TreeNode[]>([])
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadNodes()
  }, [sessionId])

  const loadNodes = async () => {
    try {
      const res = await fetch(`/api/sessions/${sessionId}`)
      if (res.ok) {
        const data = await res.json()
        // Build tree structure from flat nodes array
        const nodeMap = new Map<string, TreeNode>()
        const rootNodes: TreeNode[] = []
        
        // First pass: create all nodes
        data.nodes?.forEach((node: any) => {
          nodeMap.set(node.id, {
            ...node,
            children: []
          })
        })
        
        // Second pass: build tree structure
        data.nodes?.forEach((node: any) => {
          const treeNode = nodeMap.get(node.id)!
          if (node.parentId) {
            const parent = nodeMap.get(node.parentId)
            if (parent) {
              parent.children = parent.children || []
              parent.children.push(treeNode)
            }
          } else {
            rootNodes.push(treeNode)
          }
        })
        
        setNodes(rootNodes)
        // Select first node by default
        if (rootNodes.length > 0 && !selectedNodeId) {
          handleNodeClick(rootNodes[0].id)
        }
      }
    } catch (error) {
      console.error('Failed to load nodes:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleNodeClick = (nodeId: string) => {
    setSelectedNodeId(nodeId)
    onNodeSelect?.(nodeId)
  }

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isSelected = node.id === selectedNodeId
    const hasChildren = node.children && node.children.length > 0
    
    return (
      <div key={node.id} className="w-full">
        <Button
          variant={isSelected ? "secondary" : "ghost"}
          className={cn(
            "w-full justify-start mb-1 text-left",
            depth > 0 && "ml-6"
          )}
          onClick={() => handleNodeClick(node.id)}
        >
          <div className="flex items-center gap-2 w-full">
            <ChevronRight className={cn(
              "h-4 w-4 transition-transform",
              hasChildren && "rotate-90"
            )} />
            <FileText className="h-4 w-4" />
            <div className="flex-1 truncate">
              <div className="font-medium text-sm">
                Level {node.level} Research
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {node.promptTemplate.substring(0, 50)}...
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn(
                "text-xs px-2 py-1 rounded-full",
                node.status === 'completed' && "bg-green-100 text-green-700",
                node.status === 'processing' && "bg-blue-100 text-blue-700",
                node.status === 'pending' && "bg-gray-100 text-gray-700",
                node.status === 'failed' && "bg-red-100 text-red-700"
              )}>
                {node.status}
              </span>
            </div>
          </div>
        </Button>
        
        {hasChildren && (
          <div className="ml-2">
            {node.children!.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No research nodes yet</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-2">
      {nodes.map(node => renderNode(node))}
    </div>
  )
}