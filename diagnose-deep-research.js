// Diagnostic script to check deep research configuration

console.log('=== Deep Research Diagnostic ===\n')

// Check 1: Function exports
console.log('1. Checking function exports...')
const functions = require('./src/lib/inngest/functions')
console.log('Exported functions:', Object.keys(functions))
console.log('processDeepResearchTask exists:', 'processDeepResearchTask' in functions)

// Check 2: Function configuration
if (functions.processDeepResearchTask) {
  console.log('\n2. Checking processDeepResearchTask configuration...')
  const fn = functions.processDeepResearchTask
  console.log('Function ID:', fn.id)
  console.log('Function trigger:', JSON.stringify(fn.trigger, null, 2))
}

// Check 3: Test event structure
console.log('\n3. Test event structure...')
const testEvent = {
  name: "research/deep-research.created",
  data: {
    taskId: "test-123",
    nodeId: "node-456"
  }
}
console.log('Event:', JSON.stringify(testEvent, null, 2))

console.log('\n=== End Diagnostic ===')