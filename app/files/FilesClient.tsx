'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { FileText, Image, Music, Video, File, Search, FolderOpen, Folder, ChevronRight, RefreshCw, Wand2, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import type { DirEntry, FileStatus } from '@/lib/files-types'

// ── helpers ───────────────────────────────────────────────────────────────────

const IMAGE_EXTS = new Set(['jpg','jpeg','png','webp','gif','heic'])
const AUDIO_EXTS = new Set(['mp3','wav','m4a','ogg','webm','flac','aac','opus'])
const VIDEO_EXTS = new Set(['mp4','mov','avi','mkv'])

function isMedia(ext?: string): 'image' | 'audio' | 'video' | null {
 if (!ext) return null
 if (IMAGE_EXTS.has(ext)) return 'image'
 if (AUDIO_EXTS.has(ext)) return 'audio'
 if (VIDEO_EXTS.has(ext)) return 'video'
 return null
}

function formatBytes(bytes: number): string {
 if (bytes < 1024) return `${bytes} B`
 if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
 return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso: string): string {
 return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function FileIcon({ ext }: { ext?: string }) {
 if (!ext) return <File size={14} className="shrink-0" />
 if (IMAGE_EXTS.has(ext)) return <Image size={14} className="shrink-0" />
 if (AUDIO_EXTS.has(ext)) return <Music size={14} className="shrink-0" />
 if (VIDEO_EXTS.has(ext)) return <Video size={14} className="shrink-0" />
 return <FileText size={14} className="shrink-0" />
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiFetchEntries(path: string): Promise<DirEntry[]> {
 const res = await fetch(`/api/files?path=${encodeURIComponent(path)}`)
 const data = await res.json() as { entries: DirEntry[] }
 return data.entries ?? []
}

async function fetchStatuses(paths: string[]): Promise<FileStatus[]> {
 if (!paths.length) return []
 const res = await fetch('/api/files/status', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ paths }),
 })
 const data = await res.json() as { statuses: FileStatus[] }
 return data.statuses ?? []
}

async function openPath(relativePath: string) {
 await fetch('/api/files/open', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ relativePath }),
 })
}

// ── tree types ────────────────────────────────────────────────────────────────

