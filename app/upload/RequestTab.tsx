'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, CheckCircle, Link2, Copy, Check, AlertTriangle, Globe, ChevronDown, Search } from 'lucide-react'
import type { DirectReport } from './uploadTypes'
import { getModeConfig } from '@/lib/mode'
import { useMode } from '@/components/ModeContext'
import { useSettings } from '@/lib/use-settings'

function SearchableDropdown({ value, placeholder, options, onChange }: { value: string; placeholder: string; options: { label: string; value: string }[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQuery('') } }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const filtered = query.trim()
    ? options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()))
    : options

  const selectedLabel = options.find(o => o.value === value)?.label

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => { setOpen(o => !o); setTimeout(() => inputRef.current?.focus(), 50) }}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white h-[38px]">
        <span className={value ? 'text-gray-900' : 'text-gray-400'}>{selectedLabel || placeholder}</span>
        <ChevronDown size={14} className="text-gray-400 shrink-0" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-md overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search size={12} className="text-gray-400 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Type to search…"
              className="flex-1 text-sm outline-none bg-transparent placeholder-gray-400"
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="py-1 max-h-48 overflow-y-auto">
            <button type="button" onClick={() => { onChange(''); setOpen(false); setQuery('') }}
              className="w-full text-left px-3 py-2 text-sm text-gray-400 hover:bg-gray-50">
              {placeholder}
            </button>
            {filtered.map(o => (
              <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); setQuery('') }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-900">
                {o.label}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">No matches</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function RequestTab() {
  const modeConfig = useMode()
  const { settings } = useSettings()
  const [title, setTitle] = useState('')
  const [area, setArea] = useState('')
  const [message, setMessage] = useState('')
  const [directReportId, setDirectReportId] = useState('')
  const [directs, setDirects] = useState<DirectReport[]>([])
  const [areas, setAreas] = useState<string[]>(getModeConfig(null).defaultAreas)
  const [generating, setGenerating] = useState(false)
  const [generatingStep, setGeneratingStep] = useState('')
  const [link, setLink] = useState('')
  const [copied, setCopied] = useState(false)
  const [tunnelUrl, setTunnelUrl] = useState<string | null>(null)
  const [localUrl, setLocalUrl] = useState<string | null>(null)
  const [tunnelInstalled, setTunnelInstalled] = useState(true)

  useEffect(() => {
    fetch('/api/tunnel')
      .then(r => r.json())
      .then((d: { running: boolean; url: string | null; localUrl: string | null; installed: boolean }) => {
        if (d.running && d.url) setTunnelUrl(d.url)
        if (d.localUrl) setLocalUrl(d.localUrl)
        setTunnelInstalled(d.installed !== false)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/directs')
      .then(r => r.json())
      .then((data: { directs?: DirectReport[] }) => {
        setDirects(data.directs ?? [])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (settings.custom_areas) {
      try {
        const parsed = JSON.parse(settings.custom_areas) as string[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setAreas(parsed)
          return
        }
      } catch {}
    }
    setAreas(getModeConfig(settings.app_mode ?? null).defaultAreas)
  }, [settings])

  useEffect(() => {
    if (!directReportId) return
    const d = directs.find(d => d.id === directReportId)
    if (d) {
      setTitle(`${d.name}'s Report`)
      setArea(d.area)
    }
  }, [directReportId, directs])

  const generate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !area) return
    setGenerating(true)

    let resolvedTunnelUrl = tunnelUrl

    // Auto-start tunnel if cloudflared is installed and no tunnel is running yet
    if (!resolvedTunnelUrl && tunnelInstalled) {
      setGeneratingStep('Starting remote tunnel…')
      try {
        const startRes = await fetch('/api/tunnel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'start' }),
        })
        const startData = await startRes.json() as { url?: string | null }
        if (startData.url) {
          resolvedTunnelUrl = startData.url
          setTunnelUrl(startData.url)
        }
      } catch { /* fall back to localUrl */ }
    }

    setGeneratingStep('Creating request…')
    try {
      const res = await fetch('/api/report-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, area, message, directReportId }),
      })
      const data = await res.json() as { request?: { token: string } }
      if (res.ok && data.request) {
        const baseUrl = resolvedTunnelUrl ?? localUrl ?? window.location.origin
        setLink(`${baseUrl}/request/${data.request.token}`)
      }
    } finally {
      setGenerating(false)
      setGeneratingStep('')
    }
  }

  const copy = () => {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const reset = () => { setLink(''); setTitle(''); setArea(''); setMessage(''); setDirectReportId('') }

  if (link) {
    return (
      <div className="space-y-5">
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
          <CheckCircle size={24} className="text-green-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-gray-900">Request link ready</p>
          <p className="text-xs text-gray-500 mt-0.5">Send this to the person you want the {modeConfig.documentLabel.toLowerCase()} from</p>
        </div>
        {tunnelUrl && (
          <div className="flex items-center gap-1.5 text-[10px] text-green-600 font-medium px-1">
            <Globe size={10} /> Remote access active — link works anywhere
          </div>
        )}
        {!tunnelUrl && localUrl && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2">
            <Globe size={13} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              Link uses your local network address ({localUrl}) — works for anyone on the <strong>same WiFi</strong>. For external access, enable remote access in <strong>Settings → Remote Submissions</strong>.
            </p>
          </div>
        )}
        {!tunnelUrl && !localUrl && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
            <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              This link only works on <strong>this machine</strong>. To share with others, enable remote access in <strong>Settings → Remote Submissions</strong>.
            </p>
          </div>
        )}
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-medium text-gray-500">Shareable link</p>
          </div>
          <div className="flex gap-2">
            <input readOnly value={link}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-700 bg-gray-50 focus:outline-none" />
            <button onClick={copy}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-gray-900 text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors">
              {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
            </button>
          </div>
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
      {!tunnelUrl && localUrl && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex gap-2">
          <Globe size={13} className="text-blue-500 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            Link will use your local network address — works on <strong>same WiFi</strong>. For external sharing, enable remote access in Settings.
          </p>
        </div>
      )}
      {!tunnelUrl && !localUrl && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-2">
          <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            Remote access is off — generated links only work on this machine. Enable it in <strong>Settings → Remote Submissions</strong>.
          </p>
        </div>
      )}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">From {modeConfig.personLabel.toLowerCase()} <span className="text-gray-400 font-normal">(optional)</span></label>
          <SearchableDropdown
            value={directReportId}
            placeholder="Not specified"
            options={directs.map(d => ({ label: `${d.name} — ${d.title}`, value: d.id }))}
            onChange={setDirectReportId}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Report title <span className="text-red-400">*</span></label>
          <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
            placeholder="e.g. Q1 Engineering Update"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Area <span className="text-red-400">*</span></label>
          <SearchableDropdown
            value={area}
            placeholder="Select area…"
            options={areas.map(a => ({ label: a, value: a }))}
            onChange={setArea}
          />
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
      </div>
      <button type="submit" disabled={!title || !area || generating}
        className="w-full bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
        {generating ? <><Loader2 size={14} className="animate-spin" />{generatingStep || 'Generating…'}</> : <><Link2 size={14} />Generate request link</>}
      </button>
    </form>
  )
}
