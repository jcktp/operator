'use client'

import { Loader2, CheckCircle2, ShieldOff, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { SENSITIVE_TAG_PREFIXES } from '@/lib/file-cleaner-shared'
import type { MetadataResult } from './types'

// ── Helpers ──────────────────────────────────────────────────────────────────

function isSensitiveTag(key: string): boolean {
 const lower = key.toLowerCase()
 return SENSITIVE_TAG_PREFIXES.some(p => lower.startsWith(p))
}

function formatTagValue(v: unknown): string {
 if (v === null || v === undefined) return '—'
 if (typeof v === 'object') return JSON.stringify(v)
 return String(v)
}

// ── Component ────────────────────────────────────────────────────────────────

export default function MetadataInspector({
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
