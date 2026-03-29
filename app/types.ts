// Shared application types — import from here rather than redefining locally

export interface Message {
  role: 'user' | 'assistant'
  content: string
  attachmentName?: string
}

export interface DirectReport {
  id: string
  name: string
  title: string
  email?: string
  phone?: string
  area: string
  notes?: string
  createdAt: string
  reports: { createdAt: string; area: string }[]
}

export interface Report {
  id: string
  title: string
  area: string
  summary: string | null
  metrics: string | null
  comparison: string | null
  questions: string | null
  fileType: string | null
  createdAt: string
  directReportId: string | null
  directReportName: string | null
}
