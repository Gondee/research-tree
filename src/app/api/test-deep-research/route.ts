import { NextResponse } from "next/server"
import { inngest } from "@/lib/inngest/client"

export async function POST() {
  try {
    console.log('[TEST] Manually sending deep research event')
    
    // Send a test event
    const result = await inngest.send({
      name: "research/deep-research.created",
      data: {
        taskId: "test-task-" + Date.now(),
        nodeId: "test-node-" + Date.now(),
      },
    })
    
    console.log('[TEST] Event sent result:', result)
    
    return NextResponse.json({
      success: true,
      result,
      message: "Test deep research event sent. Check Inngest dashboard."
    })
  } catch (error) {
    console.error('[TEST] Error sending event:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
}