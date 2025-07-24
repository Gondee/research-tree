import OpenAI from 'openai'

interface DeepResearchRequest {
  prompt: string
  maxTime?: number
  includeSources?: boolean
}

interface RateLimitError {
  status: number
  headers?: {
    'x-ratelimit-limit-requests'?: string
    'x-ratelimit-remaining-requests'?: string
    'x-ratelimit-reset-requests'?: string
    'retry-after'?: string
  }
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
      timeout: 60 * 60 * 1000, // 60 minutes timeout for deep research models
      maxRetries: 2,
    }) as any
    
    // Log a reminder about checking API tier
    console.log('OpenAI Client initialized. Check your API tier at https://platform.openai.com/settings/limits')
  }

  async deepResearch({
    prompt,
    maxTime = 1200, // 20 minutes default
    includeSources = true,
    model = 'gpt-4o'
  }: DeepResearchRequest & { model?: string }): Promise<DeepResearchResponse> {
    try {
      // Check if this is a reasoning/deep research model that requires the responses endpoint
      const isReasoningModel = model.includes('o1') || model.includes('o3') || 
                              model.includes('o4')
      
      if (isReasoningModel) {
        console.log(`Using /v1/responses endpoint for reasoning model: ${model}`)
        // Note: API rate limits are tier-based, not subscription-based
        // Reasoning models typically have lower RPM/TPM limits than standard models
        return this.deepResearchV2({ prompt, maxTime, includeSources, model })
      }
      
      // For deep-research models, use standard API with enhanced prompt
      if (model.includes('deep-research')) {
        console.log(`Using enhanced chat completions for deep research model: ${model}`)
        // Deep research models use standard endpoint but with special prompting
      }

      // Otherwise use the standard chat completions endpoint
      return this.retryWithExponentialBackoff(async () => {
        const startTime = Date.now()
        
        // Use the selected model for research
        const isDeepResearch = model.includes('deep-research')
        const systemPrompt = isDeepResearch 
          ? `You are an advanced deep research assistant. Your task is to conduct exhaustive, comprehensive research on the given topic.
            
            For this deep research task:
            1. Explore the topic from multiple angles and perspectives
            2. Provide in-depth analysis with extensive detail
            3. Include historical context, current state, and future implications where relevant
            4. Break down complex concepts into understandable sections
            5. Provide specific examples, case studies, and real-world applications
            6. Include statistics, data points, and quantitative analysis where applicable
            7. Address potential counterarguments or alternative viewpoints
            8. Synthesize information into actionable insights
            
            Structure your response with clear sections and subsections.
            ${includeSources ? 'Include detailed source references and citations throughout your response.' : ''}
            
            Take your time to provide a thorough, well-researched response.`
          : `You are a comprehensive research assistant. Conduct deep research on the given topic. 
            Provide detailed, well-structured information with citations where possible.
            Focus on accuracy, comprehensiveness, and clarity.
            ${includeSources ? 'Include source references in your response.' : ''}`
        
        const response = await this.client.chat.completions.create({
          model: model.includes('deep-research') ? 'gpt-4o' : model, // Use gpt-4o for deep research
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: isDeepResearch ? 0.5 : 0.7, // Lower temperature for deep research
          max_tokens: isDeepResearch ? 8000 : 4000, // More tokens for deep research
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
      })
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
      console.log(`Starting deep research with model ${model}, timeout: ${maxTime}s`)
      const response = await this.retryWithExponentialBackoff(async () => 
        this.client.responses.create({
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
      )

      const endTime = Date.now()
      const duration = Math.floor((endTime - startTime) / 1000)

      // Extract the final output
      const output = response.output || []
      const lastOutput = output[output.length - 1] as any
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

  private async retryWithExponentialBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    initialDelay = 1000
  ): Promise<T> {
    let lastError: any
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn()
      } catch (error: any) {
        lastError = error
        
        // Check if it's a rate limit error
        if (error.status === 429 || error.response?.status === 429) {
          const retryAfter = error.headers?.['retry-after'] || error.response?.headers?.['retry-after']
          const delay = retryAfter 
            ? parseInt(retryAfter) * 1000 
            : initialDelay * Math.pow(2, i) * (1 + Math.random() * 0.1) // Add jitter
          
          console.log(`Rate limit hit. Retrying after ${delay}ms (attempt ${i + 1}/${maxRetries})`)
          
          // Log rate limit details if available
          const headers = error.headers || error.response?.headers || {}
          if (headers['x-ratelimit-limit-requests']) {
            console.log(`Rate limits: ${headers['x-ratelimit-remaining-requests']}/${headers['x-ratelimit-limit-requests']} requests remaining`)
          }
          if (headers['x-ratelimit-limit-tokens']) {
            console.log(`Token limits: ${headers['x-ratelimit-remaining-tokens']}/${headers['x-ratelimit-limit-tokens']} tokens remaining`)
          }
          
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        
        // If not a rate limit error, throw immediately
        throw error
      }
    }
    
    throw lastError
  }

  private async deepResearchV2Fallback({
    prompt,
    maxTime,
    includeSources,
    model
  }: DeepResearchRequest & { model: string }): Promise<DeepResearchResponse> {
    return this.retryWithExponentialBackoff(async () => {
      const startTime = Date.now()

      // Direct API call to responses endpoint
      console.log(`Using fallback method for deep research with model ${model}`)
      
      const controller = new AbortController()
      const timeoutMs = (maxTime || 1200) * 1000
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
      
      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: controller.signal,
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
      
      clearTimeout(timeoutId)

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
    })
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
        { 
          id: 'o3-deep-research-2025-06-26', 
          name: 'O3 Deep Research', 
          description: 'Advanced reasoning with deep research capabilities' 
        },
        { 
          id: 'o4-mini-deep-research-2025-06-26', 
          name: 'O4 Mini Deep Research', 
          description: 'Lightweight reasoning model optimized for research' 
        },
        { 
          id: 'o3-mini', 
          name: 'O3 Mini', 
          description: 'Latest reasoning model (25-50 RPM, 60K-150K TPM)' 
        },
        { 
          id: 'gpt-4o', 
          name: 'GPT-4 Optimized', 
          description: 'Latest GPT-4 model with higher rate limits' 
        },
        { 
          id: 'gpt-4-turbo', 
          name: 'GPT-4 Turbo', 
          description: 'Fast GPT-4 model for production workloads' 
        },
        { 
          id: 'gpt-3.5-turbo', 
          name: 'GPT-3.5 Turbo', 
          description: 'Fast and efficient (Higher rate limits)' 
        }
      ]
    }
  }
}

// Export singleton instance
export const openAIClient = new OpenAIClient()