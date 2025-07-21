'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info, Loader2 } from 'lucide-react'

interface NextLevelResearchModalProps {
  open: boolean
  onClose: () => void
  parentNodeId: string
  sessionId: string
  tableColumns: string[]
  rowCount: number
  onSuccess: () => void
}

export function NextLevelResearchModal({
  open,
  onClose,
  parentNodeId,
  sessionId,
  tableColumns,
  rowCount,
  onSuccess
}: NextLevelResearchModalProps) {
  const [promptTemplate, setPromptTemplate] = useState('')
  const [modelId, setModelId] = useState('gpt-4o')
  const [geminiPrompt, setGeminiPrompt] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [models, setModels] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    // Load available models
    fetch('/api/models')
      .then(res => res.json())
      .then(data => setModels(data))
      .catch(console.error)
  }, [])

  const handleSubmit = async () => {
    if (!promptTemplate.trim() || !geminiPrompt.trim()) {
      alert('Please fill in all fields')
      return
    }

    setIsSubmitting(true)
    try {
      const response = await fetch(`/api/sessions/${sessionId}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptTemplate,
          parentNodeId,
          dataSource: 'table', // Indicates this uses parent table data
          modelId,
          geminiPrompt
        })
      })

      if (!response.ok) {
        throw new Error('Failed to start research')
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error starting next level research:', error)
      alert('Failed to start research. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const examplePrompt = tableColumns.length > 0
    ? `Research the latest developments and detailed information about {{${tableColumns[0]}}}`
    : 'Research detailed information about {{column_name}}'

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Start Next Level Research</DialogTitle>
          <DialogDescription>
            This will create {rowCount} parallel research tasks, one for each row in the parent table.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <p className="font-semibold mb-2">Available variables from parent table:</p>
              <div className="flex flex-wrap gap-2">
                {tableColumns.map(col => (
                  <code key={col} className="bg-muted px-2 py-1 rounded text-sm">
                    {`{{${col}}}`}
                  </code>
                ))}
              </div>
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="prompt">Research Prompt Template</Label>
            <Textarea
              id="prompt"
              placeholder={examplePrompt}
              value={promptTemplate}
              onChange={(e) => setPromptTemplate(e.target.value)}
              rows={4}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Use variables like {`{{column_name}}`} to insert data from each row
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">AI Model</Label>
            <Select value={modelId} onValueChange={setModelId}>
              <SelectTrigger id="model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {models.map(model => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="gemini-prompt">Table Generation Prompt</Label>
            <Textarea
              id="gemini-prompt"
              placeholder="Extract key findings and structure them into a table with columns: finding, impact, source"
              value={geminiPrompt}
              onChange={(e) => setGeminiPrompt(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Describe how Gemini should structure the combined research results
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting {rowCount} tasks...
              </>
            ) : (
              `Start ${rowCount} Research Tasks`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}