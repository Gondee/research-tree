'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ArrowLeft, Loader2, TreePine, AlertCircle } from 'lucide-react'
import { useSession } from 'next-auth/react'

export default function NewResearchPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    prompt: '',
    model: 'gpt-4o'
  })
  const [models, setModels] = useState<Array<{id: string; name: string; description?: string}>>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name.trim() || !formData.prompt.trim()) {
      setError('Please provide a name and research prompt')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      // Create the session
      const sessionRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description
        })
      })

      if (!sessionRes.ok) {
        throw new Error('Failed to create research session')
      }

      const sessionData = await sessionRes.json()

      // Start the first research task
      const researchRes = await fetch(`/api/sessions/${sessionData.id}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          promptTemplate: formData.prompt,
          parentNodeId: null,
          dataSource: null,
          modelId: formData.model
        })
      })

      if (!researchRes.ok) {
        throw new Error('Failed to start research task')
      }

      // Redirect to the session page
      router.push(`/dashboard/session/${sessionData.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setIsLoading(false)
    }
  }

  // Handle authentication
  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  // Load available models
  useEffect(() => {
    if (status === 'authenticated') {
      loadModels()
    }
  }, [status])

  const loadModels = async () => {
    try {
      const res = await fetch('/api/models')
      if (res.ok) {
        const data = await res.json()
        setModels(data.models)
        // Set default to deep-research model if available
        const deepResearchModel = data.models.find((m: any) => m.id.includes('deep-research'))
        if (deepResearchModel) {
          setFormData(prev => ({ ...prev, model: deepResearchModel.id }))
        }
      }
    } catch (error) {
      console.error('Failed to load models:', error)
    }
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Link 
            href="/dashboard" 
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-8"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to dashboard
          </Link>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 mb-2">
                <TreePine className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl">Start New Research</CardTitle>
              </div>
              <CardDescription>
                Create a new research session to explore topics in depth using AI
              </CardDescription>
            </CardHeader>

            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6">
                {error && (
                  <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="name">Research Name*</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Market Analysis for AI Tools"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    disabled={isLoading}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Give your research project a descriptive name
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of your research goals..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    disabled={isLoading}
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Add context about what you're trying to achieve
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">AI Model*</Label>
                  <Select
                    value={formData.model}
                    onValueChange={(value) => setFormData({ ...formData, model: value })}
                    disabled={isLoading || models.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          <div>
                            <div className="font-medium">{model.name}</div>
                            {model.description && (
                              <div className="text-xs text-muted-foreground">{model.description}</div>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Choose the AI model for your research. Deep Research models are optimized for comprehensive analysis.
                  </p>
                  {(formData.model.includes('o3') || formData.model.includes('o1')) && (
                    <Alert className="mt-2">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        <strong>API Rate Limits:</strong> Reasoning models have stricter limits:
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li>o3-mini: 25-50 RPM, 60K-150K TPM (tier-based)</li>
                          <li>Lower limits than GPT-4o models</li>
                          <li>Tier upgrades based on API spending</li>
                        </ul>
                        Consider GPT-4o for higher volume tasks or if hitting limits.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prompt">Initial Research Prompt*</Label>
                  <Textarea
                    id="prompt"
                    placeholder="What would you like to research? Be as specific as possible..."
                    value={formData.prompt}
                    onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                    disabled={isLoading}
                    required
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    This prompt will be sent to the selected AI model to start your research
                  </p>
                </div>
              </CardContent>

              <CardFooter className="flex gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push('/dashboard')}
                  disabled={isLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading} className="flex-1">
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Starting Research...
                    </>
                  ) : (
                    'Start Research'
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>

          <div className="mt-8 space-y-4 text-sm text-muted-foreground">
            <h3 className="font-semibold text-foreground">What happens next?</h3>
            <ul className="space-y-2 list-disc list-inside">
              <li>Your research prompt will be processed by OpenAI's Deep Research API</li>
              <li>The AI will conduct comprehensive research and return detailed findings</li>
              <li>You can then structure the data into tables using Google Gemini</li>
              <li>Use the structured data to spawn new research tasks, building a knowledge tree</li>
              <li>Export your findings as CSV for further analysis</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}