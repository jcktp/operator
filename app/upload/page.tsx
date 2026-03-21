'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AREAS } from '@/lib/utils'
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle, Plus } from 'lucide-react'

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

function fileId() {
  return Math.random().toString(36).slice(2)
}

export default function UploadPage() {
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
      id: fileId(),
      file: f,
      title: f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
      status: 'pending',
    }))
    setQueue(prev => [...prev, ...newItems])
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files)
  }, [])

  const updateTitle = (id: string, title: string) => {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, title } : q))
  }

  const removeFile = (id: string) => {
    setQueue(prev => prev.filter(q => q.id !== id))
  }

  const setStatus = (id: string, patch: Partial<QueuedFile>) => {
    setQueue(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q))
  }

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

        if (!res.ok) {
          setStatus(item.id, { status: 'error', error: data.error ?? 'Upload failed' })
        } else {
          setStatus(item.id, { status: 'done', reportId: data.report.id })
        }
      } catch {
        setStatus(item.id, { status: 'error', error: 'Network error' })
      }
    }

    setSubmitting(false)
    setAllDone(true)
  }

  const doneCount = queue.filter(q => q.status === 'done').length
  const errorCount = queue.filter(q => q.status === 'error').length
  const pendingCount = queue.filter(q => q.status === 'pending' || q.status === 'uploading' || q.status === 'analyzing').length
  const lastDoneId = queue.filter(q => q.status === 'done').at(-1)?.reportId

  const acceptedTypes = '.pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md'

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Add reports</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Upload one or more reports. They'll each be analyzed and added to the overview.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('file-input')?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
            dragging ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <input
            id="file-input"
            type="file"
            multiple
            accept={acceptedTypes}
            className="hidden"
            onChange={e => { if (e.target.files?.length) addFiles(e.target.files) }}
          />
          <Upload size={18} className="text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 font-medium">Drop files here or click to browse</p>
          <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, CSV, text — multiple files at once</p>
        </div>

        {/* File queue */}
        {queue.length > 0 && (
          <div className="space-y-2">
            {queue.map(item => (
              <div key={item.id} className={`flex items-center gap-3 bg-white border rounded-xl px-4 py-3 transition-colors ${
                item.status === 'done' ? 'border-green-200 bg-green-50' :
                item.status === 'error' ? 'border-red-200 bg-red-50' :
                item.status === 'analyzing' || item.status === 'uploading' ? 'border-blue-200 bg-blue-50' :
                'border-gray-200'
              }`}>
                {/* Status icon */}
                <div className="shrink-0">
                  {item.status === 'done' && <CheckCircle size={16} className="text-green-600" />}
                  {item.status === 'error' && <AlertCircle size={16} className="text-red-500" />}
                  {(item.status === 'uploading' || item.status === 'analyzing') && (
                    <Loader2 size={16} className="animate-spin text-blue-500" />
                  )}
                  {item.status === 'pending' && <FileText size={16} className="text-gray-400" />}
                </div>

                {/* Title input */}
                <div className="flex-1 min-w-0">
                  {item.status === 'pending' ? (
                    <input
                      type="text"
                      value={item.title}
                      onChange={e => updateTitle(item.id, e.target.value)}
                      placeholder="Report title"
                      className="w-full text-sm text-gray-900 bg-transparent border-0 outline-none placeholder-gray-400"
                    />
                  ) : (
                    <p className={`text-sm font-medium truncate ${
                      item.status === 'done' ? 'text-green-800' :
                      item.status === 'error' ? 'text-red-700' :
                      'text-blue-800'
                    }`}>{item.title}</p>
                  )}
                  <p className="text-xs text-gray-400 truncate">{item.file.name}</p>
                  {item.status === 'analyzing' && (
                    <p className="text-xs text-blue-500 mt-0.5">Analyzing with Ollama…</p>
                  )}
                  {item.status === 'error' && item.error && (
                    <p className="text-xs text-red-500 mt-0.5">{item.error}</p>
                  )}
                  {item.status === 'done' && item.reportId && (
                    <a href={`/reports/${item.reportId}`} className="text-xs text-green-600 hover:underline mt-0.5 inline-block">
                      View report →
                    </a>
                  )}
                </div>

                {/* Remove (pending only) */}
                {item.status === 'pending' && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); removeFile(item.id) }}
                    className="shrink-0 text-gray-400 hover:text-gray-600"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            ))}

            {/* Add more */}
            {!submitting && (
              <button
                type="button"
                onClick={() => document.getElementById('file-input')?.click()}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 py-2 border border-dashed border-gray-200 rounded-xl hover:border-gray-300 transition-colors"
              >
                <Plus size={13} />
                Add more files
              </button>
            )}
          </div>
        )}

        {/* Shared settings */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Applied to all files</p>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Business area <span className="text-red-400">*</span>
            </label>
            <select
              value={area}
              onChange={e => setArea(e.target.value)}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            >
              <option value="">Select area…</option>
              {AREAS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div onClick={loadDirects}>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              From direct report <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <select
              value={directReportId}
              onChange={e => setDirectReportId(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
            >
              <option value="">Not specified</option>
              {directs.map(d => (
                <option key={d.id} value={d.id}>{d.name} — {d.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Report date <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={reportDate}
              onChange={e => setReportDate(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={queue.length === 0 || !area || submitting || pendingCount === 0}
          className="w-full bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Processing {queue.filter(q => q.status === 'done').length + 1} of {queue.length}…
            </>
          ) : allDone ? (
            <>
              <CheckCircle size={15} />
              {doneCount} report{doneCount !== 1 ? 's' : ''} added
              {errorCount > 0 && ` · ${errorCount} failed`}
            </>
          ) : (
            <>
              <Upload size={15} />
              Upload & analyze {queue.filter(q => q.status === 'pending').length > 0
                ? `${queue.filter(q => q.status === 'pending').length} report${queue.filter(q => q.status === 'pending').length !== 1 ? 's' : ''}`
                : ''}
            </>
          )}
        </button>

        {allDone && doneCount > 0 && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => router.push('/')}
              className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Go to overview
            </button>
            {lastDoneId && (
              <button
                type="button"
                onClick={() => router.push(`/reports/${lastDoneId}`)}
                className="flex-1 border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                View last report
              </button>
            )}
          </div>
        )}
      </form>
    </div>
  )
}
