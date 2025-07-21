import OpenAI from 'openai'

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
  private client: OpenAI

  constructor(apiKey: string = process.env.OPENAI_API_KEY!) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required')
    }
    // Clean API key - remove all whitespace, newlines, and hidden characters
    const cleanApiKey = apiKey.replace(/\s+/g, '').trim()
    
    this.client = new OpenAI({
      apiKey: cleanApiKey,
    })
  }

  async deepResearch({
    prompt,
    maxTime = 1200, // 20 minutes default
    includeSources = true,
    model = 'gpt-4o'
  }: DeepResearchRequest & { model?: string }): Promise<DeepResearchResponse> {
    try {
      const startTime = Date.now()
      
      // Use the selected model for research
      const response = await this.client.chat.completions.create({
        model: model,
        messages: [
          {
            role: "system",
            content: `You are a comprehensive research assistant. Conduct deep research on the given topic. 
            Provide detailed, well-structured information with citations where possible.
            Focus on accuracy, comprehensiveness, and clarity.
            ${includeSources ? 'Include source references in your response.' : ''}`
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      })

      const endTime = Date.now()
      const duration = Math.floor((endTime - startTime) / 1000)

      // Extract content from response
      const content = response.choices[0]?.message?.content || ''

      // Parse sources from content if requested
      let sources: DeepResearchResponse['sources'] = []
      if (includeSources) {
        // Extract URLs from the content using regex
        const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g
        const urls = content.match(urlRegex) || []
        
        sources = urls.slice(0, 5).map((url, index) => ({
          title: `Source ${index + 1}`,
          url: url,
          snippet: ''
        }))
      }

      return {
        content,
        sources,
        completedAt: new Date().toISOString(),
        duration,
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
    // Since we're using synchronous completion, always return completed
    return {
      status: 'completed',
      progress: 100
    }
  }

  async listModels(): Promise<Array<{ id: string; name: string; description?: string }>> {
    try {
      const response = await this.client.models.list()
      
      // Filter for models that support chat/completion
      const chatModels = response.data
        .filter(model => 
          model.id.includes('gpt') || 
          model.id.includes('o3') || 
          model.id.includes('o4') ||
          model.id.includes('deep-research')
        )
        .map(model => ({
          id: model.id,
          name: model.id.replace(/-/g, ' ').replace(/_/g, ' '),
          description: model.id.includes('deep-research') 
            ? 'Optimized for in-depth research and synthesis'
            : model.id.includes('o3') 
            ? 'Advanced reasoning model'
            : 'General purpose model'
        }))
        .sort((a, b) => {
          // Prioritize deep-research models
          if (a.id.includes('deep-research')) return -1
          if (b.id.includes('deep-research')) return 1
          return a.id.localeCompare(b.id)
        })
      
      return chatModels
    } catch (error) {
      console.error('Failed to list models:', error)
      // Return fallback models if API fails
      return [
        { id: 'gpt-4o', name: 'GPT-4 Optimized', description: 'Latest GPT-4 model' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Fast GPT-4 model' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and efficient' }
      ]
    }
  }
}

// Export singleton instance
export const openAIClient = new OpenAIClient()