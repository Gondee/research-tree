'use client'

import React from 'react'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Info } from 'lucide-react'

interface PromptEditorProps {
  template: string
  availableVariables: string[]
  onChange: (template: string) => void
  label?: string
  description?: string
}

export function PromptEditor({
  template,
  availableVariables,
  onChange,
  label = "Prompt Template",
  description,
}: PromptEditorProps) {
  const [focused, setFocused] = React.useState(false)
  
  // Extract variables from template
  const usedVariables = React.useMemo(() => {
    const matches = template.match(/{([^}]+)}/g)
    return matches ? matches.map(match => match.slice(1, -1)) : []
  }, [template])

  // Check for undefined variables
  const undefinedVariables = React.useMemo(() => {
    return usedVariables.filter(v => !availableVariables.includes(v))
  }, [usedVariables, availableVariables])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="prompt-template">{label}</Label>
        {description && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Info className="h-3 w-3" />
            <span>{description}</span>
          </div>
        )}
      </div>
      
      <Textarea
        id="prompt-template"
        value={template}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder="Enter your research prompt template..."
        className="min-h-[150px] font-mono text-sm"
      />

      {(focused || undefinedVariables.length > 0) && (
        <Card className="bg-muted/50">
          <CardContent className="p-3 space-y-3">
            {availableVariables.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2">Available Variables:</p>
                <div className="flex flex-wrap gap-1">
                  {availableVariables.map((variable) => (
                    <Badge
                      key={variable}
                      variant={usedVariables.includes(variable) ? "default" : "outline"}
                      className="text-xs cursor-pointer"
                      onClick={() => {
                        const cursorPos = (document.getElementById('prompt-template') as HTMLTextAreaElement)?.selectionStart || template.length
                        const before = template.slice(0, cursorPos)
                        const after = template.slice(cursorPos)
                        onChange(`${before}{${variable}}${after}`)
                      }}
                    >
                      {variable}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {undefinedVariables.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-2 text-destructive">
                  Undefined Variables:
                </p>
                <div className="flex flex-wrap gap-1">
                  {undefinedVariables.map((variable) => (
                    <Badge
                      key={variable}
                      variant="destructive"
                      className="text-xs"
                    >
                      {variable}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground">
              <p>Use {'{variable_name}'} to insert dynamic values from your table data.</p>
              <p>Example: "Research the competitive landscape for {'{company_name}'} in {'{region}'}"</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}