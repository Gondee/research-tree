import { inngest } from "../client"

// Simplified test function to verify deep research events
export const testDeepResearchEvent = inngest.createFunction(
  {
    id: "test-deep-research-event",
    retries: 0,
  },
  { event: "research/deep-research.created" },
  async ({ event, step }) => {
    console.log('[TEST-DEEP-RESEARCH] Event received!')
    console.log('[TEST-DEEP-RESEARCH] Event data:', JSON.stringify(event, null, 2))
    
    // Just log and return - no actual processing
    return {
      success: true,
      eventData: event.data,
      timestamp: new Date().toISOString()
    }
  }
)