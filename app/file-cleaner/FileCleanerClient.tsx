'use client'

import { useState, useCallback } from 'react'
import { RefreshCw } from 'lucide-react'
import type { MetadataResult } from './types'
import FilePicker from './FilePicker'
import MetadataInspector from './MetadataInspector'
import CleanPanel from './CleanPanel'

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
