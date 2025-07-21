export interface User {
  id: string
  email: string
  name?: string
  createdAt: Date
  updatedAt: Date
}

export interface ResearchSession {
  id: string
  userId: string
  name: string
  description?: string
  status: 'active' | 'completed' | 'archived'
  nodes?: ResearchNode[]
  createdAt: Date
  updatedAt: Date
}

export interface ResearchNode {
  id: string
  sessionId: string
  parentId?: string
  parent?: ResearchNode
  children?: ResearchNode[]
  level: number
  promptTemplate: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  tasks?: ResearchTask[]
  tableConfig?: TableConfig
  generatedTable?: GeneratedTable
  startedAt?: Date
  completedAt?: Date
  createdAt: Date
}

export interface ResearchTask {
  id: string
  nodeId: string
  rowIndex: number
  prompt: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  openaiResponse?: string
  errorMessage?: string
  retryCount: number
  startedAt?: Date
  completedAt?: Date
  createdAt: Date
}

export interface TableConfig {
  id: string
  nodeId: string
  geminiPrompt: string
  inputData: any
  outputSchema?: any
  createdAt: Date
}

export interface GeneratedTable {
  id: string
  nodeId: string
  tableConfigId?: string
  tableData: any
  version: number
  edited: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CreateResearchRequest {
  parentNodeId?: string
  promptTemplate: string
  dataSource?: {
    tableId: string
    columns: string[]
  }
}

export interface CreateTableRequest {
  geminiPrompt: string
}

export interface ProgressUpdate {
  nodeId: string
  totalTasks: number
  completedTasks: number
  failedTasks: number
  tasks: Array<{
    id: string
    status: string
    duration?: number
  }>
}

export interface TableColumn {
  id: string
  header: string
  accessor: string
  type?: 'text' | 'number' | 'date' | 'boolean' | 'json'
}

export interface TableRow {
  [key: string]: any
}