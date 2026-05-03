'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Trash2, ChevronDown, FileText, Copy, Check } from 'lucide-react'
import LayoutD from '@/components/layouts/LayoutD'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface FoiaRequest {
 id: string
 agency: string
 subject: string
 description: string | null
 status: string
 filedAt: string | null
 dueAt: string | null
 receivedAt: string | null
 trackingNum: string | null
 notes: string | null
 projectId: string | null
 createdAt: string
}

const STATUSES = ['draft', 'submitted', 'acknowledged', 'partial', 'fulfilled', 'denied', 'appealed'] as const
type Status = typeof STATUSES[number]

const STATUS_COLORS: Record<Status, string> = {
 draft: 'bg-[var(--surface-2)] text-[var(--text-subtle)]',
 submitted: 'bg-blue-50 text-blue-700',
 acknowledged: 'bg-indigo-50 text-indigo-700',
 partial: 'bg-amber-50 text-amber-700',
 fulfilled: 'bg-emerald-50 text-emerald-700',
 denied: 'bg-red-50 text-red-700',
 appealed: 'bg-orange-50 text-orange-700',
}

// ── Jurisdiction presets ───────────────────────────────────────────────────────

interface Jurisdiction {
 label: string
 days: number
 calendar: boolean // true = calendar days, false = business days
}

