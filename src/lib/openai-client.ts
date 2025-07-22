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
  private client: OpenAI & {
    responses?: {
      create: (params: any) => Promise<any>
    }
  }
  private apiKey: string

  constructor(apiKey: string = process.env.OPENAI_API_KEY!) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required')
    }
    // Clean API key - remove all whitespace, newlines, and hidden characters
    const cleanApiKey = apiKey.replace(/\s+/g, '').trim()
    this.apiKey = cleanApiKey
    
    this.client = new OpenAI({
      apiKey: cleanApiKey,
    }) as any
  }

  async deepResearch({
    prompt,
    maxTime = 1200, // 20 minutes default
    includeSources = true,
    model = 'gpt-4o'
  }: DeepResearchRequest & { model?: string }): Promise<DeepResearchResponse> {
    try {
      // Check if this is a deep research model that requires the responses endpoint
      if (model.includes('deep-research')) {
        return this.deepResearchV2({ prompt, maxTime, includeSources, model })
      }

      // Otherwise use the standard chat completions endpoint
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

  private async deepResearchV2({
    prompt,
    maxTime = 1200,
    includeSources = true,
    model
  }: DeepResearchRequest & { model: string }): Promise<DeepResearchResponse> {
    try {
      const startTime = Date.now()

      // Check if the client has the responses property
      if (!this.client.responses?.create) {
        // Fallback: Use direct API call if SDK doesn't support responses yet
        return this.deepResearchV2Fallback({ prompt, maxTime, includeSources, model })
      }

      // Use the responses endpoint for deep research models
      const response = await this.client.responses.create({
        model: model,
        input: [
          {
            role: "developer",
            content: [{ 
              type: "input_text", 
              text: `You are a comprehensive research assistant. Conduct deep research on the given topic. 
              Provide detailed, well-structured information with citations where possible.
              Focus on accuracy, comprehensiveness, and clarity.` 
            }]
          },
          {
            role: "user",
            content: [{ type: "input_text", text: prompt }]
          }
        ],
        reasoning: { summary: "auto" },
        tools: includeSources ? [{ type: "web_search_preview" }] : []
      })

      const endTime = Date.now()
      const duration = Math.floor((endTime - startTime) / 1000)

      // Extract the final output
      const output = response.output || []
      const lastOutput = output[output.length - 1]
      const content = lastOutput?.content?.[0]?.text || ''

      // Extract sources from annotations if available
      let sources: DeepResearchResponse['sources'] = []
      if (includeSources && lastOutput?.content?.[0]?.annotations) {
        const annotations = lastOutput.content[0].annotations
        sources = annotations
          .filter((a: any) => a.type === 'citation')
          .slice(0, 10)
          .map((a: any) => ({
            title: a.title || `Source`,
            url: a.url || '',
            snippet: a.snippet || ''
          }))
      }

      return {
        content,
        sources,
        completedAt: new Date().toISOString(),
        duration,
      }
    } catch (error) {
      console.error('Deep research V2 failed:', error)
      throw error
    }
  }

  private async deepResearchV2Fallback({
    prompt,
    maxTime,
    includeSources,
    model
  }: DeepResearchRequest & { model: string }): Promise<DeepResearchResponse> {
    try {
      const startTime = Date.now()

      // Direct API call to responses endpoint
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: model,
          input: [
            {
              role: "developer",
              content: [{ 
                type: "input_text", 
                text: `You are a comprehensive research assistant. Conduct deep research on the given topic. 
                Provide detailed, well-structured information with citations where possible.
                Focus on accuracy, comprehensiveness, and clarity.` 
              }]
            },
            {
              role: "user",
              content: [{ type: "input_text", text: prompt }]
            }
          ],
          reasoning: { summary: "auto" },
          tools: includeSources ? [{ type: "web_search_preview" }] : []
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Deep research API error: ${response.status} - ${error}`)
      }

      const data = await response.json()
      const endTime = Date.now()
      const duration = Math.floor((endTime - startTime) / 1000)

      // Extract the final output
      const output = data.output || []
      const lastOutput = output[output.length - 1]
      const content = lastOutput?.content?.[0]?.text || ''

      // Extract sources from annotations
      let sources: DeepResearchResponse['sources'] = []
      if (includeSources && lastOutput?.content?.[0]?.annotations) {
        const annotations = lastOutput.content[0].annotations
        sources = annotations
          .filter((a: any) => a.type === 'citation')
          .slice(0, 10)
          .map((a: any) => ({
            title: a.title || `Source`,
            url: a.url || '',
            snippet: a.snippet || ''
          }))
      }

      return {
        content,
        sources,
        completedAt: new Date().toISOString(),
        duration,
      }
    } catch (error) {
      console.error('Deep research V2 fallback failed:', error)
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
        { id: 'o3-deep-research-2025-06-26', name: 'O3 Deep Research', description: 'Optimized for in-depth synthesis and research' },
        { id: 'o4-mini-deep-research-2025-06-26', name: 'O4 Mini Deep Research', description: 'Lightweight and faster deep research' },
        { id: 'gpt-4o', name: 'GPT-4 Optimized', description: 'Latest GPT-4 model' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Fast GPT-4 model' },
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and efficient' }
      ]
    }
  }
}

// Export singleton instance
export const openAIClient = new OpenAIClient()