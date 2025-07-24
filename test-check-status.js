// Check the status of the deep research task

async function checkStatus() {
  const apiKey = process.env.OPENAI_API_KEY
  const taskId = process.argv[2] || 'resp_688265b637f4819f8597ed5bbf83edf205b958a2e89cd0e4'
  
  if (!apiKey) {
    console.error('OPENAI_API_KEY not found in environment')
    return
  }
  
  console.log('Checking status for task:', taskId)
  
  try {
    const response = await fetch(`https://api.openai.com/v1/responses/${taskId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      }
    })
    
    console.log('Response status:', response.status)
    const text = await response.text()
    console.log('Response:', JSON.stringify(JSON.parse(text), null, 2))
    
  } catch (error) {
    console.error('Error:', error)
  }
}

// Load env vars
require('dotenv').config()
checkStatus()