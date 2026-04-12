'use client'

import { useState, useCallback, useEffect } from 'react'
import { Loader2, ChevronRight, Folder, FolderOpen, FileText, Image, Music, Video, File } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAT2_EXTENSIONS, EXIFTOOL_EXTENSIONS } from '@/lib/file-cleaner-shared'
import type { DirEntry } from '@/lib/files-types'

// ── Helpers ──────────────────────────────────────────────────────────────────

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic', 'tiff', 'tif'])
const AUDIO_EXTS = new Set(['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac', 'opus'])
const VIDEO_EXTS = new Set(['mp4', 'mov', 'avi', 'mkv'])

function isCleanable(ext?: string): boolean {
 if (!ext) return false
 return MAT2_EXTENSIONS.has(ext) || EXIFTOOL_EXTENSIONS.has(ext)
}

function FileIcon({ ext }: { ext?: string }) {
 if (!ext) return <File size={14} className="shrink-0" />
 if (IMAGE_EXTS.has(ext)) return <Image size={14} className="shrink-0" />
 if (AUDIO_EXTS.has(ext)) return <Music size={14} className="shrink-0" />
 if (VIDEO_EXTS.has(ext)) return <Video size={14} className="shrink-0" />
 return <FileText size={14} className="shrink-0" />
}

// ── Tree types & functions ───────────────────────────────────────────────────

interface TreeNode {
 entry: DirEntry
 relativePath: string
 depth: number
 children: TreeNode[] | null
 expanded: boolean
 childLoading: boolean
}

function toNodes(entries: DirEntry[], parentPath: string, depth: number): TreeNode[] {
 return entries.map(e => ({
 entry: e,
 relativePath: parentPath ? `${parentPath}/${e.name}` : e.name,
 depth,
 children: null,
 expanded: false,
 childLoading: false,
 }))
}

function updateNode(nodes: TreeNode[], targetPath: string, updater: (n: TreeNode) => TreeNode): TreeNode[] {
 return nodes.map(n => {
 if (n.relativePath === targetPath) return updater(n)
 if (n.children) return { ...n, children: updateNode(n.children, targetPath, updater) }
 return n
 })
}

function flattenNodes(nodes: TreeNode[]): TreeNode[] {
 const result: TreeNode[] = []
 for (const n of nodes) {
 result.push(n)
 if (n.expanded && n.children) result.push(...flattenNodes(n.children))
 }
 return result
}

// ── Component ────────────────────────────────────────────────────────────────

export default function FilePicker({
 selected,
 onSelect,
}: {
 selected: string | null
 onSelect: (path: string) => void
}) {
 const [nodes, setNodes] = useState<TreeNode[]>([])
 const [loading, setLoading] = useState(true)

 const loadEntries = useCallback(async (path: string): Promise<DirEntry[]> => {
 const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`)
 const data = await res.json() as { entries: DirEntry[] }
 return data.entries ?? []
 }, [])

 useEffect(() => {
 loadEntries('').then(entries => {
 setNodes(toNodes(entries, '', 0))
 setLoading(false)
 })
 }, [loadEntries])

 const toggleFolder = useCallback(async (targetPath: string) => {
 const flat = flattenNodes(nodes)
 const current = flat.find(n => n.relativePath === targetPath)
 if (!current) return

 if (!current.expanded && current.children === null) {
 setNodes(prev => updateNode(prev, targetPath, n => ({ ...n, childLoading: true })))
 const entries = await loadEntries(targetPath)
 const children = toNodes(entries, targetPath, current.depth + 1)
 setNodes(prev => updateNode(prev, targetPath, n => ({
 ...n, expanded: true, childLoading: false, children,
 })))
 } else {
 setNodes(prev => updateNode(prev, targetPath, n => ({ ...n, expanded: !n.expanded })))
 }
 }, [nodes, loadEntries])

 const flat = flattenNodes(nodes)

 if (loading) {
 return (
 <div className="flex items-center justify-center h-32 text-[var(--text-muted)]">
 <Loader2 size={18} className="animate-spin" />
 </div>
 )
 }

 if (flat.length === 0) {
 return (
 <div className="flex flex-col items-center justify-center h-32 text-[var(--text-muted)] gap-1.5 text-sm">
 <FolderOpen size={24} strokeWidth={1.5} />
 <span>No cleanable files found</span>
 </div>
 )
 }

 return (
 <div className="overflow-y-auto flex-1 min-h-0">
 {flat.map(node => {
 const isDir = node.entry.type === 'dir'
 const isSelected = node.relativePath === selected

 return (
 <div
 key={node.relativePath}
 onClick={() => isDir ? toggleFolder(node.relativePath) : isCleanable(node.entry.ext) ? onSelect(node.relativePath) : undefined}
 style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
 className={cn(
 'flex items-center gap-2 py-1.5 pr-3 text-sm rounded-[4px] transition-colors',
 isSelected
 ? 'bg-[var(--blue-dim)] text-indigo-700'
 : isDir
 ? 'text-[var(--text-body)] hover:bg-[var(--surface-2)]'
 : isCleanable(node.entry.ext)
 ? 'text-[var(--text-body)] hover:bg-[var(--surface-2)]'
 : "text-[var(--text-muted)] opacity-50 cursor-not-allowed"
 )}
 >
 {isDir ? (
 <ChevronRight size={12} className={cn('shrink-0 text-[var(--text-muted)] transition-transform', node.expanded && 'rotate-90')} />
 ) : (
 <span className="w-3 shrink-0" />
 )}
 <span className={isDir ? 'text-amber-500' : 'text-[var(--text-muted)]'}>
 {isDir
 ? node.expanded ? <FolderOpen size={14} className="shrink-0" /> : <Folder size={14} className="shrink-0" />
 : <FileIcon ext={node.entry.ext} />
 }
 </span>
 <span className="truncate text-xs">{node.entry.name}</span>
 {node.childLoading && <Loader2 size={10} className="animate-spin ml-auto shrink-0 text-[var(--text-muted)]" />}
 </div>
 )
 })}
 </div>
 )
}
