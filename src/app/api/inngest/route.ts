import { serve } from "inngest/next"
import { inngest } from "@/lib/inngest/client"
import { 
  processResearchTask, 
  generateTable, 
  batchProcessResearch,
  processResearchTaskV2,
  batchProcessResearchV2,
  processDeepResearchTask,
  generateAggregateTable,
  checkAndGenerateAggregateTable,
  monitorLongRunningTask,
  startTaskMonitoring
} from "@/lib/inngest/functions"

// Explicitly list all functions to ensure they're included
const allFunctions = [
  processResearchTask,
  generateTable,
  batchProcessResearch,
  processResearchTaskV2,
  batchProcessResearchV2,
  processDeepResearchTask,
  generateAggregateTable,
  checkAndGenerateAggregateTable,
  monitorLongRunningTask,
  startTaskMonitoring
]

// Debug: Log all registered functions
console.log('[INNGEST] Registering functions:', allFunctions.map(fn => fn.id))

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: allFunctions,
  signingKey: process.env.INNGEST_SIGNING_KEY,
})