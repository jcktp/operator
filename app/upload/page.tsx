'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AREAS } from '@/lib/utils'
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle, Plus, Link2, Copy, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────

interface QueuedFile {
  id: string
  file: File
  title: string
  status: 'pending' | 'uploading' | 'analyzing' | 'done' | 'error'
  error?: string
  reportId?: string
}

interface DirectReport {
  id: string
  name: string
  title: string
}

function fileId() { return Math.random().toString(36).slice(2) }

type Tab = 'upload' | 'request'

// ── Upload tab ─────────────────────────────────────────────────────────────

function UploadTab() {
  const router = useRouter()
  const [queue, setQueue] = useState<QueuedFile[]>([])
  const [area, setArea] = useState('')
  const [directReportId, setDirectReportId] = useState('')
  const [reportDate, setReportDate] = useState('')
  const [directs, setDirects] = useState<DirectReport[]>([])
  const [directsLoaded, setDirectsLoaded] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [allDone, setAllDone] = useState(false)
  const [dragging, setDragging] = useState(false)

  const loadDirects = useCallback(async () => {
    if (directsLoaded) return
    const res = await fetch('/api/directs')
    const data = await res.json()
    setDirects(data.directs ?? [])
    setDirectsLoaded(true)
  }, [directsLoaded])

  const addFiles = (files: FileList | File[]) => {
    const newItems: QueuedFile[] = Array.from(files).map(f => ({
      id: fileId(), file: f,
      title: f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
      status: 'pending',
    }))
    setQueue(prev => [...prev, ...newItems])
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }, [])

  const updateTitle = (id: string, title: string) =>
    setQueue(prev => prev.map(q => q.id === id ? { ...q, title } : q))

  const removeFile = (id: string) =>
    setQueue(prev => prev.filter(q => q.id !== id))

  const setStatus = (id: string, patch: Partial<QueuedFile>) =>
    setQueue(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!area || queue.length === 0 || submitting) return
    setSubmitting(true)

    for (const item of queue) {
      if (item.status === 'done') continue
      setStatus(item.id, { status: 'uploading' })
      const formData = new FormData()
      formData.append('file', item.file)
      formData.append('title', item.title)
      formData.append('area', area)
      if (directReportId) formData.append('directReportId', directReportId)
      if (reportDate) formData.append('reportDate', reportDate)
      try {
        setStatus(item.id, { status: 'analyzing' })
        const res = await fetch('/api/upload', { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) setStatus(item.id, { status: 'error', error: data.error ?? 'Upload failed' })
        else setStatus(item.id, { status: 'done', reportId: data.report.id })
      } catch {
        setStatus(item.id, { status: 'error', error: 'Network error' })
      }
    }

    setSubmitting(false)
    setAllDone(true)
  }

  const doneCount = queue.filter(q => q.status === 'done').length
  const errorCount = queue.filter(q => q.status === 'error').length
  const pendingCount = queue.filter(q => ['pending','uploading','analyzing'].includes(q.status)).length
  const lastDoneId = queue.filter(q => q.status === 'done').at(-1)?.reportId
  const acceptedTypes = '.pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
          dragging ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <input id="file-input" type="file" multiple accept={acceptedTypes} className="hidden"
          onChange={e => { if (e.target.files?.length) addFiles(e.target.files) }} />
        <Upload size={18} className="text-gray-400 mx-auto mb-2" />
        <p className="text-sm text-gray-600 font-medium">Drop files here or click to browse</p>
        <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, CSV, text — multiple files at once</p>
      </div>

      {queue.length > 0 && (
        <div className="space-y-2">
          {queue.map(item => (
            <div key={item.id} className={`flex items-center gap-3 bg-white border rounded-xl px-4 py-3 transition-colors ${
              item.status === 'done' ? 'border-green-200 bg-green-50' :
              item.status === 'error' ? 'border-red-200 bg-red-50' :
              item.status === 'analyzing' || item.status === 'uploading' ? 'border-blue-200 bg-blue-50' :
              'border-gray-200'
            }`}>
              <div className="shrink-0">
                {item.status === 'done' && <CheckCircle size={16} className="text-green-600" />}
                {item.status === 'error' && <AlertCircle size={16} className="text-red-500" />}
                {(item.status === 'uploading' || item.status === 'analyzing') && <Loader2 size={16} className="animate-spin text-blue-500" />}
                {item.status === 'pending' && <FileText size={16} className="text-gray-400" />}
              </div>
              <div className="flex-1 min-w-0">
                {item.status === 'pending' ? (
                  <input type="text" value={item.title} onChange={e => updateTitle(item.id, e.target.value)}
                    placeholder="Report title"
                    className="w-full text-sm text-gray-900 bg-transparent border-0 outline-none placeholder-gray-400" />
                ) : (
                  <p className={`text-sm font-medium truncate ${
                    item.status === 'done' ? 'text-green-800' :
                    item.status === 'error' ? 'text-red-700' : 'text-blue-800'
                  }`}>{item.title}</p>
                )}
                <p className="text-xs text-gray-400 truncate">{item.file.name}</p>
                {item.status === 'analyzing' && <p className="text-xs text-blue-500 mt-0.5">Analyzing…</p>}
                {item.status === 'error' && item.error && <p className="text-xs text-red-500 mt-0.5">{item.error}</p>}
                {item.status === 'done' && item.reportId && (
                  <a href={`/reports/${item.reportId}`} className="text-xs text-green-600 hover:underline mt-0.5 inline-block">View report →</a>
                )}
              </div>
              {item.status === 'pending' && (
                <button type="button" onClick={e => { e.stopPropagation(); removeFile(item.id) }}
                  className="shrink-0 text-gray-400 hover:text-gray-600"><X size={15} /></button>
              )}
            </div>
          ))}
          {!submitting && (
            <button type="button" onClick={() => document.getElementById('file-input')?.click()}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 py-2 border border-dashed border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
              <Plus size={13} /> Add more files
            </button>
          )}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Applied to all files</p>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Business area <span className="text-red-400">*</span></label>
          <select value={area} onChange={e => setArea(e.target.value)} required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
            <option value="">Select area…</option>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div onClick={loadDirects}>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">From direct report <span className="text-gray-400 font-normal">(optional)</span></label>
          <select value={directReportId} onChange={e => setDirectReportId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
            <option value="">Not specified</option>
            {directs.map(d => <option key={d.id} value={d.id}>{d.name} — {d.title}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Report date <span className="text-gray-400 font-normal">(optional)</span></label>
          <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
      </div>

      <button type="submit" disabled={queue.length === 0 || !area || submitting || pendingCount === 0}
        className="w-full bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
        {submitting ? (
          <><Loader2 size={15} className="animate-spin" />Processing {doneCount + 1} of {queue.length}…</>
        ) : allDone ? (
          <><CheckCircle size={15} />{doneCount} report{doneCount !== 1 ? 's' : ''} added{errorCount > 0 && ` · ${errorCount} failed`}</>
        ) : (
          <><Upload size={15} />Upload & analyze {queue.filter(q => q.status === 'pending').length > 0 ? `${queue.filter(q => q.status === 'pending').length} report${queue.filter(q => q.status === 'pending').length !== 1 ? 's' : ''}` : ''}</>
        )}
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
    </form>
  )
}

// ── Request link tab ────────────────────────────────────────────────────────

function RequestTab() {
  const [title, setTitle] = useState('')
  const [area, setArea] = useState('')
  const [message, setMessage] = useState('')
  const [directReportId, setDirectReportId] = useState('')
  const [directs, setDirects] = useState<DirectReport[]>([])
  const [directsLoaded, setDirectsLoaded] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)

  const loadDirects = useCallback(async () => {
    if (directsLoaded) return
    const res = await fetch('/api/directs')
    const data = await res.json()
    setDirects(data.directs ?? [])
    setDirectsLoaded(true)
  }, [directsLoaded])

  const generate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !area) return
    setGenerating(true)
    try {
      const res = await fetch('/api/report-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, area, message, directReportId }),
      })
      const data = await res.json()
      if (res.ok) {
        setLink(`${window.location.origin}/request/${data.request.token}`)
      }
    } finally {
      setGenerating(false)
    }
  }

  const copy = () => {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const reset = () => {
    setLink(''); setTitle(''); setArea(''); setMessage(''); setDirectReportId('')
  }

  if (link) {
    return (
      <div className="space-y-5">
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
          <CheckCircle size={24} className="text-green-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-900">Request link ready</p>
          <p className="text-xs text-gray-500 mt-0.5">Send this to the person you want the report from</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-medium text-gray-500">Shareable link</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={link}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-700 bg-gray-50 focus:outline-none"
            />
            <button
              onClick={copy}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
            </button>
          </div>
          <p className="text-xs text-gray-400">
            The recipient can upload a file or paste a Google Sheets / Docs link. No account needed.
          </p>
        </div>

        <button onClick={reset}
          className="w-full border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-50 transition-colors">
          Create another request
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={generate} className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Report title <span className="text-red-400">*</span></label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
            placeholder="e.g. Q1 Engineering Update"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Business area <span className="text-red-400">*</span></label>
          <select value={area} onChange={e => setArea(e.target.value)} required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
            <option value="">Select area…</option>
            {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>

        <div onClick={loadDirects}>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">From direct report <span className="text-gray-400 font-normal">(optional)</span></label>
          <select value={directReportId} onChange={e => setDirectReportId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white">
            <option value="">Not specified</option>
            {directs.map(d => <option key={d.id} value={d.id}>{d.name} — {d.title}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Message to recipient <span className="text-gray-400 font-normal">(optional)</span></label>
          <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
            placeholder="e.g. Please include your pipeline numbers and any blockers for this quarter."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none" />
        </div>
      </div>

      <div className="bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-xs text-gray-500 leading-relaxed">
        A unique link will be generated. The recipient can open it in any browser — no account or login required.
        They can upload a file or share a Google Sheets / Docs link (set to "Anyone with the link").
      </div>

      <button type="submit" disabled={!title || !area || generating}
        className="w-full bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
        {generating ? <><Loader2 size={14} className="animate-spin" />Generating…</> : <><Link2 size={14} />Generate request link</>}
      </button>
    </form>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const [tab, setTab] = useState<Tab>('upload')

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Add reports</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Upload directly or send a link for someone to submit their own report.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-gray-100 rounded-lg p-1 gap-1 mb-6">
        <button
          onClick={() => setTab('upload')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors',
            tab === 'upload' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <Upload size={14} />
          Upload now
        </button>
        <button
          onClick={() => setTab('request')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors',
            tab === 'request' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <Link2 size={14} />
          Request submission
        </button>
      </div>

      {tab === 'upload' ? <UploadTab /> : <RequestTab />}
    </div>
  )
}
