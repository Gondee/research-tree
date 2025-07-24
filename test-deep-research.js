// Quick test to check if the deep research API endpoint works

async function testDeepResearch() {
  const apiKey = process.env.OPENAI_API_KEY
  
  if (!apiKey) {
    console.error('OPENAI_API_KEY not found in environment')
    return
  }
  
  console.log('Testing deep research API endpoint...')
  
  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        input: [
          {
            role: "user",
            content: [{
              type: "input_text",
              text: "What is the capital of France?"
            }]
          }
        ],
        background: true,
        store: true
      })
    })
    
    console.log('Response status:', response.status)
    const text = await response.text()
    console.log('Response:', text)
    
    if (response.ok) {
      const data = JSON.parse(text)
      console.log('Success! Task ID:', data.id)
    }
  } catch (error) {
    console.error('Error:', error)
  }
}

// Load env vars
require('dotenv').config()
testDeepResearch()