'use client'

import { useState, useCallback, useEffect } from 'react'
import { ShieldCheck, ShieldOff, AlertTriangle, CheckCircle2, Loader2, Download, Eye, RefreshCw, ChevronRight, Folder, FolderOpen, FileText, Image, Music, Video, File } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MAT2_EXTENSIONS, EXIFTOOL_EXTENSIONS, SENSITIVE_TAG_PREFIXES } from '@/lib/file-cleaner-shared'
import type { DirEntry } from '@/lib/files-types'

// ── Types ─────────────────────────────────────────────────────────────────────

interface MetadataResult {
 tags: Record<string, unknown>
 mat2Supported: boolean
 exiftoolSupported: boolean
}

type Tool = 'mat2' | 'exiftool'

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function isSensitiveTag(key: string): boolean {
 const lower = key.toLowerCase()
 return SENSITIVE_TAG_PREFIXES.some(p => lower.startsWith(p))
}

function formatTagValue(v: unknown): string {
 if (v === null || v === undefined) return '—'
 if (typeof v === 'object') return JSON.stringify(v)
 return String(v)
}

// ── File Picker ───────────────────────────────────────────────────────────────

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

function FilePicker({
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

// ── Metadata Inspector ────────────────────────────────────────────────────────

function MetadataInspector({
 relativePath,
 metadata,
 loading,
}: {
 relativePath: string | null
 metadata: MetadataResult | null
 loading: boolean
}) {
 if (!relativePath) {
 return (
 <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] gap-2">
 <Eye size={24} strokeWidth={1.5} />
 <span className="text-sm">Select a file to inspect its metadata</span>
 </div>
 )
 }

 if (loading) {
 return (
 <div className="flex items-center justify-center h-full text-[var(--text-muted)]">
 <Loader2 size={18} className="animate-spin" />
 </div>
 )
 }

 if (!metadata) {
 return (
 <div className="flex items-center justify-center h-full text-[var(--red)] text-sm">
 Failed to read metadata
 </div>
 )
 }

 const entries = Object.entries(metadata.tags)
 const sensitive = entries.filter(([k]) => isSensitiveTag(k))
 const other = entries.filter(([k]) => !isSensitiveTag(k))

 return (
 <div className="flex flex-col h-full overflow-hidden">
 {/* Tool support badges */}
 <div className="shrink-0 flex items-center gap-2 pb-3">
 <span className={cn(
 'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-[4px] font-medium',
 metadata.mat2Supported
 ? 'bg-emerald-50 text-emerald-700'
 : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
 )}>
 {metadata.mat2Supported ? <CheckCircle2 size={10} /> : <ShieldOff size={10} />}
 MAT2 {metadata.mat2Supported ? 'supported' : 'unsupported'}
 </span>
 <span className={cn(
 'flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-[4px] font-medium',
 metadata.exiftoolSupported
 ? 'bg-emerald-50 text-emerald-700'
 : 'bg-[var(--surface-2)] text-[var(--text-muted)]'
 )}>
 {metadata.exiftoolSupported ? <CheckCircle2 size={10} /> : <ShieldOff size={10} />}
 ExifTool {metadata.exiftoolSupported ? 'supported' : 'unsupported'}
 </span>
 </div>

 {/* Tag table */}
 <div className="flex-1 min-h-0 overflow-y-auto">
 {entries.length === 0 ? (
 <p className="text-xs text-[var(--text-muted)] text-center pt-8">No metadata found</p>
 ) : (
 <table className="w-full text-xs border-collapse">
 <tbody>
 {/* Sensitive tags first */}
 {sensitive.length > 0 && (
 <>
 <tr>
 <td colSpan={2} className="pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--amber)]">
 Sensitive
 </td>
 </tr>
 {sensitive.map(([k, v]) => (
 <tr key={k} className="border-b border-amber-100/30">
 <td className="py-1 pr-3 font-medium text-amber-700 w-2/5 truncate align-top">{k}</td>
 <td className="py-1 text-[var(--amber)] break-words">{formatTagValue(v)}</td>
 </tr>
 ))}
 </>
 )}
 {/* Other tags */}
 {other.length > 0 && (
 <>
 <tr>
 <td colSpan={2} className="pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
 All Tags
 </td>
 </tr>
 {other.map(([k, v]) => (
 <tr key={k} className="border-b border-[var(--border)]/50">
 <td className="py-1 pr-3 font-medium text-[var(--text-subtle)] w-2/5 truncate align-top">{k}</td>
 <td className="py-1 text-[var(--text-muted)] break-words">{formatTagValue(v)}</td>
 </tr>
 ))}
 </>
 )}
 </tbody>
 </table>
 )}
 </div>
 </div>
 )
}

// ── Clean Panel ───────────────────────────────────────────────────────────────

function CleanPanel({
 relativePath,
 metadata,
 onCleaned,
}: {
 relativePath: string | null
 metadata: MetadataResult | null
 onCleaned: (cleanedPath: string) => void
}) {
 const [tool, setTool] = useState<Tool>('mat2')
 const [cleaning, setCleaning] = useState(false)
 const [cleanedPath, setCleanedPath] = useState<string | null>(null)
 const [error, setError] = useState<string | null>(null)

 // Reset when file selection changes
 useEffect(() => {
 setCleanedPath(null)
 setError(null)
 // Default to mat2 if supported, otherwise exiftool
 if (metadata) {
 setTool(metadata.mat2Supported ? 'mat2' : 'exiftool')
 }
 }, [relativePath, metadata])

 const handleClean = async () => {
 if (!relativePath) return
 setCleaning(true)
 setCleanedPath(null)
 setError(null)

 try {
 const res = await fetch('/api/files/clean', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ relativePath, tool }),
 })
 const data = await res.json() as { cleanedRelativePath?: string; error?: string }
 if (!res.ok || data.error) {
 setError(data.error ?? 'Cleaning failed')
 } else if (data.cleanedRelativePath) {
 setCleanedPath(data.cleanedRelativePath)
 onCleaned(data.cleanedRelativePath)
 }
 } catch {
 setError('Network error')
 } finally {
 setCleaning(false)
 }
 }

 if (!relativePath || !metadata) {
 return (
 <div className="flex flex-col items-center justify-center h-full text-[var(--text-muted)] gap-2">
 <ShieldCheck size={24} strokeWidth={1.5} />
 <span className="text-sm text-center">Select a file to strip its metadata</span>
 </div>
 )
 }

 const canUseMat2 = metadata.mat2Supported
 const canUseExifTool = metadata.exiftoolSupported
 const canClean = canUseMat2 || canUseExifTool

 return (
 <div className="flex flex-col gap-4">
 <div>
 <h3 className="text-xs font-semibold text-[var(--text-body)] mb-2">Cleaning tool</h3>
 <div className="space-y-2">
 {/* MAT2 option */}
 <label className={cn(
 'flex items-start gap-3 p-3 rounded-[4px] border cursor-pointer transition-colors',
 !canUseMat2 && 'opacity-40 cursor-not-allowed',
 tool === 'mat2' && canUseMat2
 ? 'border-indigo-300 bg-[var(--blue-dim)]/50'
 : 'border-[var(--border)] hover:border-[var(--border-mid)]'
 )}>
 <input
 type="radio"
 name="tool"
 value="mat2"
 checked={tool === 'mat2'}
 disabled={!canUseMat2}
 onChange={() => setTool('mat2')}
 className="mt-0.5"
 />
 <div>
 <div className="text-xs font-medium text-[var(--text-body)]">MAT2 — Strip all metadata</div>
 <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
 Broad format support: PDF, DOCX, XLSX, ODF, EPUB, images, audio, video
 </div>
 </div>
 </label>

 {/* ExifTool option */}
 <label className={cn(
 'flex items-start gap-3 p-3 rounded-[4px] border cursor-pointer transition-colors',
 !canUseExifTool && 'opacity-40 cursor-not-allowed',
 tool === 'exiftool' && canUseExifTool
 ? 'border-indigo-300 bg-[var(--blue-dim)]/50'
 : 'border-[var(--border)] hover:border-[var(--border-mid)]'
 )}>
 <input
 type="radio"
 name="tool"
 value="exiftool"
 checked={tool === 'exiftool'}
 disabled={!canUseExifTool}
 onChange={() => setTool('exiftool')}
 className="mt-0.5"
 />
 <div>
 <div className="text-xs font-medium text-[var(--text-body)]">ExifTool — Strip EXIF tags</div>
 <div className="text-[11px] text-[var(--text-muted)] mt-0.5">
 Best for images, audio, video — removes all writable EXIF/IPTC/XMP tags
 </div>
 </div>
 </label>
 </div>
 </div>

 {/* Warning */}
 <div className="flex items-start gap-2 p-3 rounded-[4px] bg-[var(--amber-dim)]/40 border border-[var(--amber)]">
 <AlertTriangle size={13} className="shrink-0 mt-0.5 text-[var(--amber)]" />
 <p className="text-[11px] text-[var(--amber)]">
 Cleaned files are saved alongside the original with a <code className="font-mono">.cleaned.</code> suffix. The original is never modified.
 </p>
 </div>

 {/* Clean button */}
 <button
 onClick={handleClean}
 disabled={cleaning || !canClean}
 className={cn(
 'flex items-center justify-center gap-2 w-full py-2 rounded-[4px] text-sm font-medium transition-colors',
 canClean && !cleaning
 ? 'bg-[var(--ink)] text-white hover:opacity-90'
 : 'bg-[var(--surface-2)] text-[var(--text-muted)] cursor-not-allowed'
 )}
 >
 {cleaning ? (
 <>
 <Loader2 size={14} className="animate-spin" />
 Cleaning…
 </>
 ) : (
 <>
 <ShieldCheck size={14} />
 Clean File
 </>
 )}
 </button>

 {/* Error */}
 {error && (
 <div className="flex items-start gap-2 p-3 rounded-[4px] bg-[var(--red-dim)]/40 border border-[var(--red)]">
 <AlertTriangle size={13} className="shrink-0 mt-0.5 text-[var(--red)]" />
 <p className="text-[11px] text-[var(--red)]">{error}</p>
 </div>
 )}

 {/* Success + download */}
 {cleanedPath && (
 <div className="flex flex-col gap-2 p-3 rounded-[4px] bg-emerald-50/40 border border-emerald-200">
 <div className="flex items-center gap-2">
 <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />
 <span className="text-[11px] font-medium text-emerald-700">Metadata stripped successfully</span>
 </div>
 <a
 href={`/api/files/download?path=${encodeURIComponent(cleanedPath)}`}
 download
 className="flex items-center justify-center gap-2 w-full py-2 rounded-[4px] text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
 >
 <Download size={13} />
 Download Cleaned File
 </a>
 </div>
 )}
 </div>
 )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FileCleanerClient() {
 const [selected, setSelected] = useState<string | null>(null)
 const [metadata, setMetadata] = useState<MetadataResult | null>(null)
 const [metaLoading, setMetaLoading] = useState(false)
 const [reloadKey, setReloadKey] = useState(0)

 const handleSelect = useCallback(async (path: string) => {
 setSelected(path)
 setMetadata(null)
 setMetaLoading(true)

 try {
 const res = await fetch("/api/files/metadata", {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ relativePath: path }),
 })
 const data = await res.json() as MetadataResult
 setMetadata(data)
 } catch {
 setMetadata(null)
 } finally {
 setMetaLoading(false)
 }
 }, [])

 const handleCleaned = useCallback((_cleanedPath: string) => {
 setReloadKey(k => k + 1)
 }, [])

 return (
 <div className="flex flex-col h-full">
 {/* Header */}
 <div className="shrink-0 pb-4">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-lg font-semibold text-[var(--text-bright)]">File Cleaner</h1>
 <p className="text-xs text-[var(--text-muted)] mt-0.5">
 Inspect and strip metadata from files before publishing or sharing.
 </p>
 </div>
 <button
 onClick={() => { setSelected(null); setMetadata(null); setReloadKey(k => k + 1) }}
 className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--surface-2)] transition-colors"
 >
 <RefreshCw size={12} />
 Refresh
 </button>
 </div>
 </div>

 {/* Three-panel layout */}
 <div className="flex-1 min-h-0 flex gap-4">
 {/* Left: File picker */}
 <div className="w-[28%] shrink-0 flex flex-col border border-[var(--border)] rounded-[4px] overflow-hidden">
 <div className="shrink-0 px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-2)]/50">
 <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Files</span>
 </div>
 <div className="flex-1 min-h-0 p-1">
 <FilePicker key={reloadKey} selected={selected} onSelect={handleSelect} />
 </div>
 </div>

 {/* Middle: Metadata inspector */}
 <div className="flex-1 min-w-0 flex flex-col border border-[var(--border)] rounded-[4px] overflow-hidden">
 <div className="shrink-0 px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-2)]/50">
 <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Metadata</span>
 </div>
 <div className="flex-1 min-h-0 p-3">
 <MetadataInspector
 relativePath={selected}
 metadata={metadata}
 loading={metaLoading}
 />
 </div>
 </div>

 {/* Right: Clean action */}
 <div className="w-[28%] shrink-0 flex flex-col border border-[var(--border)] rounded-[4px] overflow-hidden">
 <div className="shrink-0 px-3 py-2 border-b border-[var(--border)] bg-[var(--surface-2)]/50">
 <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">Clean</span>
 </div>
 <div className="flex-1 min-h-0 overflow-y-auto p-3">
 <CleanPanel
 relativePath={selected}
 metadata={metadata}
 onCleaned={handleCleaned}
 />
 </div>
 </div>
 </div>
 </div>
 )
}
