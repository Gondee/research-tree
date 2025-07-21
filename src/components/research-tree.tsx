'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'

interface ResearchTreeProps {
  sessionId: string
  onNodeSelect?: (nodeId: string) => void
}

export function ResearchTree({ sessionId, onNodeSelect }: ResearchTreeProps) {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [sessionId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-muted-foreground">
        Research tree visualization will be displayed here
      </p>
    </div>
  )
}