'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Plus, Trash2, CheckCircle2, XCircle, AlertTriangle, HelpCircle, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Claim {
  id: string
  text: string
  source: string | null
  sourceType: string
  status: string
  notes: string | null
  reportId: string | null
  report: { id: string; title: string } | null
  createdAt: string
}

const STATUSES = ['unverified', 'verified', 'disputed', 'false', 'needs_more'] as const
type ClaimStatus = typeof STATUSES[number]

const STATUS_CONFIG: Record<ClaimStatus, { label: string; color: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  unverified:  { label: 'Unverified',   color: 'text-gray-500 dark:text-zinc-400',   icon: Circle },
  verified:    { label: 'Verified',     color: 'text-emerald-600 dark:text-emerald-400', icon: CheckCircle2 },
  disputed:    { label: 'Disputed',     color: 'text-amber-600 dark:text-amber-400',  icon: AlertTriangle },
  false:       { label: 'False',        color: 'text-red-500 dark:text-red-400',      icon: XCircle },
  needs_more:  { label: 'Needs more',   color: 'text-blue-600 dark:text-blue-400',    icon: HelpCircle },
}

const SOURCE_TYPES = ['document', 'interview', 'social', 'official'] as const

// ── Main component ────────────────────────────────────────────────────────────

export default function ClaimsClient() {
  const [claims, setClaims]         = useState<Claim[]>([])
  const [loading, setLoading]       = useState(true)
  const [filterStatus, setFilter]   = useState<ClaimStatus | 'all'>('all')
  const [showForm, setShowForm]     = useState(false)

  // Form state
  const [fText, setFText]           = useState('')
  const [fSource, setFSource]       = useState('')
  const [fSourceType, setFSourceType] = useState<string>('document')
  const [saving, setSaving]         = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/claims')
      if (res.ok) { const d = await res.json() as { claims: Claim[] }; setClaims(d.claims) }
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const handleCreate = async () => {
    if (!fText.trim()) return
    setSaving(true)
    try {
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: fText, source: fSource || undefined, sourceType: fSourceType }),
      })
      if (res.ok) {
        const d = await res.json() as { claim: Claim }
        setClaims(prev => [d.claim, ...prev])
        setFText(''); setFSource(''); setFSourceType('document')
        setShowForm(false)
      }
    } catch { /* silent */ }
    finally { setSaving(false) }
  }

  const updateStatus = async (id: string, status: string) => {
    setClaims(prev => prev.map(c => c.id === id ? { ...c, status } : c))
    await fetch(`/api/claims/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }).catch(() => {})
  }

  const updateNotes = async (id: string, notes: string) => {
    setClaims(prev => prev.map(c => c.id === id ? { ...c, notes } : c))
    await fetch(`/api/claims/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notes }),
    }).catch(() => {})
  }

  const handleDelete = async (id: string) => {
    setClaims(prev => prev.filter(c => c.id !== id))
    await fetch(`/api/claims/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  const visible = filterStatus === 'all' ? claims : claims.filter(c => c.status === filterStatus)

  const inputCls = 'w-full border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/30 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500'

  if (loading) return <div className="flex items-center justify-center min-h-[40vh]"><Loader2 size={18} className="animate-spin text-gray-400" /></div>

  // Counts per status
  const counts = Object.fromEntries(STATUSES.map(s => [s, claims.filter(c => c.status === s).length]))

  return (
    <div className="max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-zinc-50">Claims Tracker</h1>
          <p className="text-sm text-gray-400 dark:text-zinc-500 mt-0.5">Track factual claims and their verification status.</p>
        </div>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors">
          <Plus size={14} /> Add claim
        </button>
      </div>

      {/* Status filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <button onClick={() => setFilter('all')}
          className={cn('px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border', filterStatus === 'all' ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent' : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400')}>
          All ({claims.length})
        </button>
        {STATUSES.map(s => {
          const cfg = STATUS_CONFIG[s]
          const Icon = cfg.icon
          return (
            <button key={s} onClick={() => setFilter(s)}
              className={cn('flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors border', filterStatus === s ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-transparent' : 'border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400')}>
              <Icon size={9} /> {cfg.label} ({counts[s] ?? 0})
            </button>
          )
        })}
      </div>

      {/* Add claim form */}
      {showForm && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-zinc-50">Add Claim</h2>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Claim *</label>
            <textarea value={fText} onChange={e => setFText(e.target.value)} rows={2} placeholder="The exact claim to track…" className={cn(inputCls, 'resize-none')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Source</label>
              <input value={fSource} onChange={e => setFSource(e.target.value)} placeholder="Who made this claim?" className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-zinc-300 mb-1">Source type</label>
              <select value={fSourceType} onChange={e => setFSourceType(e.target.value)} className={inputCls}>
                {SOURCE_TYPES.map(t => <option key={t} value={t} className="capitalize">{t}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={handleCreate} disabled={saving || !fText.trim()}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-gray-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 flex items-center gap-2">
              {saving ? <Loader2 size={13} className="animate-spin" /> : null} Add
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Claims list */}
      {visible.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-zinc-500 text-sm">
          {filterStatus === 'all' ? 'No claims yet. Add the first one above.' : `No ${STATUS_CONFIG[filterStatus as ClaimStatus]?.label?.toLowerCase()} claims.`}
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(claim => {
            const cfg = STATUS_CONFIG[claim.status as ClaimStatus] ?? STATUS_CONFIG.unverified
            const Icon = cfg.icon
            return (
              <div key={claim.id} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-4 space-y-2">
                <div className="flex items-start gap-3">
                  {/* Status icon */}
                  <Icon size={16} className={cn('shrink-0 mt-0.5', cfg.color)} />

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <p className="text-sm text-gray-800 dark:text-zinc-100 leading-relaxed">{claim.text}</p>

                    <div className="flex items-center gap-3 flex-wrap">
                      {claim.source && (
                        <span className="text-[11px] text-gray-500 dark:text-zinc-400">
                          {claim.source} <span className="text-gray-300 dark:text-zinc-600">· {claim.sourceType}</span>
                        </span>
                      )}
                      {claim.report && (
                        <span className="text-[11px] text-gray-400 dark:text-zinc-500 truncate max-w-[200px]">
                          via {claim.report.title}
                        </span>
                      )}
                    </div>

                    {/* Notes */}
                    <textarea
                      defaultValue={claim.notes ?? ''}
                      onBlur={e => void updateNotes(claim.id, e.target.value)}
                      rows={1}
                      placeholder="Add notes…"
                      className="w-full text-xs border border-gray-100 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 dark:bg-zinc-800/50 dark:text-zinc-300 dark:placeholder-zinc-600 resize-none"
                    />
                  </div>

                  {/* Status dropdown */}
                  <select
                    value={claim.status}
                    onChange={e => void updateStatus(claim.id, e.target.value)}
                    className={cn('text-[11px] font-medium px-2 py-1 rounded-full border-0 cursor-pointer focus:outline-none bg-transparent shrink-0', cfg.color)}
                  >
                    {STATUSES.map(s => <option key={s} value={s} className="bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-50">{STATUS_CONFIG[s].label}</option>)}
                  </select>

                  <button onClick={() => handleDelete(claim.id)} className="text-gray-300 dark:text-zinc-600 hover:text-red-400 transition-colors shrink-0">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
