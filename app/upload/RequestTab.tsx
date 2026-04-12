'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, CheckCircle, Link2, Copy, Check, AlertTriangle, Globe, ChevronDown, Search, Wifi, WifiOff } from 'lucide-react'
import type { DirectReport } from './uploadTypes'
import { getModeConfig, type AppMode } from '@/lib/mode'
import { useMode } from '@/components/ModeContext'
import { useSettings } from '@/lib/use-settings'

const MODE_PLACEHOLDERS: Record<AppMode, { title: string; message: string }> = {
 executive: {
 title: 'e.g. Q1 Engineering Update',
 message: 'e.g. Please include your pipeline numbers and any blockers for this quarter.',
 },
 journalism: {
 title: 'e.g. Interview notes — Jane Smith',
 message: 'e.g. Please include any documents, photos, or recordings you can share.',
 },
 team_lead: {
 title: 'e.g. Sprint 14 Status Update',
 message: 'e.g. Please include your blockers and progress since last week.',
 },
 market_research: {
 title: 'e.g. Customer Interview — Alex Chen',
 message: 'e.g. Please share any transcripts, notes, or supporting materials.',
 },
 legal: {
 title: 'e.g. Contract Review — Smith v Jones',
 message: 'e.g. Please include the signed contract and any relevant correspondence.',
 },
 human_resources: {
 title: 'e.g. Q1 Engagement Survey Results',
 message: 'e.g. Please include the anonymised data and any additional context.',
 },
}

