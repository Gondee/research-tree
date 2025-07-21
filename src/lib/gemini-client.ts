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
6. Ensure all dates are in ISO format`

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
              maxOutputTokens: 32768,
              responseMimeType: 'application/json',
            },
          }),
        }
      )

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Gemini API error: ${response.status} - ${error}`)
      }

      const result = await response.json()
      const generatedContent = result.candidates[0].content.parts[0].text
      const parsedData = JSON.parse(generatedContent)

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