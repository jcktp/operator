'use client'

import { useState, useEffect, use } from 'react'
import { Upload, Link2, CheckCircle, AlertCircle, Loader2, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import WalkieTalkie from '@/components/WalkieTalkie'

interface DirectOption {
  id: string
  name: string
  title: string
}

interface RequestInfo {
  title: string
  area: string
  message?: string
  directReport?: { name: string; title: string }
  status: string
  expiresAt?: string
}

type Mode = 'file' | 'link'
type Stage = 'loading' | 'ready' | 'expired' | 'not_found' | 'submitting' | 'done' | 'error'

export default function RequestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [info, setInfo] = useState<RequestInfo | null>(null)
  const [directs, setDirects] = useState<DirectOption[]>([])
  const [submitterName, setSubmitterName] = useState('')
  const [stage, setStage] = useState<Stage>('loading')
  const [mode, setMode] = useState<Mode>('file')
  const [file, setFile] = useState<File | null>(null)
  const [googleUrl, setGoogleUrl] = useState('')
  const [reportDate, setReportDate] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    fetch(`/api/report-requests/${token}`)
      .then(async r => {
        const data = await r.json()
        if (data.error === 'not_found') { setStage('not_found'); return }
        if (data.error === 'expired') { setStage('expired'); return }
        if (data.error === 'submitted') { setStage('done'); return }
        if (data.error) {
          setErrorMsg(data.detail ?? data.error)
          setStage('error')
          return
        }
        setInfo(data.request)
        setDirects(data.directs ?? [])
        if (data.request?.directReport?.name) setSubmitterName(data.request.directReport.name)
        setStage('ready')
      })
      .catch(e => {
        setErrorMsg(String(e))
        setStage('error')
      })
  }, [token])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  const submit = async () => {
    if (mode === 'file' && !file) return
    if (mode === 'link' && !googleUrl.trim()) return

    setStage('submitting')
    setErrorMsg('')

    try {
      let res: Response

      if (mode === 'file') {
        const formData = new FormData()
        formData.append('file', file!)
        if (reportDate) formData.append('reportDate', reportDate)
        if (submitterName.trim()) formData.append('submitterName', submitterName.trim())
        res = await fetch(`/api/report-requests/${token}/submit`, { method: 'POST', body: formData })
      } else {
        res = await fetch(`/api/report-requests/${token}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ googleUrl: googleUrl.trim(), reportDate, submitterName: submitterName.trim() || undefined }),
        })
      }

      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Submission failed')
        setStage('error')
      } else {
        setStage('done')
      }
    } catch {
      setErrorMsg('Network error — please try again')
      setStage('error')
    }
  }

  const acceptedTypes = '.pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md'

  if (stage === 'loading') {
    return (
      <Shell>
        <div className="flex justify-center py-20">
          <Loader2 size={24} className="animate-spin text-gray-300" />
        </div>
      </Shell>
    )
  }

  if (stage === 'not_found') {
    return (
      <Shell>
        <div className="text-center py-16">
          <AlertCircle size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Link not found</p>
          <p className="text-sm text-gray-400 mt-1">This request link doesn't exist or has been removed.</p>
        </div>
      </Shell>
    )
  }

  if (stage === 'error') {
    return (
      <Shell>
        <div className="text-center py-16">
          <AlertCircle size={32} className="text-red-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Something went wrong</p>
          {errorMsg && <p className="text-xs text-gray-400 mt-2 font-mono">{errorMsg}</p>}
        </div>
      </Shell>
    )
  }

  if (stage === 'expired') {
    return (
      <Shell>
        <div className="text-center py-16">
          <AlertCircle size={32} className="text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Link expired</p>
          <p className="text-sm text-gray-400 mt-1">This request link is no longer active. Ask for a new one.</p>
        </div>
      </Shell>
    )
  }

  if (stage === 'done') {
    return (
      <Shell>
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={28} className="text-green-500" />
          </div>
          <p className="text-gray-900 font-semibold text-lg">Report submitted</p>
          <p className="text-sm text-gray-400 mt-1">Thanks — it's been received and is being reviewed.</p>
        </div>
      </Shell>
    )
  }

  const canSubmit = mode === 'file' ? !!file : googleUrl.trim().length > 0

  return (
    <Shell>
      {/* Context */}
      <div className="mb-8">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Report request</p>
        <h1 className="text-2xl font-semibold text-gray-900">{info?.title}</h1>
        {info?.directReport && (
          <p className="text-sm text-gray-500 mt-1">For {info.directReport.name}</p>
        )}
        {info?.message && (
          <div className="mt-4 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3">
            <p className="text-sm text-gray-600 leading-relaxed">{info.message}</p>
          </div>
        )}
      </div>

      {/* Submitter name */}
      <div className="mb-6">
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          Your name <span className="font-normal text-gray-400">(optional)</span>
        </label>
        {info?.directReport ? (
          <div className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-gray-50">
            {info.directReport.name}
          </div>
        ) : (
          <>
            <input
              type="text"
              list="directs-list"
              value={submitterName}
              onChange={e => setSubmitterName(e.target.value)}
              placeholder="Your name"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
            {directs.length > 0 && (
              <datalist id="directs-list">
                {directs.map(d => (
                  <option key={d.id} value={d.name} />
                ))}
              </datalist>
            )}
          </>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex bg-gray-100 rounded-lg p-1 gap-1 mb-6">
        <button
          onClick={() => setMode('file')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors',
            mode === 'file' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <Upload size={14} />
          Upload file
        </button>
        <button
          onClick={() => setMode('link')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors',
            mode === 'link' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <Link2 size={14} />
          Google link
        </button>
      </div>

      {/* File upload */}
      {mode === 'file' && (
        <div className="space-y-4">
          {!file ? (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById('req-file')?.click()}
              className={cn(
                'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
                dragging ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <input
                id="req-file"
                type="file"
                accept={acceptedTypes}
                className="hidden"
                onChange={e => { if (e.target.files?.[0]) setFile(e.target.files[0]) }}
              />
              <Upload size={20} className="text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-gray-600">Drop your file here or click to browse</p>
              <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, CSV, text</p>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3">
              <FileText size={16} className="text-gray-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                <p className="text-xs text-gray-400">{(file.size / 1024).toFixed(0)} KB</p>
              </div>
              <button onClick={() => setFile(null)} className="text-xs text-gray-400 hover:text-gray-600">Change</button>
            </div>
          )}
        </div>
      )}

      {/* Google link */}
      {mode === 'link' && (
        <div className="space-y-3">
          <div>
            <input
              type="url"
              value={googleUrl}
              onChange={e => setGoogleUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono"
            />
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-700 leading-relaxed">
            Make sure the document is shared with <strong>"Anyone with the link"</strong> — otherwise it can't be fetched.
            Works with Google Sheets and Google Docs.
          </div>
        </div>
      )}

      {/* Report date */}
      <div className="mt-4">
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          Report date <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input
          type="date"
          value={reportDate}
          onChange={e => setReportDate(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {/* Error */}
      {stage === 'error' && errorMsg && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 text-sm text-red-600 flex items-start gap-2">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          {errorMsg}
        </div>
      )}

      {/* Submit */}
      <button
        onClick={submit}
        disabled={!canSubmit || stage === 'submitting'}
        className="mt-6 w-full bg-gray-900 text-white text-sm font-medium px-4 py-3 rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {stage === 'submitting' ? (
          <><Loader2 size={15} className="animate-spin" /> Submitting & analyzing…</>
        ) : (
          'Submit report'
        )}
      </button>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Minimal header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-lg mx-auto px-6 py-4 flex items-center gap-2.5">
          <WalkieTalkie />
          <span className="text-xl text-gray-900" style={{ fontFamily: 'var(--font-caveat)', fontWeight: 700 }}>
            operator
          </span>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-6 py-10">
        {children}
      </div>
    </div>
  )
}