const JURISDICTIONS: Jurisdiction[] = [
 { label: 'Federal (FOIA)',        days: 20, calendar: false },
 { label: 'California (CPRA)',     days: 10, calendar: true  },
 { label: 'New York (FOIL)',       days:  5, calendar: false },
 { label: 'Texas (TPIA)',          days: 10, calendar: false },
 { label: 'Florida (Chapter 119)', days: 10, calendar: false },
 { label: 'Illinois (FOIA)',       days:  5, calendar: false },
 { label: 'Washington (PRA)',      days:  5, calendar: false },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
 if (!iso) return '—'
 return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function isOverdue(dueAt: string | null, status: string): boolean {
 if (!dueAt || status === 'fulfilled' || status === 'denied') return false
 return new Date(dueAt) < new Date()
}

function addBusinessDays(from: Date, days: number): Date {
 const d = new Date(from)
 let added = 0
 while (added < days) {
   d.setDate(d.getDate() + 1)
   const dow = d.getDay()
   if (dow !== 0 && dow !== 6) added++
 }
 return d
}

function addCalendarDays(from: Date, days: number): Date {
 const d = new Date(from)
 d.setDate(d.getDate() + days)
 return d
}

function calcDueDate(filedDateStr: string, j: Jurisdiction): string {
 if (!filedDateStr) return ''
 const base = new Date(filedDateStr + 'T12:00:00')
 const due = j.calendar ? addCalendarDays(base, j.days) : addBusinessDays(base, j.days)
 return due.toISOString().split('T')[0]
}

// ── Letter modal ──────────────────────────────────────────────────────────────

function LetterModal({ letter, onClose }: { letter: string; onClose: () => void }) {
 const [copied, setCopied] = useState(false)

 const copy = async () => {
   await navigator.clipboard.writeText(letter)
   setCopied(true)
   setTimeout(() => setCopied(false), 2000)
 }

 return (
   <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
     <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[12px] shadow-xl w-full max-w-2xl flex flex-col max-h-[80vh]">
       <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)] shrink-0">
         <span className="text-sm font-semibold text-[var(--text-bright)]">Draft FOIA Letter</span>
         <div className="flex items-center gap-2">
           <button
             onClick={copy}
             className="inline-flex items-center gap-1.5 h-7 px-3 rounded-[4px] text-xs font-medium border border-[var(--border)] text-[var(--text-subtle)] hover:bg-[var(--surface-2)] transition-colors"
           >
             {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
             {copied ? 'Copied' : 'Copy'}
           </button>
           <button
             onClick={onClose}
             className="text-[var(--text-muted)] hover:text-[var(--text-body)] text-lg leading-none px-1"
           >
             ×
           </button>
         </div>
       </div>
       <textarea
         readOnly
         value={letter}
         className="flex-1 min-h-0 p-5 text-xs font-mono text-[var(--text-body)] resize-none focus:outline-none bg-transparent leading-relaxed"
       />
     </div>
   </div>
 )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function FoiaClient() {
 const [requests, setRequests] = useState<FoiaRequest[]>([])
 const [loading, setLoading] = useState(true)
 const [showForm, setShowForm] = useState(false)
 const [expandedId, setExpandedId] = useState<string | null>(null)

 // Form state
 const [fAgency, setFAgency] = useState('')
 const [fSubject, setFSubject] = useState('')
 const [fDesc, setFDesc] = useState('')
 const [fFiledAt, setFFiledAt] = useState('')
 const [fDueAt, setFDueAt] = useState('')
 const [fTrack, setFTrack] = useState('')
 const [fJurisdiction, setFJurisdiction] = useState<Jurisdiction>(JURISDICTIONS[0])
 const [saving, setSaving] = useState(false)

 // Letter state
 const [letterReqId, setLetterReqId] = useState<string | null>(null)
 const [letterText, setLetterText] = useState<string | null>(null)
 const [letterLoading, setLetterLoading] = useState(false)
 const [letterRequesterName, setLetterRequesterName] = useState('')
 const [letterRequesterAddress, setLetterRequesterAddress] = useState('')

 const load = useCallback(async () => {
   setLoading(true)
   try {
     const res = await fetch('/api/foia')
     if (res.ok) { const d = await res.json() as { requests: FoiaRequest[] }; setRequests(d.requests) }
   } catch { /* silent */ }
   finally { setLoading(false) }
 }, [])

 useEffect(() => { void load() }, [load])

 // Auto-calc due date when filed date or jurisdiction changes
 useEffect(() => {
   if (fFiledAt) setFDueAt(calcDueDate(fFiledAt, fJurisdiction))
 }, [fFiledAt, fJurisdiction])

 const handleCreate = async () => {
   if (!fAgency.trim() || !fSubject.trim()) return
   setSaving(true)
   try {
     const res = await fetch('/api/foia', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ agency: fAgency, subject: fSubject, description: fDesc, filedAt: fFiledAt || undefined, dueAt: fDueAt || undefined, trackingNum: fTrack || undefined }),
     })
     if (res.ok) {
       const d = await res.json() as { request: FoiaRequest }
       setRequests(prev => [d.request, ...prev])
       setFAgency(''); setFSubject(''); setFDesc(''); setFFiledAt(''); setFDueAt(''); setFTrack('')
       setFJurisdiction(JURISDICTIONS[0])
       setShowForm(false)
     }
   } catch { /* silent */ }
   finally { setSaving(false) }
 }

 const updateStatus = async (id: string, status: string) => {
   setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r))
   await fetch(`/api/foia/${id}`, {
     method: 'PATCH',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ status }),
   }).catch(() => {})
 }

 const updateNotes = async (id: string, notes: string) => {
   setRequests(prev => prev.map(r => r.id === id ? { ...r, notes } : r))
   await fetch(`/api/foia/${id}`, {
     method: 'PATCH',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ notes }),
   }).catch(() => {})
 }

 const handleDelete = async (id: string) => {
   setRequests(prev => prev.filter(r => r.id !== id))
   await fetch(`/api/foia/${id}`, { method: 'DELETE' }).catch(() => {})
 }

 const draftLetter = async (req: FoiaRequest) => {
   setLetterReqId(req.id)
   setLetterText(null)
   setLetterLoading(true)
   try {
     const res = await fetch('/api/foia/draft-letter', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         agency: req.agency,
         subject: req.subject,
         description: req.description,
         requesterName: letterRequesterName || undefined,
         requesterAddress: letterRequesterAddress || undefined,
       }),
     })
     if (res.ok) {
       const d = await res.json() as { letter: string }
       setLetterText(d.letter)
     }
   } catch { /* silent */ }
   finally { setLetterLoading(false) }
 }

 const inputCls = 'w-full h-8 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30 bg-[var(--surface)]'

 if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={18} className="animate-spin text-[var(--text-muted)]" /></div>

 const header = (
   <div className="px-7 py-5 flex items-center justify-between gap-4">
     <h1 className="text-2xl font-semibold text-[var(--text-bright)]">FOIA Tracker</h1>
     <button
       onClick={() => setShowForm(v => !v)}
       className="inline-flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-full bg-[var(--ink)] text-[var(--ink-contrast)] hover:opacity-90 transition-colors shrink-0"
     >
       <Plus size={13} /> New request
     </button>
   </div>
 )

 return (
   <>
   {letterText && <LetterModal letter={letterText} onClose={() => { setLetterText(null); setLetterReqId(null) }} />}
   <LayoutD header={header}>
   <div className="space-y-5">

   {/* New request form */}
   {showForm && (
     <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 space-y-3">
       <h2 className="text-sm font-semibold text-[var(--text-bright)]">New FOIA Request</h2>
       <div className="grid grid-cols-2 gap-3">
         <div>
           <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Agency *</label>
           <input value={fAgency} onChange={e => setFAgency(e.target.value)} placeholder="e.g. EPA, DOJ, NYPD" className={inputCls} />
         </div>
         <div>
           <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Subject *</label>
           <input value={fSubject} onChange={e => setFSubject(e.target.value)} placeholder="Brief subject line" className={inputCls} />
         </div>
       </div>
       <div>
         <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Description</label>
         <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={2} placeholder="What records are you requesting?" className={cn(inputCls, 'h-auto resize-none py-2')} />
       </div>
       <div className="grid grid-cols-4 gap-3">
         <div>
           <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Jurisdiction</label>
           <select
             value={fJurisdiction.label}
             onChange={e => setFJurisdiction(JURISDICTIONS.find(j => j.label === e.target.value) ?? JURISDICTIONS[0])}
             className={cn(inputCls, 'cursor-pointer')}
           >
             {JURISDICTIONS.map(j => <option key={j.label} value={j.label}>{j.label}</option>)}
           </select>
         </div>
         <div>
           <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Filed date</label>
           <input type="date" value={fFiledAt} onChange={e => setFFiledAt(e.target.value)} className={inputCls} />
         </div>
         <div>
           <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">
             Response due
             {fFiledAt && <span className="ml-1 font-normal text-[var(--text-muted)]">({fJurisdiction.days} {fJurisdiction.calendar ? 'cal.' : 'bus.'} days)</span>}
           </label>
           <input type="date" value={fDueAt} onChange={e => setFDueAt(e.target.value)} className={inputCls} />
         </div>
         <div>
           <label className="block text-xs font-medium text-[var(--text-subtle)] mb-1">Tracking #</label>
           <input value={fTrack} onChange={e => setFTrack(e.target.value)} placeholder="Agency reference" className={inputCls} />
         </div>
       </div>
       <div className="flex gap-2 pt-1">
         <button onClick={handleCreate} disabled={saving || !fAgency.trim() || !fSubject.trim()}
           className="h-7 px-3 rounded-[4px] text-xs font-medium bg-[var(--ink)] text-[var(--ink-contrast)] hover:opacity-90 transition-colors disabled:opacity-50 flex items-center gap-2">
           {saving ? <Loader2 size={13} className="animate-spin" /> : null} Save
         </button>
         <button onClick={() => setShowForm(false)} className="h-7 px-3 rounded-[4px] text-xs font-medium border border-[var(--border)] text-[var(--text-subtle)] hover:bg-[var(--surface-2)] transition-colors">
           Cancel
         </button>
       </div>
     </div>
   )}

   {/* Requests list */}
   {requests.length === 0 ? (
     <div className="text-center py-12 text-[var(--text-muted)] text-sm">
       No FOIA requests yet. Add your first one above.
     </div>
   ) : (
     <div className="space-y-2">
       {requests.map(req => {
         const overdue = isOverdue(req.dueAt, req.status)
         const expanded = expandedId === req.id
         const generatingLetter = letterLoading && letterReqId === req.id
         return (
           <div key={req.id} className={cn('bg-[var(--surface)] border rounded-[10px] overflow-hidden transition-colors', overdue ? 'border-red-200' : 'border-[var(--border)]')}>
             {/* Row */}
             <div className="flex items-center gap-3 px-4 py-3">
               <button onClick={() => setExpandedId(expanded ? null : req.id)} className="flex-1 flex items-center gap-3 text-left min-w-0">
                 <ChevronDown size={14} className={cn('text-[var(--text-muted)] shrink-0 transition-transform', expanded && 'rotate-180')} />
                 <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-2 flex-wrap">
                     <span className="text-sm font-medium text-[var(--text-bright)] truncate">{req.agency}</span>
                     <span className="text-xs text-[var(--text-muted)] truncate">— {req.subject}</span>
                   </div>
                   <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                     {req.trackingNum && <span className="text-[11px] font-mono text-[var(--text-muted)]">#{req.trackingNum}</span>}
                     <span className="text-[11px] text-[var(--text-muted)]">Filed {fmtDate(req.filedAt)}</span>
                     {req.dueAt && (
                       <span className={cn('text-[11px]', overdue ? 'text-[var(--red)] font-medium' : 'text-[var(--text-muted)]')}>
                         Due {fmtDate(req.dueAt)}{overdue ? ' — overdue' : ''}
                       </span>
                     )}
                   </div>
                 </div>
               </button>

               <select
                 value={req.status}
                 onChange={e => void updateStatus(req.id, e.target.value)}
                 className={cn('text-xs font-medium h-7 px-2 rounded-[4px] border-0 cursor-pointer focus:outline-none', STATUS_COLORS[req.status as Status] ?? STATUS_COLORS.draft)}
               >
                 {STATUSES.map(s => <option key={s} value={s} className="bg-[var(--surface)] text-[var(--text-bright)] capitalize">{s}</option>)}
               </select>

               <button onClick={() => handleDelete(req.id)} className="text-[var(--border)] hover:text-[var(--red)] transition-colors shrink-0">
                 <Trash2 size={13} />
               </button>
             </div>

             {/* Expanded detail */}
             {expanded && (
               <div className="px-4 pb-4 border-t border-[var(--border)] pt-3 space-y-3">
                 {req.description && <p className="text-xs text-[var(--text-subtle)] leading-relaxed">{req.description}</p>}

                 {/* Letter generator */}
                 <div className="space-y-2">
                   <div className="flex items-center gap-2">
                     <span className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wide">Draft request letter</span>
                   </div>
                   <div className="grid grid-cols-2 gap-2">
                     <input
                       value={letterRequesterName}
                       onChange={e => setLetterRequesterName(e.target.value)}
                       placeholder="Your name (optional)"
                       className="h-7 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/30 bg-[var(--surface)]"
                     />
                     <input
                       value={letterRequesterAddress}
                       onChange={e => setLetterRequesterAddress(e.target.value)}
                       placeholder="Your address (optional)"
                       className="h-7 border border-[var(--border)] rounded-[4px] px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/30 bg-[var(--surface)]"
                     />
                   </div>
                   <button
                     onClick={() => void draftLetter(req)}
                     disabled={generatingLetter}
                     className="inline-flex items-center gap-1.5 h-7 px-3 rounded-[4px] text-xs font-medium border border-[var(--border)] text-[var(--text-subtle)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50"
                   >
                     {generatingLetter ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                     {generatingLetter ? 'Drafting…' : 'Generate letter'}
                   </button>
                 </div>

                 <div>
                   <label className="block text-[11px] font-medium text-[var(--text-muted)] mb-1">Notes</label>
                   <textarea
                     defaultValue={req.notes ?? ''}
                     onBlur={e => void updateNotes(req.id, e.target.value)}
                     rows={2}
                     placeholder="Add notes…"
                     className="w-full text-xs border border-[var(--border)] rounded-[4px] px-3 py-2 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 resize-none bg-[var(--surface)]"
                   />
                 </div>
               </div>
             )}
           </div>
         )
       })}
     </div>
   )}
   </div>
   </LayoutD>
   </>
 )
}
