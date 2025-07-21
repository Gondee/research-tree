'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowLeft, Loader2, TreePine } from 'lucide-react'
import { useSession } from 'next-auth/react'

export default function NewResearchPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    prompt: ''
  })

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
      const researchRes = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionData.id,
          prompt: formData.prompt,
          parentNodeId: null
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
                    This prompt will be sent to OpenAI's Deep Research API to start your research
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