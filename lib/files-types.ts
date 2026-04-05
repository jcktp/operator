// Shared types for file management — used by API routes and page components

export interface DirEntry {
  name: string
  type: 'file' | 'dir'
  size?: number
  modifiedAt: string
  ext?: string
}

export interface FileStatus {
  relativePath: string
  analysed: boolean
  analysedAt?: string   // ISO date
  reportId?: string
  reportTitle?: string
}
