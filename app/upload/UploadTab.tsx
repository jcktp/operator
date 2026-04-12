'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Image as ImageIcon, Mic, X, Loader2, CheckCircle, AlertCircle, Globe, ChevronDown, Plus, GitMerge } from 'lucide-react'
import { type QueuedItem, type DirectReport, LINK_LABELS, detectLinkType, guessArea, fileId } from './uploadTypes'
import { useMode } from '@/components/ModeContext'
import SelectField from '@/components/SelectField'

interface SeriesCandidate {
 count: number
 area: string
 directReportId: string | null
 existingSeriesId: string | null
 reportId: string
}

const QUEUE_LIMIT = 5

export default function UploadTab() {
 const router = useRouter()
 const modeConfig = useMode()
 const [queue, setQueue] = useState<QueuedItem[]>([])
 const [defaultArea, setDefaultArea] = useState('')
 const [directReportId, setDirectReportId] = useState('')
 const [reportDate, setReportDate] = useState('')
 const [directs, setDirects] = useState<DirectReport[]>([])
 const [directsLoaded, setDirectsLoaded] = useState(false)
 const [submitting, setSubmitting] = useState(false)
 const [processingIndex, setProcessingIndex] = useState(0)
 const [processingTotal, setProcessingTotal] = useState(0)
 const [allDone, setAllDone] = useState(false)
 const [dragging, setDragging] = useState(false)
 const [seriesCandidate, setSeriesCandidate] = useState<SeriesCandidate | null>(null)
 const [seriesLinked, setSeriesLinked] = useState(false)
 const [seriesLinking, setSeriesLinking] = useState(false)
 const [selectedProjectId, setSelectedProjectId] = useState('')
 const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([])
 const [projectsLoaded, setProjectsLoaded] = useState(false)
 const [linkInput, setLinkInput] = useState('')
 const [linkError, setLinkError] = useState('')
 const [extractText, setExtractText] = useState(false)
 const [audioCapable, setAudioCapable] = useState<boolean | null>(null)
 const [audioReason, setAudioReason] = useState<string | null>(null)

 const loadDirects = useCallback(async () => {
 if (directsLoaded) return
 const res = await fetch('/api/directs')
 const data = await res.json() as { directs?: DirectReport[] }
 setDirects(data.directs ?? [])
 setDirectsLoaded(true)
 }, [directsLoaded])

 const loadProjects = useCallback(async () => {
 if (projectsLoaded) return
 const res = await fetch('/api/projects')
 const data = await res.json() as { projects?: Array<{ id: string; name: string; status: string }>; currentProjectId?: string | null }
 const list = (data.projects ?? []).filter(p => p.status === 'in_progress')
 setProjects(list)
 if (data.currentProjectId) setSelectedProjectId(data.currentProjectId)
 setProjectsLoaded(true)
 }, [projectsLoaded])

 useEffect(() => { loadProjects() }, [loadProjects])

 const hasAudio = queue.some(q => q.type === 'file' && q.file && /\.(mp3|wav|m4a|ogg|webm|flac|aac|opus)$/i.test(q.file.name))
 useEffect(() => {
 if (!hasAudio || audioCapable !== null) return
 fetch('/api/audio-check')
 .then(r => r.json())
 .then((d: { capable: boolean; reason?: string }) => {
 setAudioCapable(d.capable)
 setAudioReason(d.reason ?? null)
 })
 .catch(() => {})
 }, [hasAudio, audioCapable])

 const addFiles = (files: FileList | File[]) => {
 const newItems: QueuedItem[] = Array.from(files).map(f => ({
 id: fileId(), type: 'file', file: f,
 title: f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
 area: guessArea(f.name, modeConfig.defaultAreas),
 status: 'pending',
 }))
 setQueue(prev => [...prev, ...newItems])
 }

 const addLink = () => {
 const url = linkInput.trim()
 if (!url) return
 const linkType = detectLinkType(url)
 if (!linkType) { setLinkError('Paste a Google Docs, Sheets, or Slides link'); return }
 setLinkError('')
 const id = fileId()
 setQueue(prev => [...prev, { id, type: 'link', url, linkType, title: '', area: defaultArea, status: 'pending' }])
 setLinkInput('')
 // Auto-fetch document title in the background
 fetch(`/api/upload-link?url=${encodeURIComponent(url)}`)
 .then(r => r.json())
 .then((d: { title?: string }) => {
 if (d.title) setQueue(prev => prev.map(q => q.id === id ? { ...q, title: d.title! } : q))
 })
 .catch(() => {})
 }

 const handleDrop = useCallback((e: React.DragEvent) => {
 e.preventDefault(); setDragging(false)
 if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [])

 const updateItem = (id: string, patch: Partial<QueuedItem>) =>
 setQueue(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q))

 const removeItem = (id: string) => setQueue(prev => prev.filter(q => q.id !== id))

 const applyDefaultArea = () => {
 if (!defaultArea) return
 setQueue(prev => prev.map(q => q.status === 'pending' ? { ...q, area: defaultArea } : q))
 }

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault()
 const pendingItems = queue.filter(q => q.status === 'pending')
 if (pendingItems.length === 0 || submitting) return
 if (pendingItems.find(q => !q.area)) { alert('Please select an area for all files'); return }

 // Use background mode for file uploads (not links — links are fast)
 const fileItems = pendingItems.filter(q => q.type === 'file')
 const linkItems = pendingItems.filter(q => q.type === 'link')
 const useBackground = fileItems.length > 0

 setSubmitting(true)
 setProcessingIndex(1)
 setProcessingTotal(pendingItems.length)

 if (useBackground && fileItems.length > 0) {
 // Background mode: send files for queued analysis, return immediately
 let jobId: string | null = null
 let idx = 0
 for (const item of fileItems) {
 idx++
 setProcessingIndex(idx)
 updateItem(item.id, { status: 'analyzing' })
 if (!item.file) continue
 try {
 const formData = new FormData()
 formData.append('file', item.file)
 formData.append('title', item.title)
 formData.append('area', item.area)
 if (directReportId) formData.append('directReportId', directReportId)
 if (reportDate) formData.append('reportDate', reportDate)
 if (selectedProjectId) formData.append('projectId', selectedProjectId)
 if (jobId) formData.append('jobId', jobId)
 formData.append('sortOrder', String(idx - 1))
 if (extractText && item.file?.type.startsWith('image/')) formData.append('extractText', 'true')
 const res = await fetch('/api/upload-background', { method: 'POST', body: formData })
 const data = await res.json() as { error?: string; jobId?: string; itemId?: string }
 if (!res.ok) {
 updateItem(item.id, { status: 'error', error: data.error ?? 'Failed' })
 } else {
 jobId = data.jobId ?? jobId
 updateItem(item.id, { status: 'done' })
 }
 } catch {
 updateItem(item.id, { status: 'error', error: 'Network error' })
 }
 }
 }

 // Process link items synchronously (they hit external URLs, no AI wait)
 for (const item of linkItems) {
 updateItem(item.id, { status: 'analyzing' })
 try {
 const res = await fetch('/api/upload-link', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ url: item.url, title: item.title, area: item.area, directReportId: directReportId || null, reportDate: reportDate || null, projectId: selectedProjectId || null }),
 })
 const data = await res.json() as { error?: string; report?: { id: string }; seriesCandidate?: SeriesCandidate }
 if (!res.ok) updateItem(item.id, { status: 'error', error: data.error ?? 'Failed' })
 else {
 updateItem(item.id, { status: 'done', reportId: data.report?.id })
 if (data.seriesCandidate && data.report?.id) {
 setSeriesCandidate({ ...data.seriesCandidate, reportId: data.report.id })
 }
 }
 } catch {
 updateItem(item.id, { status: 'error', error: 'Network error' })
 }
 }

 setSubmitting(false)
 setAllDone(true)
 }

 const doneCount = queue.filter(q => q.status === 'done').length
 const errorCount = queue.filter(q => q.status === 'error').length
 const pendingCount = queue.filter(q => q.status === 'pending').length
 const lastDoneId = queue.filter(q => q.status === 'done').at(-1)?.reportId
 const allHaveArea = queue.filter(q => q.status === 'pending').every(q => q.area)

 return (
 <form onSubmit={handleSubmit} className="space-y-5">
 {/* Drop zone */}
 <div
 onDragOver={e => { e.preventDefault(); setDragging(true) }}
 onDragLeave={() => setDragging(false)}
 onDrop={handleDrop}
 onClick={() => document.getElementById('file-input')?.click()}
 className={`border-2 border-dashed rounded-[10px] p-6 text-center transition-colors cursor-pointer ${dragging ? 'border-[var(--border-mid)] bg-[var(--surface-2)]' : 'border-[var(--border)] hover:border-[var(--border-mid)] hover:bg-[var(--surface-2)]'}`}
 >
 <input id="file-input" type="file" multiple accept={modeConfig.acceptedFileTypes} className="hidden"
 onChange={e => { if (e.target.files?.length) addFiles(e.target.files) }} />
 <Upload size={18} className="text-[var(--text-muted)] mx-auto mb-2" />
 <p className="text-sm text-[var(--text-subtle)] font-medium">Drop files here or click to browse</p>
 <p className="text-xs text-[var(--text-muted)] mt-1">
 PDF, Word, Excel, CSV, text
 {modeConfig.acceptedFileTypes.includes('.jpg') ? ', photos (JPG, PNG, WEBP)' : ''}
 {', audio (MP3, WAV, M4A)'}
 {' '}— multiple files at once
 </p>
 </div>

 {/* Google link input */}
 <div className="flex flex-col gap-1.5">
 <div className="flex gap-2">
 <div className="relative flex-1">
 <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
 <input type="url" value={linkInput}
 onChange={e => { setLinkInput(e.target.value); setLinkError('') }}
 onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }}
 placeholder="Paste a Google Docs, Sheets, or Slides link…"
 className="w-full border border-[var(--border)] rounded-[4px] pl-8 pr-3 py-2 text-sm text-[var(--text-bright)] focus:outline-none focus:ring-2 placeholder-gray-400"
 />
 </div>
 <button type="button" onClick={addLink} disabled={!linkInput.trim()}
 className="shrink-0 px-3 py-2 text-xs font-medium bg-[var(--surface-2)] text-[var(--text-body)] rounded-[4px] hover:bg-[var(--surface-3)] transition-colors disabled:opacity-40">
 Add link
 </button>
 </div>
 {linkError && <p className="text-xs text-[var(--red)]">{linkError}</p>}
 <p className="text-xs text-[var(--text-muted)]">Document must be shared as &quot;Anyone with the link can view&quot;</p>
 </div>

 {/* Queue */}
 {queue.length > 0 && (
 <div className="space-y-2">
 {queue.map(item => (
 <div key={item.id} className={`bg-[var(--surface)] border rounded-[10px] px-4 py-3 transition-colors ${
 item.status === 'done' ? 'border-[var(--green)] bg-[var(--green-dim)]' :
 item.status === 'error' ? 'border-[var(--red)] bg-[var(--red-dim)]' :
 item.status === 'analyzing' || item.status === 'uploading' ? 'border-blue-200 bg-blue-50' :
 !item.area ? 'border-[var(--amber)]' : 'border-[var(--border)]'
 }`}>
 <div className="flex items-center gap-3">
 <div className="shrink-0">
 {item.status === 'done' && <CheckCircle size={16} className="text-[var(--green)]" />}
 {item.status === 'error' && <AlertCircle size={16} className="text-[var(--red)]" />}
 {(item.status === 'uploading' || item.status === 'analyzing') && <Loader2 size={16} className="animate-spin text-blue-500" />}
 {item.status === 'pending' && item.type === 'link' && <Globe size={16} className="text-indigo-400" />}
 {item.status === 'pending' && item.type === 'file' && (
 item.file && item.file.type.startsWith('image/')
 ? <ImageIcon size={16} className="text-blue-400" />
 : item.file && /\.(mp3|wav|m4a|ogg|webm|flac|aac|opus)$/i.test(item.file.name)
 ? <Mic size={16} className="text-amber-400" />
 : <FileText size={16} className="text-[var(--text-muted)]" />
 )}
 </div>
 <div className="flex-1 min-w-0">
 {item.status === 'pending' ? (
 <input type="text" value={item.title} onChange={e => updateItem(item.id, { title: e.target.value })}
 placeholder="Report title"
 className="w-full text-sm text-[var(--text-bright)] bg-transparent border-0 outline-none placeholder-gray-400" />
 ) : (
 <p className={`text-sm font-medium truncate ${item.status === 'done' ? 'text-green-800' : item.status === 'error' ? 'text-red-700' : 'text-blue-800'}`}>{item.title}</p>
 )}
 <p className="text-xs text-[var(--text-muted)] truncate">
 {item.type === 'link' ? (item.linkType ? LINK_LABELS[item.linkType] : 'Link') : item.file?.name}
 </p>
 {item.status === 'analyzing' && <p className="text-xs text-blue-500 mt-0.5">Analyzing…</p>}
 {item.status === 'error' && item.error && <p className="text-xs text-[var(--red)] mt-0.5">{item.error}</p>}
 {item.status === 'done' && item.reportId && (
 <a href={`/reports/${item.reportId}`} className="text-xs text-[var(--green)] hover:underline mt-0.5 inline-block">View report →</a>
 )}
 {item.status === 'done' && !item.reportId && (
 <p className="text-xs text-blue-600 mt-0.5">Queued — analysis running in background</p>
 )}
 </div>
 {item.status === 'pending' && (
 <div className="shrink-0 relative">
 <select value={item.area} onChange={e => updateItem(item.id, { area: e.target.value })}
 className={`text-xs border rounded-[4px] pl-2 pr-6 py-1.5 focus:outline-none focus:ring-1 bg-[var(--surface)] appearance-none cursor-pointer ${!item.area ? 'border-amber-300 text-[var(--amber)]' : 'border-[var(--border)] text-[var(--text-body)]'}`}>
 <option value="">{modeConfig.uploadAreaLabel}…</option>
 {modeConfig.defaultAreas.map(a => <option key={a} value={a}>{a}</option>)}
 </select>
 <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" />
 </div>
 )}
 {item.status === 'pending' && (
 <button type="button" onClick={e => { e.stopPropagation(); removeItem(item.id) }}
 className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-subtle)]"><X size={15} /></button>
 )}
 </div>
 </div>
 ))}

 {pendingCount > 1 && (
 <div className="flex items-center gap-2 pt-1">
 <span className="text-xs text-[var(--text-muted)]">Set all to:</span>
 <div className="relative">
 <select value={defaultArea} onChange={e => setDefaultArea(e.target.value)}
 className="text-xs border border-[var(--border)] rounded-[4px] pl-2 pr-6 py-1.5 focus:outline-none bg-[var(--surface)] appearance-none">
 <option value="">Select…</option>
 {modeConfig.defaultAreas.map(a => <option key={a} value={a}>{a}</option>)}
 </select>
 <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" />
 </div>
 <button type="button" onClick={applyDefaultArea} disabled={!defaultArea}
 className="text-xs px-2.5 py-1.5 bg-[var(--surface-2)] text-[var(--text-body)] rounded-[4px] hover:bg-[var(--surface-3)] transition-colors disabled:opacity-40">
 Apply to all
 </button>
 </div>
 )}

 {!submitting && (
 <button type="button" onClick={() => document.getElementById('file-input')?.click()}
 className="w-full flex items-center justify-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-subtle)] py-2 border border-dashed border-[var(--border)] rounded-[10px] hover:border-[var(--border-mid)] transition-colors">
 <Plus size={13} /> Add more files
 </button>
 )}
 {pendingCount > QUEUE_LIMIT && (
 <p className="text-xs text-[var(--amber)] text-center px-2">
 Analysing {pendingCount} files at once can be slow and may heat up your machine — consider uploading in smaller batches if you&apos;re using a local AI model.
 </p>
 )}
 </div>
 )}

 {/* Metadata */}
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4 space-y-4">
 <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">Applied to all files</p>
 <div onClick={loadDirects}>
 <label className="block text-xs font-medium text-[var(--text-body)] mb-1.5">From {modeConfig.personLabel.toLowerCase()} <span className="text-[var(--text-muted)] font-normal">(optional)</span></label>
 <div className="relative">
 <select value={directReportId} onChange={e => setDirectReportId(e.target.value)}
 className="w-full border border-[var(--border)] rounded-[4px] pl-3 pr-8 py-2 text-sm text-[var(--text-bright)] focus:outline-none focus:ring-2 bg-[var(--surface)] appearance-none cursor-pointer">
 <option value="">Not specified</option>
 {directs.map(d => <option key={d.id} value={d.id}>{d.name} — {d.title}</option>)}
 </select>
 <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-muted)]" />
 </div>
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-body)] mb-1.5">Report date <span className="text-[var(--text-muted)] font-normal">(optional)</span></label>
 <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)}
 className="w-full h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs text-[var(--text-bright)] focus:outline-none focus:ring-2" />
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-body)] mb-1.5">{modeConfig.projectLabel} <span className="text-[var(--text-muted)] font-normal">(optional)</span></label>
 <SelectField
 value={selectedProjectId}
 onChange={setSelectedProjectId}
 placeholder={`No ${modeConfig.projectLabel.toLowerCase()}`}
 options={[
 { value: '', label: `No ${modeConfig.projectLabel.toLowerCase()}` },
 ...projects.map(p => ({ value: p.id, label: p.name })),
 ]}
 />
 </div>
 {queue.some(q => q.type === 'file' && q.file?.type.startsWith('image/')) && (
 <label className="flex items-start gap-2.5 cursor-pointer select-none">
 <input
 type="checkbox"
 checked={extractText}
 onChange={e => setExtractText(e.target.checked)}
 className="mt-0.5 accent-gray-900 w-3.5 h-3.5 shrink-0"
 />
 <div>
 <span className="text-xs font-medium text-[var(--text-body)]">Extract text from image</span>
 <p className="text-xs text-[var(--text-muted)] mt-0.5">Run OCR to pull readable text from screenshots, documents, or photos</p>
 </div>
 </label>
 )}
 </div>

 {/* Audio capability warning */}
 {hasAudio && audioCapable === false && audioReason && (
 <div className="flex items-start gap-2.5 bg-[var(--amber-dim)] border border-[var(--amber)] rounded-[10px] px-4 py-3">
 <Mic size={14} className="text-amber-500 shrink-0 mt-0.5" />
 <div className="min-w-0">
 <p className="text-xs font-medium text-amber-800">Audio transcription not available</p>
 <p className="text-xs text-amber-700 mt-0.5">{audioReason}</p>
 <a href="/settings" className="text-xs text-[var(--amber)] underline mt-1 inline-block">Open Settings →</a>
 </div>
 </div>
 )}

 <button type="submit" disabled={queue.length === 0 || !allHaveArea || submitting || pendingCount === 0}
 className="w-full bg-[var(--ink)] text-[var(--ink-contrast)] text-sm font-medium h-7 px-3 rounded-[4px] :bg-[var(--ink)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
 {submitting ? <><Loader2 size={15} className="animate-spin" />Sending {processingIndex} of {processingTotal}…</>
 : allDone ? <><CheckCircle size={15} />{doneCount} queued for analysis{errorCount > 0 && ` · ${errorCount} failed`}</>
 : !allHaveArea && pendingCount > 0 ? <>Select an area for all files to continue</>
 : <><Upload size={15} />Upload {pendingCount > 0 ? `${pendingCount} file${pendingCount !== 1 ? 's' : ''}` : ''}</>}
 </button>

 {allDone && doneCount > 0 && (
 <div className="space-y-2">
 <p className="text-xs text-[var(--text-muted)] text-center">
 Analysis is running in the background — you can navigate freely. Progress shows in the top bar.
 </p>
 <div className="flex gap-2">
 <button type="button" onClick={() => router.push('/')}
 className="flex-1 border border-[var(--border)] text-[var(--text-body)] text-xs font-medium h-7 px-3 rounded-[4px] hover:bg-[var(--surface-2)] transition-colors">
 Go to overview
 </button>
 {lastDoneId && (
 <button type="button" onClick={() => router.push(`/reports/${lastDoneId}`)}
 className="flex-1 border border-[var(--border)] text-[var(--text-body)] text-xs font-medium h-7 px-3 rounded-[4px] hover:bg-[var(--surface-2)] transition-colors">
 View last report
 </button>
 )}
 </div>
 </div>
 )}

 {/* Series confirmation */}
 {seriesCandidate && !seriesLinked && (
 <div className="bg-indigo-50 border border-indigo-200 rounded-[10px] p-4 space-y-3">
 <div className="flex items-start gap-2">
 <GitMerge size={16} className="text-[var(--blue)] mt-0.5 shrink-0" />
 <div>
 <p className="text-sm font-medium text-indigo-900">Recurring {modeConfig.documentLabel.toLowerCase()} detected</p>
 <p className="text-xs text-indigo-700 mt-0.5">
 This looks like {modeConfig.documentLabel.toLowerCase()} #{seriesCandidate.count + 1} in a recurring series for <strong>{seriesCandidate.area}</strong>.
 Link them as a series to enable period-over-period tracking?
 </p>
 </div>
 </div>
 <div className="flex gap-2">
 <button
 type="button"
 disabled={seriesLinking}
 onClick={async () => {
 setSeriesLinking(true)
 await fetch(`/api/reports/${seriesCandidate.reportId}/series`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 seriesId: seriesCandidate.existingSeriesId ?? undefined,
 area: seriesCandidate.area,
 directReportId: seriesCandidate.directReportId,
 }),
 })
 setSeriesLinking(false)
 setSeriesLinked(true)
 }}
 className="flex items-center gap-1.5 bg-[var(--blue)] text-white text-xs font-medium px-3 py-1.5 rounded-[4px] hover:bg-indigo-700 disabled:opacity-50"
 >
 {seriesLinking ? <Loader2 size={12} className="animate-spin" /> : <GitMerge size={12} />}
 Yes, link as series
 </button>
 <button type="button" onClick={() => setSeriesCandidate(null)}
 className="text-xs text-[var(--blue)] hover:text-indigo-700 px-3 py-1.5">
 Skip
 </button>
 </div>
 </div>
 )}

 {seriesLinked && (
 <p className="text-xs text-[var(--green)] flex items-center gap-1.5">
 <CheckCircle size={13} /> Linked to recurring series — period-over-period comparisons are now enabled.
 </p>
 )}
 </form>
 )
}
