import { Inngest } from "inngest"

export const inngest = new Inngest({ 
  id: "research-tree",
  eventKey: process.env.INNGEST_EVENT_KEY
})