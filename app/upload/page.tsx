'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AREAS } from '@/lib/utils'
import { Upload, FileText, X, Loader2, CheckCircle } from 'lucide-react'

interface DirectReport {
  id: string
  name: string
  title: string
  area: string
}

export default function UploadPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [area, setArea] = useState('')
  const [directReportId, setDirectReportId] = useState('')
  const [reportDate, setReportDate] = useState('')
  const [directs, setDirects] = useState<DirectReport[]>([])
  const [directsLoaded, setDirectsLoaded] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [dragging, setDragging] = useState(false)

  const loadDirects = useCallback(async () => {
    if (directsLoaded) return
    const res = await fetch('/api/directs')
    const data = await res.json()
    setDirects(data.directs ?? [])
    setDirectsLoaded(true)
  }, [directsLoaded])

  const handleFile = (f: File) => {
    setFile(f)
    if (!title) {
      // Auto-fill title from filename
      setTitle(f.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '))
    }
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [title])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !title || !area) return

    setUploading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('title', title)
    formData.append('area', area)
    if (directReportId) formData.append('directReportId', directReportId)
    if (reportDate) formData.append('reportDate', reportDate)

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Upload failed')
        setUploading(false)
        return
      }

      setDone(true)
      setTimeout(() => router.push(`/reports/${data.report.id}`), 1200)
    } catch {
      setError('Upload failed. Please try again.')
      setUploading(false)
    }
  }

  const acceptedTypes = '.pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md'

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center">
        <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center mb-4">
          <CheckCircle size={22} className="text-green-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900">Report processed</h2>
        <p className="text-sm text-gray-500 mt-1">Redirecting to your report…</p>
      </div>
    )
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Add report</h1>
        <p className="text-gray-500 text-sm mt-0.5">
          Upload a report in any format — PDF, Excel, Word, CSV, or text.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* File drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
            dragging
              ? 'border-gray-400 bg-gray-50'
              : file
              ? 'border-green-300 bg-green-50'
              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
          onClick={() => document.getElementById('file-input')?.click()}
        >
          <input
            id="file-input"
            type="file"
            accept={acceptedTypes}
            className="hidden"
            onChange={e => {
              const f = e.target.files?.[0]
              if (f) handleFile(f)
            }}
          />

          {file ? (
            <div className="flex items-center justify-center gap-3">
              <FileText size={20} className="text-green-600 shrink-0" />
              <div className="text-left">
                <p className="text-sm font-medium text-gray-900">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setFile(null) }}
                className="ml-2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div>
              <Upload size={20} className="text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 font-medium">Drop file here or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, CSV, or text</p>
            </div>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Report title <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Finance — March 2025"
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>

        {/* Area */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Business area <span className="text-red-400">*</span>
          </label>
          <select
            value={area}
            onChange={e => setArea(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
          >
            <option value="">Select area…</option>
            {AREAS.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>

        {/* Direct report (optional) */}
        <div onClick={loadDirects}>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            From direct report <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <select
            value={directReportId}
            onChange={e => setDirectReportId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white"
          >
            <option value="">Not specified</option>
            {directs.map(d => (
              <option key={d.id} value={d.id}>{d.name} — {d.title}</option>
            ))}
          </select>
        </div>

        {/* Report date (optional) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Report date <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="date"
            value={reportDate}
            onChange={e => setReportDate(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!file || !title || !area || uploading}
          className="w-full bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Analyzing report…
            </>
          ) : (
            <>
              <Upload size={15} />
              Upload & analyze
            </>
          )}
        </button>

        <p className="text-xs text-gray-400 text-center">
          Analysis typically takes 10–30 seconds depending on file size.
        </p>
      </form>
    </div>
  )
}
