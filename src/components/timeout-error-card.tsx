import { AlertTriangle, Lightbulb } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface TimeoutErrorCardProps {
  errorMessage?: string
  taskCount?: number
}

export function TimeoutErrorCard({ errorMessage, taskCount = 1 }: TimeoutErrorCardProps) {
  const isTimeout = errorMessage?.toLowerCase().includes('timeout') || 
                   errorMessage?.includes('FUNCTION_INVOCATION_TIMEOUT')
  
  if (!isTimeout) return null
  
  return (
    <Alert className="border-orange-200 bg-orange-50">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <AlertTitle className="text-orange-800">Research Timeout</AlertTitle>
      <AlertDescription className="mt-2 text-orange-700">
        <p className="mb-3">
          Your research task exceeded the maximum runtime limit. This typically happens with:
        </p>
        <ul className="list-disc pl-5 space-y-1 mb-3">
          <li>Very broad or complex research queries</li>
          <li>Deep research models processing large amounts of data</li>
          <li>Multiple parallel tasks overwhelming the system</li>
        </ul>
        
        <div className="mt-4 p-3 bg-orange-100 rounded-md">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-orange-700 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium mb-1">Suggestions:</p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>Break your research into smaller, more focused queries</li>
                <li>Use standard models (GPT-4o) instead of deep research for faster results</li>
                <li>Reduce the number of parallel tasks (currently {taskCount})</li>
                <li>Try again with a more specific prompt</li>
              </ol>
            </div>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  )
}