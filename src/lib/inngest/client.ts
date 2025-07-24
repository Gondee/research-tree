import { Inngest } from "inngest"

export const inngest = new Inngest({ 
  id: "research-tree",
  // In development, Inngest works without event keys
  // In production, set INNGEST_EVENT_KEY in your environment
  eventKey: process.env.INNGEST_EVENT_KEY || undefined,
})