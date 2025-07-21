'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Clock, Loader2 } from 'lucide-react'

interface TaskProgressProps {
  sessionId: string
}

export function TaskProgress({ sessionId }: TaskProgressProps) {
  const [progress, setProgress] = useState(30)

  useEffect(() => {
    // Simulate progress updates
    const interval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90))
    }, 2000)
    
    return () => clearInterval(interval)
  }, [sessionId])

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Active Research Tasks
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span>Processing research...</span>
                <span className="text-muted-foreground">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}