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
  }: DeepResearchRequest): Promise<DeepResearchResponse> {
    try {
      const startTime = Date.now()
      
      // Use the deep research model with web search capabilities
      const response = await this.client.chat.completions.create({
        model: "gpt-4o",  // Using GPT-4o as Deep Research API isn't publicly available yet
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
}

// Export singleton instance
export const openAIClient = new OpenAIClient()