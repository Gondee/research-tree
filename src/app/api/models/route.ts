import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { openAIClient } from "@/lib/openai-client"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const models = await openAIClient.listModels()
    
    return NextResponse.json({ models })
  } catch (error) {
    console.error("Failed to list models:", error)
    return NextResponse.json(
      { error: "Failed to list models" },
      { status: 500 }
    )
  }
}