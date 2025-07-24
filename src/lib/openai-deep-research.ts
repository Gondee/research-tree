import { OpenAI } from 'openai'

export interface DeepResearchRequest {
  prompt: string
  model?: string
  includeSources?: boolean
  userLocation?: {
    country?: string
    city?: string
    region?: string
  }
}

export interface DeepResearchResponse {
  id: string
  status: 'queued' | 'in_progress' | 'completed' | 'failed'
  output?: any[]
  error?: string
  createdAt?: string
  completedAt?: string
}

export class DeepResearchClient {
  private client: OpenAI
  private apiKey: string

  constructor(apiKey: string = process.env.OPENAI_API_KEY!) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required')
    }
    this.apiKey = apiKey.replace(/\s+/g, '').trim()
    
    this.client = new OpenAI({
      apiKey: this.apiKey,
      timeout: 120 * 1000, // 2 minutes for initial request
      maxRetries: 2,
    })
  }

  /**
   * Start a deep research task in background mode
   * Returns immediately with a task ID
   */
  async startDeepResearch({
    prompt,
    model = 'o3-deep-research-2025-06-26',
    includeSources = true,
    userLocation
  }: DeepResearchRequest): Promise<{ id: string; status: string }> {
    try {
      console.log(`Starting deep research with model ${model} in background mode`)
      console.log(`API Key present: ${!!this.apiKey}, Key length: ${this.apiKey?.length}`)
      
      const tools = []
      if (includeSources) {
        const webSearchTool: any = { type: 'web_search_preview' }
        if (userLocation) {
          webSearchTool.user_location = {
            type: 'approximate',
            ...userLocation
          }
        }
        tools.push(webSearchTool)
      }

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          input: [
            {
              role: "developer",
              content: [{
                type: "input_text",
                text: `You are a professional research assistant. Conduct exhaustive, comprehensive research on the given topic.
                
                For this deep research task:
                1. Search and analyze multiple authoritative sources
                2. Provide in-depth analysis with extensive detail
                3. Include statistics, data points, and quantitative analysis
                4. Present multiple perspectives and viewpoints
                5. Include specific examples and case studies
                6. Synthesize information into actionable insights
                
                Structure your response with clear sections and include inline citations.`
              }]
            },
            {
              role: "user",
              content: [{
                type: "input_text",
                text: prompt
              }]
            }
          ],
          reasoning: {
            summary: "auto"
          },
          tools,
          background: true, // Enable background mode for async processing
          store: true // Required for background mode
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Deep research API error: ${response.status} - ${error}`)
      }

      const data = await response.json()
      console.log(`Deep research task started with ID: ${data.id}`)
      
      return {
        id: data.id,
        status: data.status || 'queued'
      }
    } catch (error) {
      console.error('Failed to start deep research:', error)
      throw error
    }
  }

  /**
   * Poll for the status of a deep research task
   */
  async checkDeepResearchStatus(taskId: string): Promise<DeepResearchResponse> {
    try {
      const response = await fetch(`https://api.openai.com/v1/responses/${taskId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        }
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to check status: ${response.status} - ${error}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Failed to check deep research status:', error)
      throw error
    }
  }

  /**
   * Extract the final research content from a completed response
   */
  extractResearchContent(response: DeepResearchResponse): {
    content: string
    sources: Array<{ title: string; url: string; snippet: string }>
    reasoning?: string
  } {
    if (response.status !== 'completed' || !response.output) {
      throw new Error('Response is not completed or has no output')
    }

    // Extract the final content (usually the last output item)
    const finalOutput = response.output[response.output.length - 1]
    const content = finalOutput?.content?.[0]?.text || ''

    // Extract sources from web search results
    const sources: Array<{ title: string; url: string; snippet: string }> = []
    const webSearchResults = response.output.filter((item: any) => 
      item.type === 'web_search_result'
    )
    
    webSearchResults.forEach((result: any) => {
      if (result.citations) {
        result.citations.forEach((citation: any) => {
          sources.push({
            title: citation.title || 'Source',
            url: citation.url || '',
            snippet: citation.snippet || ''
          })
        })
      }
    })

    // Extract reasoning summary if available
    const reasoningItem = response.output.find((item: any) => 
      item.type === 'reasoning'
    )
    const reasoning = reasoningItem?.summary?.map((s: any) => s.text).join('\n')

    return {
      content,
      sources: sources.slice(0, 10), // Limit to 10 sources
      reasoning
    }
  }

  /**
   * Wait for a deep research task to complete with polling
   * @param taskId The task ID to poll
   * @param maxAttempts Maximum number of polling attempts (default: 60 for 30 minutes)
   * @param pollInterval Interval between polls in milliseconds (default: 30 seconds)
   */
  async waitForCompletion(
    taskId: string, 
    maxAttempts: number = 60,
    pollInterval: number = 30000
  ): Promise<DeepResearchResponse> {
    let attempts = 0
    
    while (attempts < maxAttempts) {
      const response = await this.checkDeepResearchStatus(taskId)
      
      if (response.status === 'completed' || response.status === 'failed') {
        return response
      }
      
      attempts++
      console.log(`Deep research task ${taskId} status: ${response.status} (attempt ${attempts}/${maxAttempts})`)
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval))
    }
    
    throw new Error(`Deep research task ${taskId} timed out after ${maxAttempts} attempts`)
  }
}

// Export a singleton instance
export const deepResearchClient = new DeepResearchClient()