interface Project {
 id: string
 name: string
 status: string
}

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
 className="w-full h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs text-left flex items-center justify-between focus:outline-none focus:ring-2 bg-[var(--surface)] h-[38px]">
 <span className={value ? 'text-[var(--text-bright)]' : 'text-[var(--text-muted)]'}>{selectedLabel || placeholder}</span>
 <ChevronDown size={14} className="text-[var(--text-muted)] shrink-0" />
 </button>
 {open && (
 <div className="absolute z-20 mt-1 w-full bg-[var(--surface)] border border-[var(--border)] rounded-[4px] shadow-md overflow-hidden">
 <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)]">
 <Search size={12} className="text-[var(--text-muted)] shrink-0" />
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
 className="w-full text-left px-3 py-2 text-sm text-[var(--text-muted)] hover:bg-[var(--surface-2)]">
 {placeholder}
 </button>
 {filtered.map(o => (
 <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); setQuery('') }}
 className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--surface-2)] text-[var(--text-bright)]">
 {o.label}
 </button>
 ))}
 {filtered.length === 0 && (
 <p className="px-3 py-2 text-xs text-[var(--text-muted)]">No matches</p>
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
 const [projectId, setProjectId] = useState('')
 const [directs, setDirects] = useState<DirectReport[]>([])
 const [projects, setProjects] = useState<Project[]>([])
 const [areas, setAreas] = useState<string[]>(getModeConfig(null).defaultAreas)
 const [generating, setGenerating] = useState(false)
 const [generatingStep, setGeneratingStep] = useState('')
 const [link, setLink] = useState('')
 const [copied, setCopied] = useState(false)
 const [generateError, setGenerateError] = useState('')
 const [tunnelUrl, setTunnelUrl] = useState<string | null>(null)
 const [localUrl, setLocalUrl] = useState<string | null>(null)
 const [tunnelInstalled, setTunnelInstalled] = useState(true)
 const [togglingTunnel, setTogglingTunnel] = useState(false)

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
 fetch('/api/projects')
 .then(r => r.json())
 .then((data: { projects?: Project[] }) => {
 setProjects((data.projects ?? []).filter(p => p.status === 'in_progress'))
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

 const toggleTunnel = async () => {
 if (togglingTunnel) return
 setTogglingTunnel(true)
 try {
 if (tunnelUrl) {
 await fetch('/api/tunnel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stop' }) })
 setTunnelUrl(null)
 } else {
 const res = await fetch('/api/tunnel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }) })
 const data = await res.json() as { url?: string | null }
 if (data.url) setTunnelUrl(data.url)
 }
 } catch { /* ignore */ } finally {
 setTogglingTunnel(false)
 }
 }

 const autoCopy = async (text: string) => {
 try {
 await navigator.clipboard.writeText(text)
 } catch {
 const el = document.createElement('textarea')
 el.value = text
 el.style.position = 'fixed'
 el.style.opacity = '0'
 document.body.appendChild(el)
 el.select()
 document.execCommand('copy')
 document.body.removeChild(el)
 }
 setCopied(true)
 setTimeout(() => setCopied(false), 3000)
 }

 const generate = async (e: React.FormEvent) => {
 e.preventDefault()
 if (!title || !area) return
 setGenerating(true)
 setGenerateError('')

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
 body: JSON.stringify({ title, area, message, directReportId, projectId }),
 })
 const data = await res.json() as { request?: { token: string }; error?: string }
 if (res.ok && data.request) {
 const baseUrl = resolvedTunnelUrl ?? localUrl ?? window.location.origin
 const generated = `${baseUrl}/request/${data.request.token}`
 setLink(generated)
 await autoCopy(generated)
 } else {
 setGenerateError(data.error ?? 'Failed to generate link. Please try again.')
 }
 } catch (e) {
 setGenerateError(String(e))
 } finally {
 setGenerating(false)
 setGeneratingStep('')
 }
 }

 const copy = () => autoCopy(link)

 const reset = () => { setLink(''); setTitle(''); setArea(''); setMessage(''); setDirectReportId(''); setProjectId(''); setGenerateError(''); setCopied(false) }

 if (link) {
 return (
 <div className="space-y-5">
 <div className="bg-[var(--green-dim)] border border-[var(--green)] rounded-[10px] p-5 text-center">
 <CheckCircle size={24} className="text-[var(--green)] mx-auto mb-2" />
 <p className="text-sm font-semibold text-[var(--text-bright)]">Request link ready</p>
 {copied
 ? <p className="text-xs text-[var(--green)] mt-0.5 font-medium">Copied to clipboard</p>
 : <p className="text-xs text-[var(--text-muted)] mt-0.5">Send this to the person you want the {modeConfig.documentLabel.toLowerCase()} from</p>
 }
 </div>
 {tunnelUrl && (
 <div className="flex items-center gap-1.5 text-[10px] text-[var(--green)] font-medium px-1">
 <Wifi size={10} /> Remote access on — link works on any device
 </div>
 )}
 {!tunnelUrl && tunnelInstalled && (
 <div className="bg-[var(--amber-dim)] border border-[var(--amber)] rounded-[10px] p-3 flex items-center justify-between gap-3">
 <div className="flex items-start gap-2">
 <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
 <p className="text-xs text-[var(--amber)]">
 This link only works on <strong>this device</strong>. Turn on remote access so recipients on other devices can open it.
 </p>
 </div>
 <button type="button" onClick={async () => {
 setTogglingTunnel(true)
 try {
 const res = await fetch('/api/tunnel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'start' }) })
 const data = await res.json() as { url?: string | null }
 if (data.url) {
 setTunnelUrl(data.url)
 const newLink = `${data.url}/request/${link.split('/request/')[1]}`
 setLink(newLink)
 await autoCopy(newLink)
 }
 } catch { /* ignore */ } finally { setTogglingTunnel(false) }
 }} disabled={togglingTunnel}
 className="shrink-0 text-xs font-medium px-2.5 py-1 rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50">
 {togglingTunnel ? <Loader2 size={11} className="animate-spin" /> : 'Turn on'}
 </button>
 </div>
 )}
 {!tunnelUrl && !tunnelInstalled && localUrl && (
 <div className="bg-blue-50 border border-blue-200 rounded-[10px] p-3 flex gap-2">
 <Globe size={13} className="text-blue-500 shrink-0 mt-0.5" />
 <p className="text-xs text-blue-700">
 Link uses your local network address — works on <strong>same WiFi</strong> only.
 </p>
 </div>
 )}
 {!tunnelUrl && !tunnelInstalled && !localUrl && (
 <div className="bg-[var(--amber-dim)] border border-[var(--amber)] rounded-[10px] p-3 flex gap-2">
 <AlertTriangle size={13} className="text-amber-500 shrink-0 mt-0.5" />
 <p className="text-xs text-[var(--amber)]">
 This link only works on <strong>this machine</strong>.
 </p>
 </div>
 )}
 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4 space-y-3">
 <div className="flex items-center gap-1.5">
 <p className="text-xs font-medium text-[var(--text-muted)]">Shareable link</p>
 </div>
 <div className="flex gap-2">
 <input readOnly value={link}
 className="flex-1 h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs font-mono text-[var(--text-body)] bg-[var(--surface-2)] focus:outline-none" />
 <button onClick={copy}
 className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-[var(--ink)] text-[var(--ink-contrast)] text-xs font-medium rounded-[4px] hover:bg-[var(--ink)] transition-colors">
 {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
 </button>
 </div>
 </div>
 <button onClick={reset}
 className="w-full border border-[var(--border)] text-[var(--text-body)] text-sm font-medium h-7 px-3 rounded-[4px] :bg-[var(--surface-2)] transition-colors">
 Create another request
 </button>
 </div>
 )
 }

 const currentMode = (settings.app_mode ?? 'executive') as AppMode
 const placeholders = MODE_PLACEHOLDERS[currentMode] ?? MODE_PLACEHOLDERS.executive

 return (
 <form onSubmit={generate} className="space-y-5">
 {/* Remote access toggle */}
 <div className={`rounded-[10px] p-3 flex items-center justify-between gap-3 ${tunnelUrl ? 'bg-[var(--green-dim)] border border-[var(--green)]' : 'bg-[var(--surface-2)] border border-[var(--border)]'}`}>
 <div className="flex items-center gap-2 min-w-0">
 {tunnelUrl
 ? <Wifi size={13} className="text-[var(--green)] shrink-0" />
 : <WifiOff size={13} className="text-[var(--text-muted)] shrink-0" />}
 <div className="min-w-0">
 <p className={`text-xs font-medium ${tunnelUrl ? 'text-green-700' : 'text-[var(--text-subtle)]'}`}>
 {tunnelUrl ? 'Remote access on — link works anywhere' : localUrl ? 'Local access only — same WiFi' : 'Remote access off — this machine only'}
 </p>
 {tunnelUrl && <p className="text-[10px] text-[var(--green)] font-mono truncate">{tunnelUrl}</p>}
 </div>
 </div>
 {tunnelInstalled && (
 <button type="button" onClick={toggleTunnel} disabled={togglingTunnel}
 className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-md transition-colors disabled:opacity-50 ${tunnelUrl ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-[var(--ink)] text-[var(--ink-contrast)] hover:bg-[var(--ink)]'}`}>
 {togglingTunnel ? <Loader2 size={11} className="animate-spin" /> : tunnelUrl ? 'Turn off' : 'Turn on'}
 </button>
 )}
 </div>

 <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-4 space-y-4">
 <div>
 <label className="block text-xs font-medium text-[var(--text-body)] mb-1.5">From {modeConfig.personLabel.toLowerCase()} <span className="text-[var(--text-muted)] font-normal">(optional)</span></label>
 <SearchableDropdown
 value={directReportId}
 placeholder="Not specified"
 options={directs.map(d => ({ label: `${d.name} — ${d.title}`, value: d.id }))}
 onChange={setDirectReportId}
 />
 </div>
 {projects.length > 0 && (
 <div>
 <label className="block text-xs font-medium text-[var(--text-body)] mb-1.5">{modeConfig.projectLabel} <span className="text-[var(--text-muted)] font-normal">(optional)</span></label>
 <SearchableDropdown
 value={projectId}
 placeholder={`No ${modeConfig.projectLabel.toLowerCase()} selected`}
 options={projects.map(p => ({ label: p.name, value: p.id }))}
 onChange={setProjectId}
 />
 </div>
 )}
 <div>
 <label className="block text-xs font-medium text-[var(--text-body)] mb-1.5">{modeConfig.documentLabel} title <span className="text-[var(--red)]">*</span></label>
 <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
 placeholder={placeholders.title}
 className="w-full h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2" />
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-body)] mb-1.5">Area <span className="text-[var(--red)]">*</span></label>
 <SearchableDropdown
 value={area}
 placeholder="Select area…"
 options={areas.map(a => ({ label: a, value: a }))}
 onChange={setArea}
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-[var(--text-body)] mb-1.5">Message to recipient <span className="text-[var(--text-muted)] font-normal">(optional)</span></label>
 <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
 placeholder={placeholders.message}
 className="w-full h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2 resize-none" />
 </div>
 </div>
 <div className="bg-[var(--surface-2)] border border-[var(--border)] rounded-[10px] px-4 py-3 text-xs text-[var(--text-muted)] leading-relaxed">
 A unique link will be generated. The recipient can open it in any browser — no account or login required.
 </div>
 {generateError && (
 <div className="bg-[var(--red-dim)] border border-[var(--red)] rounded-[10px] p-3 flex gap-2">
 <AlertTriangle size={13} className="text-[var(--red)] shrink-0 mt-0.5" />
 <p className="text-xs text-[var(--red)]">{generateError}</p>
 </div>
 )}
 <button type="submit" disabled={!title || !area || generating}
 className="w-full bg-[var(--ink)] text-[var(--ink-contrast)] text-sm font-medium h-7 px-3 rounded-[4px] :bg-[var(--ink)] transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
 {generating ? <><Loader2 size={14} className="animate-spin" />{generatingStep || 'Generating…'}</> : <><Link2 size={14} />Generate request link</>}
 </button>
 </form>
 )
}
