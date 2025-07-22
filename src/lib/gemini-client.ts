interface GeminiTableRequest {
  prompt: string
  context: string[]
  outputFormat?: 'json' | 'csv'
}

interface GeminiTableResponse {
  tableData: any[]
  columns: Array<{
    id: string
    header: string
    type: string
  }>
  rowCount: number
}

export class GeminiClient {
  private apiKey: string
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta'

  constructor(apiKey: string = process.env.GEMINI_API_KEY!) {
    if (!apiKey) {
      throw new Error('Gemini API key is required')
    }
    this.apiKey = apiKey
  }

  async generateTable({
    prompt,
    context,
    outputFormat = 'json',
  }: GeminiTableRequest): Promise<GeminiTableResponse> {
    try {
      // Prepare the system prompt for structured output
      const systemPrompt = `You are a data extraction and structuring expert. 
Your task is to analyze the provided research reports and extract structured data according to the user's prompt.
You must return a valid JSON object with the following structure:
{
  "columns": [
    {
      "id": "column_key",
      "header": "Display Name",
      "type": "text|number|date|boolean|json"
    }
  ],
  "data": [
    {
      "column_key": "value",
      ...
    }
  ]
}

Important rules:
1. Column IDs must be valid JavaScript identifiers (no spaces, start with letter)
2. Maintain consistency across all rows
3. Handle missing data with null values
4. For lists, use JSON arrays
5. For complex data, use nested JSON objects
6. Ensure all dates are in ISO format
7. BE CONCISE: Limit text fields to essential information only
8. AVOID REPETITION: Do not duplicate information across columns
9. SUMMARIZE: Long descriptions should be condensed to key points
10. Maximum 200 characters per text field unless absolutely necessary`

      const response = await fetch(
        `${this.baseUrl}/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: systemPrompt },
                  { text: `User request: ${prompt}` },
                  ...context.map((c, i) => ({
                    text: `Research Report ${i + 1}:\n${c}`,
                  })),
                ],
              },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 30000, // Slightly reduced to ensure complete responses
              responseMimeType: 'application/json',
            },
            safetySettings: [
              {
                category: 'HARM_CATEGORY_HARASSMENT',
                threshold: 'BLOCK_ONLY_HIGH'
              },
              {
                category: 'HARM_CATEGORY_HATE_SPEECH',
                threshold: 'BLOCK_ONLY_HIGH'
              },
              {
                category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                threshold: 'BLOCK_ONLY_HIGH'
              },
              {
                category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
                threshold: 'BLOCK_ONLY_HIGH'
              }
            ],
          }),
        }
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Gemini API error: ${response.status} - ${error}`)
      }

      const result = await response.json()
      
      // Check if we have valid candidates
      if (!result.candidates || result.candidates.length === 0) {
        throw new Error('No candidates returned from Gemini API')
      }
      
      // Check if content was filtered or blocked
      if (result.candidates[0].finishReason === 'SAFETY') {
        throw new Error('Content was blocked by safety filters')
      }
      
      // Check for truncation
      if (result.candidates[0].finishReason === 'MAX_TOKENS') {
        console.warn('Gemini response was truncated due to token limit')
      }
      
      const generatedContent = result.candidates[0].content.parts[0].text
      
      // Try to parse the JSON with better error handling
      let parsedData
      try {
        parsedData = JSON.parse(generatedContent)
      } catch (parseError) {
        console.error('Failed to parse Gemini response as JSON:', parseError)
        console.error('Response content length:', generatedContent.length)
        console.error('First 500 chars:', generatedContent.substring(0, 500))
        console.error('Last 500 chars:', generatedContent.substring(generatedContent.length - 500))
        
        // Check if response was truncated (incomplete JSON)
        if (parseError instanceof SyntaxError && parseError.message.includes('Unterminated')) {
          throw new Error(`Gemini response appears to be truncated. The response was ${generatedContent.length} characters long and may have exceeded the token limit. Consider reducing the amount of input data or breaking it into smaller batches.`)
        }
        
        throw new Error(`Failed to parse Gemini response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
      }
      
      // Validate the parsed data structure
      if (!parsedData.data || !Array.isArray(parsedData.data)) {
        throw new Error('Invalid response structure: missing or invalid "data" array')
      }
      
      if (!parsedData.columns || !Array.isArray(parsedData.columns)) {
        throw new Error('Invalid response structure: missing or invalid "columns" array')
      }

      return {
        tableData: parsedData.data,
        columns: parsedData.columns,
        rowCount: parsedData.data.length,
      }
    } catch (error) {
      console.error('Table generation failed:', error)
      throw error
    }
  }

  async processLargeContext(
    prompt: string,
    contexts: string[],
    batchSize: number = 10
  ): Promise<GeminiTableResponse[]> {
    const results: GeminiTableResponse[] = []
    
    // Process in batches to handle large datasets
    for (let i = 0; i < contexts.length; i += batchSize) {
      const batch = contexts.slice(i, i + batchSize)
      const result = await this.generateTable({
        prompt,
        context: batch,
      })
      results.push(result)
    }

    // Merge results
    if (results.length === 1) {
      return results
    }

    // Combine multiple table results
    const combinedData: any[] = []
    let columns = results[0].columns

    for (const result of results) {
      combinedData.push(...result.tableData)
    }

    return [{
      tableData: combinedData,
      columns,
      rowCount: combinedData.length,
    }]
  }
}

// Export singleton instance
export const geminiClient = new GeminiClient()