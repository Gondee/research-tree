interface DeepResearchRequest {
  prompt: string
  maxTime?: number
  includeSources?: boolean
}

interface DeepResearchResponse {
  content: string
  sources?: Array<{
    title: string
    url: string
    snippet: string
  }>
  completedAt: string
  duration: number
}

export class OpenAIClient {
  private apiKey: string
  private baseUrl = 'https://api.openai.com/v1'

  constructor(apiKey: string = process.env.OPENAI_API_KEY!) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required')
    }
    // Clean API key - remove all whitespace, newlines, and hidden characters
    this.apiKey = apiKey.replace(/\s+/g, '').trim()
  }

  async deepResearch({
    prompt,
    maxTime = 1200, // 20 minutes default
    includeSources = true,
  }: DeepResearchRequest): Promise<DeepResearchResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/deep-research`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deep-research-v1',
          prompt,
          max_time: maxTime,
          include_sources: includeSources,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI API error: ${response.status} - ${error}`)
      }

      const data = await response.json()
      
      return {
        content: data.content,
        sources: data.sources,
        completedAt: new Date().toISOString(),
        duration: data.duration || 0,
      }
    } catch (error) {
      console.error('Deep research failed:', error)
      throw error
    }
  }

  async checkResearchStatus(taskId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed'
    progress?: number
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/deep-research/status/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to check status: ${response.status}`)
      }

      return response.json()
    } catch (error) {
      console.error('Status check failed:', error)
      throw error
    }
  }
}

// Export singleton instance
export const openAIClient = new OpenAIClient()