interface TreeNode {
 entry: DirEntry
 relativePath: string
 depth: number
 children: TreeNode[] | null // null = not yet loaded; [] = loaded, empty
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

function updateNode(
 nodes: TreeNode[],
 targetPath: string,
 updater: (n: TreeNode) => TreeNode,
): TreeNode[] {
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

// ── component ─────────────────────────────────────────────────────────────────

export default function FilesClient({
 initialEntries,
 projectFolderNames,
}: {
 initialEntries: DirEntry[]
 projectFolderNames: Set<string>
}) {
 const [nodes, setNodes] = useState<TreeNode[]>(() => toNodes(initialEntries, '', 0))
 const [query, setQuery] = useState('')
 const [refreshing, setRefreshing] = useState(false)
 const [statuses, setStatuses] = useState<Map<string, FileStatus>>(new Map())
 const [analysing, setAnalysing] = useState<string | null>(null)

 const flatNodes = useMemo(() => flattenNodes(nodes), [nodes])

 const visibleFilePaths = useMemo(
 () => flatNodes.filter(n => n.entry.type === 'file').map(n => n.relativePath),
 [flatNodes],
 )

 // Fetch analysis status for newly visible files
 const fetchedPaths = useRef(new Set<string>())
 useEffect(() => {
 const toFetch = visibleFilePaths.filter(p => !fetchedPaths.current.has(p))
 if (!toFetch.length) return
 toFetch.forEach(p => fetchedPaths.current.add(p))
 fetchStatuses(toFetch).then(ss => {
 setStatuses(prev => {
 const next = new Map(prev)
 ss.forEach(s => next.set(s.relativePath, s))
 return next
 })
 })
 }, [visibleFilePaths])

 const filtered = useMemo(() => {
 const q = query.trim().toLowerCase()
 if (!q) return flatNodes
 return flatNodes.filter(n => n.entry.name.toLowerCase().includes(q))
 }, [flatNodes, query])

 const toggleFolder = useCallback(async (targetPath: string) => {
 const current = flatNodes.find(n => n.relativePath === targetPath)
 if (!current) return

 if (!current.expanded && current.children === null) {
 setNodes(prev => updateNode(prev, targetPath, n => ({ ...n, childLoading: true })))
 const entries = await apiFetchEntries(targetPath)
 const children = toNodes(entries, targetPath, current.depth + 1)
 setNodes(prev => updateNode(prev, targetPath, n => ({
 ...n, expanded: true, childLoading: false, children,
 })))
 } else {
 setNodes(prev => updateNode(prev, targetPath, n => ({ ...n, expanded: !n.expanded })))
 }
 }, [flatNodes])

 const refresh = useCallback(async () => {
 setRefreshing(true)
 fetchedPaths.current.clear()
 const entries = await apiFetchEntries('')
 setNodes(toNodes(entries, '', 0))
 setStatuses(new Map())
 setRefreshing(false)
 }, [])

 const handleAnalyse = useCallback(async (relativePath: string) => {
 if (analysing) return
 setAnalysing(relativePath)
 const res = await fetch('/api/files/analyse', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ relativePath }),
 })
 const data = await res.json() as { report?: { id: string; createdAt: string }; error?: string }
 if (res.ok && data.report) {
 setStatuses(prev => new Map(prev).set(relativePath, {
 relativePath,
 analysed: true,
 analysedAt: data.report!.createdAt,
 reportId: data.report!.id,
 }))
 }
 setAnalysing(null)
 }, [analysing])

 return (
 <div className="flex flex-col h-full">
 {/* Header */}
 <div className="shrink-0 pb-4">
 <div className="flex items-start justify-between gap-4">
 <div>
 <h1 className="text-lg font-semibold text-[var(--text-bright)]">File Management</h1>
 <p className="text-xs text-[var(--text-muted)] mt-0.5">
 Files uploaded through Operator are saved here — drop files directly into this folder to analyse them too.
 </p>
 </div>
 <div className="flex items-center gap-2 shrink-0">
 <button
 onClick={refresh}
 disabled={refreshing}
 className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-40"
 >
 <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
 Refresh
 </button>
 <button
 onClick={() => openPath('')}
 className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[var(--ink)] text-[var(--ink-contrast)] hover:opacity-90 transition-colors"
 >
 <FolderOpen size={13} />
 Open in Finder
 </button>
 </div>
 </div>
 </div>

 {/* Search */}
 <div className="shrink-0 pb-3">
 <div className="relative">
 <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
 <input
 value={query}
 onChange={e => setQuery(e.target.value)}
 placeholder="Filter files and folders…"
 className="w-full pl-8 pr-3 py-2 text-sm rounded-[4px] border border-[var(--border)] bg-[var(--surface)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1"
 />
 </div>
 </div>

 {/* Tree */}
 <div className="flex-1 min-h-0 overflow-y-auto">
 {filtered.length === 0 ? (
 <div className="flex flex-col items-center justify-center h-48 text-[var(--text-muted)] gap-2">
 <FolderOpen size={32} strokeWidth={1.5} />
 <p className="text-sm">{query ? 'No items match' : 'Operator Reports folder is empty'}</p>
 <p className="text-xs">Files uploaded through Operator will appear here.</p>
 </div>
 ) : (
 <div>
 {filtered.map(node => {
 const isDir = node.entry.type === 'dir'
 const isProjectFolder = isDir && node.depth === 0 && projectFolderNames.has(node.entry.name)
 const status = statuses.get(node.relativePath)
 const media = isDir ? null : isMedia(node.entry.ext)
 const isAnalysable = !isDir && !media
 const isBeingAnalysed = analysing === node.relativePath

 return (
 <div key={node.relativePath} className="border-b border-[var(--border)]/60 last:border-0">
 <div
 onClick={() => isDir ? toggleFolder(node.relativePath) : openPath(node.relativePath)}
 style={{ paddingLeft: `${node.depth * 20 + 4}px` }}
 className="w-full flex items-center gap-2.5 py-2 pr-2 cursor-pointer hover:bg-[var(--surface-2)]/50 rounded transition-colors group"
 >
 {/* Chevron */}
 {isDir ? (
 <ChevronRight
 size={13}
 className={`shrink-0 text-[var(--border)] transition-transform ${node.expanded ? 'rotate-90' : ''}`}
 />
 ) : (
 <span className="w-[13px] shrink-0" />
 )}

 {/* Icon */}
 <span className={
 isDir
 ? isProjectFolder
 ? 'text-indigo-400'
 : node.expanded ? 'text-amber-500' : 'text-amber-400'
 : 'text-[var(--text-muted)]'
 }>
 {isDir
 ? node.expanded
 ? <FolderOpen size={14} className="shrink-0" />
 : <Folder size={14} className="shrink-0" />
 : <FileIcon ext={node.entry.ext} />
 }
 </span>

 {/* Name + analysis status */}
 <span className="flex-1 min-w-0">
 <span className="text-sm font-medium text-[var(--text-body)] truncate block">
 {node.entry.name}
 {node.childLoading && (
 <span className="ml-1.5 text-xs text-[var(--text-muted)]">Loading…</span>
 )}
 </span>
 {!isDir && (
 <span className="flex items-center gap-1 mt-0.5">
 {status?.analysed ? (
 <span className="flex items-center gap-1 text-[11px] text-emerald-600">
 <CheckCircle2 size={10} />
 Analysed {status.analysedAt ? formatDate(status.analysedAt) : ''}
 </span>
 ) : isBeingAnalysed ? (
 <span className="flex items-center gap-1 text-[11px] text-[var(--blue)]">
 <Loader2 size={10} className="animate-spin" />
 Analysing…
 </span>
 ) : status && !status.analysed ? (
 <span className="text-[11px] text-[var(--text-muted)]">Not yet analysed</span>
 ) : (
 <span className="text-[11px] text-[var(--border)]">—</span>
 )}
 </span>
 )}
 </span>

 {/* Right side meta */}
 <span className="shrink-0 flex items-center gap-3" onClick={e => e.stopPropagation()}>
 {!isDir && status && !status.analysed && !isBeingAnalysed && (
 isAnalysable ? (
 <button
 onClick={() => handleAnalyse(node.relativePath)}
 disabled={!!analysing}
 className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-[var(--blue)] text-[var(--blue)] hover:bg-[var(--blue-dim)] transition-colors disabled:opacity-40"
 >
 <Wand2 size={10} />
 Analyse
 </button>
 ) : (
 <Link
 href="/upload"
 onClick={e => e.stopPropagation()}
 className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--blue)] hover:border-[var(--blue)] transition-colors"
 title={`${media === 'image' ? 'Images' : 'Audio/video'} must be uploaded via Add Documents`}
 >
 <AlertCircle size={10} />
 Use Add Documents
 </Link>
 )
 )}
 {!isDir && node.entry.size !== undefined && (
 <span className="text-xs text-[var(--text-muted)]">{formatBytes(node.entry.size)}</span>
 )}
 <span className="text-xs text-[var(--text-muted)]">{formatDate(node.entry.modifiedAt)}</span>
 </span>
 </div>
 </div>
 )
 })}
 </div>
 )}
 </div>
 </div>
 )
}
