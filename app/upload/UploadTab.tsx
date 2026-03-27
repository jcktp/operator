'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Image as ImageIcon, X, Loader2, CheckCircle, AlertCircle, Globe, ChevronDown, Plus, GitMerge } from 'lucide-react'
import { type QueuedItem, type DirectReport, LINK_LABELS, detectLinkType, guessArea, fileId } from './uploadTypes'
import { useMode } from '@/components/ModeContext'

interface SeriesCandidate {
  count: number
  area: string
  directReportId: string | null
  existingSeriesId: string | null
  reportId: string
}

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
  const [linkInput, setLinkInput] = useState('')
  const [linkError, setLinkError] = useState('')

  const loadDirects = useCallback(async () => {
    if (directsLoaded) return
    const res = await fetch('/api/directs')
    const data = await res.json() as { directs?: DirectReport[] }
    setDirects(data.directs ?? [])
    setDirectsLoaded(true)
  }, [directsLoaded])

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
    setQueue(prev => [...prev, { id: fileId(), type: 'link', url, linkType, title: '', area: defaultArea, status: 'pending' }])
    setLinkInput('')
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
    setSubmitting(true)
    setProcessingIndex(1)
    setProcessingTotal(pendingItems.length)

    let idx = 0
    for (const item of pendingItems) {
      idx++
      setProcessingIndex(idx)
      updateItem(item.id, { status: 'analyzing' })
      try {
        let res: Response
        if (item.type === 'file' && item.file) {
          const formData = new FormData()
          formData.append('file', item.file)
          formData.append('title', item.title)
          formData.append('area', item.area)
          if (directReportId) formData.append('directReportId', directReportId)
          if (reportDate) formData.append('reportDate', reportDate)
          res = await fetch('/api/upload', { method: 'POST', body: formData })
        } else {
          res = await fetch('/api/upload-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: item.url, title: item.title, area: item.area, directReportId: directReportId || null, reportDate: reportDate || null }),
          })
        }
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
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${dragging ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'}`}
      >
        <input id="file-input" type="file" multiple accept={modeConfig.acceptedFileTypes} className="hidden"
          onChange={e => { if (e.target.files?.length) addFiles(e.target.files) }} />
        <Upload size={18} className="text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600 font-medium">Drop files here or click to browse</p>
        <p className="text-xs text-gray-400 mt-1">
          PDF, Word, Excel, CSV, text
          {modeConfig.acceptedFileTypes.includes('.jpg') ? ', photos (JPG, PNG, WEBP)' : ''}
          {' '}— multiple files at once
        </p>
      </div>

      {/* Google link input */}
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input type="url" value={linkInput}
              onChange={e => { setLinkInput(e.target.value); setLinkError('') }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }}
              placeholder="Paste a Google Docs, Sheets, or Slides link…"
              className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 placeholder-gray-400"
            />
          </div>
          <button type="button" onClick={addLink} disabled={!linkInput.trim()}
            className="shrink-0 px-3 py-2 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-40">
            Add link
          </button>
        </div>
        {linkError && <p className="text-xs text-red-500">{linkError}</p>}
        <p className="text-xs text-gray-400">Document must be shared as &quot;Anyone with the link can view&quot;</p>
      </div>

      {/* Queue */}
      {queue.length > 0 && (
        <div className="space-y-2">
          {queue.map(item => (
            <div key={item.id} className={`bg-white border rounded-xl px-4 py-3 transition-colors ${
              item.status === 'done' ? 'border-green-200 bg-green-50' :
              item.status === 'error' ? 'border-red-200 bg-red-50' :
              item.status === 'analyzing' || item.status === 'uploading' ? 'border-blue-200 bg-blue-50' :
              !item.area ? 'border-amber-200' : 'border-gray-200'
            }`}>
              <div className="flex items-center gap-3">
                <div className="shrink-0">
                  {item.status === 'done' && <CheckCircle size={16} className="text-green-600" />}
                  {item.status === 'error' && <AlertCircle size={16} className="text-red-500" />}
                  {(item.status === 'uploading' || item.status === 'analyzing') && <Loader2 size={16} className="animate-spin text-blue-500" />}
                  {item.status === 'pending' && item.type === 'link' && <Globe size={16} className="text-indigo-400" />}
                  {item.status === 'pending' && item.type === 'file' && (
                    item.file && item.file.type.startsWith('image/')
                      ? <ImageIcon size={16} className="text-blue-400" />
                      : <FileText size={16} className="text-gray-400" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  {item.status === 'pending' ? (
                    <input type="text" value={item.title} onChange={e => updateItem(item.id, { title: e.target.value })}
                      placeholder="Report title"
                      className="w-full text-sm text-gray-900 bg-transparent border-0 outline-none placeholder-gray-400" />
                  ) : (
                    <p className={`text-sm font-medium truncate ${item.status === 'done' ? 'text-green-800' : item.status === 'error' ? 'text-red-700' : 'text-blue-800'}`}>{item.title}</p>
                  )}
                  <p className="text-xs text-gray-400 truncate">
                    {item.type === 'link' ? (item.linkType ? LINK_LABELS[item.linkType] : 'Link') : item.file?.name}
                  </p>
                  {item.status === 'analyzing' && <p className="text-xs text-blue-500 mt-0.5">Analyzing…</p>}
                  {item.status === 'error' && item.error && <p className="text-xs text-red-500 mt-0.5">{item.error}</p>}
                  {item.status === 'done' && item.reportId && (
                    <a href={`/reports/${item.reportId}`} className="text-xs text-green-600 hover:underline mt-0.5 inline-block">View report →</a>
                  )}
                </div>
                {item.status === 'pending' && (
                  <div className="shrink-0 relative">
                    <select value={item.area} onChange={e => updateItem(item.id, { area: e.target.value })}
                      className={`text-xs border rounded-lg pl-2 pr-6 py-1.5 focus:outline-none focus:ring-1 focus:ring-gray-900 bg-white appearance-none cursor-pointer ${!item.area ? 'border-amber-300 text-amber-600' : 'border-gray-200 text-gray-700'}`}>
                      <option value="">{modeConfig.uploadAreaLabel}…</option>
                      {modeConfig.defaultAreas.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                    <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
                  </div>
                )}
                {item.status === 'pending' && (
                  <button type="button" onClick={e => { e.stopPropagation(); removeItem(item.id) }}
                    className="shrink-0 text-gray-400 hover:text-gray-600"><X size={15} /></button>
                )}
              </div>
            </div>
          ))}

          {pendingCount > 1 && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-gray-500">Set all to:</span>
              <div className="relative">
                <select value={defaultArea} onChange={e => setDefaultArea(e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg pl-2 pr-6 py-1.5 focus:outline-none bg-white appearance-none">
                  <option value="">Select…</option>
                  {modeConfig.defaultAreas.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
              </div>
              <button type="button" onClick={applyDefaultArea} disabled={!defaultArea}
                className="text-xs px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-40">
                Apply to all
              </button>
            </div>
          )}

          {!submitting && (
            <button type="button" onClick={() => document.getElementById('file-input')?.click()}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 py-2 border border-dashed border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
              <Plus size={13} /> Add more files
            </button>
          )}
        </div>
      )}

      {/* Metadata */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Applied to all files</p>
        <div onClick={loadDirects}>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">From direct report <span className="text-gray-400 font-normal">(optional)</span></label>
          <div className="relative">
            <select value={directReportId} onChange={e => setDirectReportId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg pl-3 pr-8 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white appearance-none cursor-pointer">
              <option value="">Not specified</option>
              {directs.map(d => <option key={d.id} value={d.id}>{d.name} — {d.title}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Report date <span className="text-gray-400 font-normal">(optional)</span></label>
          <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
      </div>

      <button type="submit" disabled={queue.length === 0 || !allHaveArea || submitting || pendingCount === 0}
        className="w-full bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        {submitting ? <><Loader2 size={15} className="animate-spin" />Processing {processingIndex} of {processingTotal}…</>
        : allDone ? <><CheckCircle size={15} />{doneCount} report{doneCount !== 1 ? 's' : ''} added{errorCount > 0 && ` · ${errorCount} failed`}</>
        : !allHaveArea && pendingCount > 0 ? <>Select an area for all files to continue</>
        : <><Upload size={15} />Upload & analyse {pendingCount > 0 ? `${pendingCount} report${pendingCount !== 1 ? 's' : ''}` : ''}</>}
      </button>

      {allDone && doneCount > 0 && (
        <div className="flex gap-2">
          <button type="button" onClick={() => router.push('/')}
            className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
            Go to overview
          </button>
          {lastDoneId && (
            <button type="button" onClick={() => router.push(`/reports/${lastDoneId}`)}
              className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors">
              View last report
            </button>
          )}
        </div>
      )}

      {/* Series confirmation */}
      {seriesCandidate && !seriesLinked && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-2">
            <GitMerge size={16} className="text-indigo-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-indigo-900">Recurring report detected</p>
              <p className="text-xs text-indigo-700 mt-0.5">
                This looks like report #{seriesCandidate.count + 1} in a recurring series for <strong>{seriesCandidate.area}</strong>.
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
              className="flex items-center gap-1.5 bg-indigo-600 text-white text-xs font-medium px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {seriesLinking ? <Loader2 size={12} className="animate-spin" /> : <GitMerge size={12} />}
              Yes, link as series
            </button>
            <button type="button" onClick={() => setSeriesCandidate(null)}
              className="text-xs text-indigo-500 hover:text-indigo-700 px-3 py-1.5">
              Skip
            </button>
          </div>
        </div>
      )}

      {seriesLinked && (
        <p className="text-xs text-green-600 flex items-center gap-1.5">
          <CheckCircle size={13} /> Linked to recurring series — period-over-period comparisons are now enabled.
        </p>
      )}
    </form>
  )
}
