import { serve } from "inngest/next"
import { inngest } from "@/lib/inngest/client"
import * as functions from "@/lib/inngest/functions"

// Debug: Log all registered functions
console.log('[INNGEST] Registering functions:', Object.keys(functions))
console.log('[INNGEST] Function details:', Object.entries(functions).map(([name, fn]) => ({
  name,
  // @ts-ignore
  id: fn.id || 'unknown',
  // @ts-ignore
  trigger: fn.trigger || 'unknown'
})))

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: Object.values(functions),
  signingKey: process.env.INNGEST_SIGNING_KEY,
})