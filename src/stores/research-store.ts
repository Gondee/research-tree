import { create } from 'zustand'
import { ResearchSession, ResearchNode, ProgressUpdate } from '@/types'

interface ResearchStore {
  sessions: ResearchSession[]
  activeSession: ResearchSession | null
  activeNode: ResearchNode | null
  isLoading: boolean
  error: string | null

  // Actions
  loadSessions: () => Promise<void>
  loadSession: (id: string) => Promise<void>
  createSession: (name: string, description?: string) => Promise<string>
  deleteSession: (id: string) => Promise<void>
  
  startResearch: (params: {
    sessionId: string
    parentNodeId?: string
    promptTemplate: string
    dataSource?: {
      tableId: string
      columns: string[]
    }
  }) => Promise<void>
  
  setActiveNode: (node: ResearchNode | null) => void
  updateProgress: (nodeId: string, progress: ProgressUpdate) => void
  clearError: () => void
}

export const useResearchStore = create<ResearchStore>((set, get) => ({
  sessions: [],
  activeSession: null,
  activeNode: null,
  isLoading: false,
  error: null,

  loadSessions: async () => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/sessions')
      if (!response.ok) throw new Error('Failed to load sessions')
      const sessions = await response.json()
      set({ sessions, isLoading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load sessions',
        isLoading: false 
      })
    }
  },

  loadSession: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`/api/sessions/${id}`)
      if (!response.ok) throw new Error('Failed to load session')
      const session = await response.json()
      set({ activeSession: session, isLoading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to load session',
        isLoading: false 
      })
    }
  },

  createSession: async (name: string, description?: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      })
      if (!response.ok) throw new Error('Failed to create session')
      const session = await response.json()
      
      // Add to sessions list
      set(state => ({
        sessions: [session, ...state.sessions],
        isLoading: false,
      }))
      
      return session.id
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create session',
        isLoading: false 
      })
      throw error
    }
  },

  deleteSession: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`/api/sessions/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete session')
      
      // Remove from sessions list
      set(state => ({
        sessions: state.sessions.filter(s => s.id !== id),
        activeSession: state.activeSession?.id === id ? null : state.activeSession,
        isLoading: false,
      }))
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete session',
        isLoading: false 
      })
    }
  },

  startResearch: async (params) => {
    set({ isLoading: true, error: null })
    try {
      const response = await fetch(`/api/sessions/${params.sessionId}/research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentNodeId: params.parentNodeId,
          promptTemplate: params.promptTemplate,
          dataSource: params.dataSource,
        }),
      })
      if (!response.ok) throw new Error('Failed to start research')
      
      // Reload session to get updated tree
      await get().loadSession(params.sessionId)
      
      set({ isLoading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to start research',
        isLoading: false 
      })
      throw error
    }
  },

  setActiveNode: (node) => {
    set({ activeNode: node })
  },

  updateProgress: (nodeId, progress) => {
    set(state => {
      if (!state.activeSession) return state
      
      // Update node progress in active session
      const updateNodeProgress = (nodes: ResearchNode[]): ResearchNode[] => {
        return nodes.map(node => {
          if (node.id === nodeId) {
            // Calculate status based on progress
            let status: ResearchNode['status'] = 'processing'
            if (progress.completedTasks + progress.failedTasks === progress.totalTasks) {
              status = progress.failedTasks > 0 ? 'failed' : 'completed'
            }
            
            return {
              ...node,
              status,
              tasks: node.tasks?.map(task => {
                const progressTask = progress.tasks.find(t => t.id === task.id)
                if (progressTask) {
                  return { ...task, status: progressTask.status as any }
                }
                return task
              }),
            }
          }
          
          if (node.children) {
            return {
              ...node,
              children: updateNodeProgress(node.children),
            }
          }
          
          return node
        })
      }
      
      return {
        activeSession: {
          ...state.activeSession,
          nodes: updateNodeProgress(state.activeSession.nodes || []),
        },
      }
    })
  },

  clearError: () => {
    set({ error: null })
  },
}))