'use client'

import { useState, useEffect } from 'react'
import { ShieldCheck, AlertTriangle, CheckCircle2, Loader2, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MetadataResult } from './types'

type Tool = 'mat2' | 'exiftool'

export default function CleanPanel({
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
