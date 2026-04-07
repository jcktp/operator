'use client'

import { useState, useEffect } from 'react'
import { Upload, Link2, CheckCircle, AlertCircle, Loader2, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import WalkieTalkie from '@/components/WalkieTalkie'
import { getModeConfig } from '@/lib/mode'

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
  const [token, setToken] = useState('')
  const [info, setInfo] = useState<RequestInfo | null>(null)
  const [directs, setDirects] = useState<DirectOption[]>([])
  const [mode, setMode] = useState<string | null>(null)
  const [submitterName, setSubmitterName] = useState('')
  const [stage, setStage] = useState<Stage>('loading')
  const [uploadMode, setUploadMode] = useState<Mode>('file')
  const [file, setFile] = useState<File | null>(null)
  const [googleUrl, setGoogleUrl] = useState('')
  const [reportDate, setReportDate] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [dragging, setDragging] = useState(false)

  const modeConfig = getModeConfig(mode)

  const loadRequest = (t: string) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)
    fetch(`/api/report-requests/${t}`, { signal: controller.signal, headers: { 'Accept': 'application/json' } })
      .then(async r => {
        const text = await r.text()
        clearTimeout(timeout)
        let data: Record<string, unknown>
        try {
          data = JSON.parse(text)
        } catch {
          const preview = text.replace(/<[^>]+>/g, '').trim().slice(0, 120)
          setErrorMsg(`HTTP ${r.status}: ${preview || 'Empty response'}`)
          setStage('error')
          return
        }
        if (data.error === 'not_found') { setStage('not_found'); return }
        if (data.error === 'expired') { setStage('expired'); return }
        if (data.error === 'submitted') { setStage('done'); return }
        if (data.error) {
          setErrorMsg(String(data.detail ?? data.error))
          setStage('error')
          return
        }
        setInfo(data.request as RequestInfo)
        setDirects((data.directs ?? []) as DirectOption[])
        setMode((data.mode as string | null) ?? null)
        if ((data.request as RequestInfo)?.directReport?.name) {
          setSubmitterName((data.request as RequestInfo).directReport!.name)
        }
        setStage('ready')
      })
      .catch(e => {
        clearTimeout(timeout)
        const msg = e?.name === 'AbortError' ? 'Request timed out. Check your connection and try again.' : String(e)
        setErrorMsg(msg)
        setStage('error')
      })
  }

  useEffect(() => {
    params.then(({ token: t }) => {
      setToken(t)
      loadRequest(t)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) setFile(f)
  }

  const needsName = !info?.directReport
  const canSubmit = (uploadMode === 'file' ? !!file : googleUrl.trim().length > 0)
    && !!reportDate
    && (!needsName || submitterName.trim().length > 0)

  const submit = async () => {
    if (!canSubmit) return

    setStage('submitting')
    setErrorMsg('')

    try {
      let res: Response

      if (uploadMode === 'file') {
        const formData = new FormData()
        formData.append('file', file!)
        formData.append('reportDate', reportDate)
        if (submitterName.trim()) formData.append('submitterName', submitterName.trim())
        res = await fetch(`/api/report-requests/${token}/submit`, {
          method: 'POST',
          body: formData,
          headers: { 'Accept': 'application/json' },
        })
      } else {
        res = await fetch(`/api/report-requests/${token}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ googleUrl: googleUrl.trim(), reportDate, submitterName: submitterName.trim() || undefined }),
        })
      }

      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Submission failed')
        setStage('ready')
      } else {
        setStage('done')
      }
    } catch {
      setErrorMsg('Network error — please try again')
      setStage('ready')
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
          <p className="text-sm text-gray-400 mt-1">This request link doesn&apos;t exist or has been removed.</p>
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
          {errorMsg && <p className="text-xs text-gray-400 mt-2 max-w-xs mx-auto">{errorMsg}</p>}
          <button
            onClick={() => { setStage('loading'); setErrorMsg(''); loadRequest(token) }}
            className="mt-4 text-sm text-gray-500 underline underline-offset-2"
          >
            Try again
          </button>
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
          <p className="text-gray-900 font-semibold text-lg">{modeConfig.documentLabel} submitted</p>
          <p className="text-sm text-gray-400 mt-1">Thanks — it&apos;s been received and is being reviewed.</p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      {/* Context */}
      <div className="mb-8">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{modeConfig.documentLabel} request</p>
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

      {/* Your name — required when not pre-linked to a direct */}
      {needsName && (
        <div className="mb-5">
          <label className="block text-xs font-medium text-gray-500 mb-1.5">
            Your name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            list="directs-list"
            value={submitterName}
            onChange={e => setSubmitterName(e.target.value)}
            placeholder="Your name"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          {directs.length > 0 && (
            <datalist id="directs-list">
              {directs.map(d => <option key={d.id} value={d.name} />)}
            </datalist>
          )}
        </div>
      )}

      {/* Report date — required */}
      <div className="mb-5">
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          {modeConfig.documentLabel} date <span className="text-red-400">*</span>
        </label>
        <input
          type="date"
          value={reportDate}
          onChange={e => setReportDate(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
        />
      </div>

      {/* Upload mode toggle */}
      <div className="flex bg-gray-100 rounded-lg p-1 gap-1 mb-5">
        <button
          onClick={() => setUploadMode('file')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors',
            uploadMode === 'file' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <Upload size={14} />
          Upload file
        </button>
        <button
          onClick={() => setUploadMode('link')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-colors',
            uploadMode === 'link' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          )}
        >
          <Link2 size={14} />
          Google link
        </button>
      </div>

      {/* File upload */}
      {uploadMode === 'file' && (
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
      {uploadMode === 'link' && (
        <div className="space-y-3">
          <input
            type="url"
            value={googleUrl}
            onChange={e => setGoogleUrl(e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/d/..."
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 font-mono"
          />
          <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-700 leading-relaxed">
            Make sure the document is shared with <strong>&quot;Anyone with the link&quot;</strong> — otherwise it can&apos;t be fetched.
            Works with Google Sheets and Google Docs.
          </div>
        </div>
      )}

      {/* Error */}
      {errorMsg && (
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
          <><Loader2 size={15} className="animate-spin" /> Submitting…</>
        ) : (
          `Submit ${modeConfig.documentLabel.toLowerCase()}`
        )}
      </button>
      {stage === 'submitting' && (
        <p className="mt-3 text-center text-xs text-gray-400">
          Uploading your file — please don't close this tab until you see confirmation.
        </p>
      )}
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#fafafa]">
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
