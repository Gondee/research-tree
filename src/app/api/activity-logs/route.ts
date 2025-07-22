import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get("sessionId")
    const nodeId = searchParams.get("nodeId")
    const taskId = searchParams.get("taskId")
    const eventType = searchParams.get("eventType")
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "50")
    const skip = (page - 1) * limit

    // Build filter conditions
    const where: any = {}
    
    if (sessionId) {
      // Verify user owns this session
      const sessionExists = await prisma.researchSession.findFirst({
        where: {
          id: sessionId,
          userId: session.user.id,
        },
      })
      
      if (!sessionExists) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 })
      }
      
      where.sessionId = sessionId
    } else {
      // If no sessionId provided, get all logs for user's sessions
      const userSessions = await prisma.researchSession.findMany({
        where: { userId: session.user.id },
        select: { id: true },
      })
      
      where.sessionId = { in: userSessions.map(s => s.id) }
    }
    
    if (nodeId) where.nodeId = nodeId
    if (taskId) where.taskId = taskId
    if (eventType) where.eventType = eventType

    // Get total count for pagination
    const totalCount = await prisma.activityLog.count({ where })

    // Get logs with pagination
    const logs = await prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        session: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    })

    return NextResponse.json({
      logs,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
    })
  } catch (error) {
    console.error("Failed to fetch activity logs:", error)
    return NextResponse.json(
      { error: "Failed to fetch activity logs" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json()
    const {
      sessionId,
      nodeId,
      taskId,
      level,
      eventType,
      status,
      message,
      details,
      metadata,
    } = body

    // Verify user owns this session
    const sessionExists = await prisma.researchSession.findFirst({
      where: {
        id: sessionId,
        userId: session.user.id,
      },
    })
    
    if (!sessionExists) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 })
    }

    const log = await prisma.activityLog.create({
      data: {
        sessionId,
        nodeId,
        taskId,
        level: level || 0,
        eventType,
        status,
        message,
        details,
        metadata,
      },
    })

    return NextResponse.json(log)
  } catch (error) {
    console.error("Failed to create activity log:", error)
    return NextResponse.json(
      { error: "Failed to create activity log" },
      { status: 500 }
    )
  }
}