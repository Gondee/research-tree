'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

interface NodeDataTableProps {
  nodeId: string
}

export function NodeDataTable({ nodeId }: NodeDataTableProps) {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [nodeId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="text-center py-8">
      <p className="text-muted-foreground">
        Data table for node {nodeId} will be displayed here
      </p>
    </div>
  )
}