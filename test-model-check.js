// Test to verify model ID checking logic

const modelIds = [
  'o3-deep-research-2025-06-26',
  'o4-mini-deep-research-2025-06-26',
  'o3-mini',
  'gpt-4o',
  'gpt-4-turbo'
]

modelIds.forEach(modelId => {
  const isDeepResearch = modelId.includes('deep-research')
  const isReasoningModel = modelId.includes('o1') || 
                          modelId.includes('o3') || 
                          modelId.includes('deep-research')
  
  console.log(`Model: ${modelId}`)
  console.log(`  - Is deep research: ${isDeepResearch}`)
  console.log(`  - Is reasoning model: ${isReasoningModel}`)
  console.log(`  - Event name: ${isDeepResearch ? 'research/deep-research.created' : 'research/task.created'}`)
  console.log('')
})