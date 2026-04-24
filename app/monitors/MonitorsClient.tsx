'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, RefreshCw, Pause, Play, Trash2, ExternalLink, Eye, ChevronDown, ChevronRight, Loader2, AlertTriangle, CheckCircle2, Clock, X } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import SelectField from '@/components/SelectField'
import { cn, formatRelativeDate } from '@/lib/utils'

interface DiffLine { type: 'add' | 'remove' | 'same'; text: string }

interface Change {
  id: string
  oldHash: string | null
  newHash: string
  diff: string
  summary: string | null
  createdAt: string
}

interface Monitor {
  id: string
  name: string
  url: string
  selector: string | null
  intervalMins: number
  status: string
  lastCheckedAt: string | null
  lastError: string | null
  errorCount: number
  createdAt: string
  _count: { changes: number }
  changes: Array<{ createdAt: string; summary: string | null }>
}

interface MonitorDetail extends Omit<Monitor, 'changes' | '_count'> {
  changes: Change[]
}

const INTERVALS = [
  { value: 15, label: 'Every 15 min' },
  { value: 30, label: 'Every 30 min' },
  { value: 60, label: 'Every hour' },
  { value: 360, label: 'Every 6 hours' },
  { value: 720, label: 'Every 12 hours' },
  { value: 1440, label: 'Every 24 hours' },
]

export default function MonitorsClient({ projectId }: { projectId: string | null }) {
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [checking, setChecking] = useState(false)
  const [checkingId, setCheckingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<MonitorDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Add form state
  const [formName, setFormName] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formSelector, setFormSelector] = useState('')
  const [formInterval, setFormInterval] = useState(60)
  const [formError, setFormError] = useState('')
  const [adding, setAdding] = useState(false)

  const fetchMonitors = useCallback(async () => {
    try {
      const url = projectId ? `/api/monitors?projectId=${projectId}` : '/api/monitors'
      const res = await fetch(url)
      if (!res.ok) { setLoading(false); return }
      const data = await res.json() as { monitors: Monitor[] }
      setMonitors(data.monitors)
    } catch { /* network error */ }
    setLoading(false)
  }, [projectId])

  useEffect(() => { fetchMonitors() }, [fetchMonitors])

  // Auto-check due monitors on page load
  useEffect(() => {
    fetch('/api/monitors', { method: 'PATCH' })
      .then(r => { if (r.ok) return fetchMonitors() })
      .catch(() => {})
  }, [fetchMonitors])

  const handleAdd = async () => {
    setFormError('')
    if (!formName.trim()) { setFormError('Name is required'); return }
    if (!formUrl.trim()) { setFormError('URL is required'); return }
    try { new URL(formUrl) } catch { setFormError('Invalid URL'); return }

    setAdding(true)
    const res = await fetch('/api/monitors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: formName.trim(),
        url: formUrl.trim(),
        selector: formSelector.trim() || undefined,
        intervalMins: formInterval,
        projectId: projectId ?? undefined,
      }),
    })
    if (!res.ok) {
      const data = await res.json() as { error?: string }
      setFormError(data.error ?? 'Failed to add monitor')
      setAdding(false)
      return
    }

    // Trigger initial check
    const data = await res.json() as { monitor: { id: string } }
    await fetch(`/api/monitors/${data.monitor.id}/check`, { method: 'POST' })

    setFormName('')
    setFormUrl('')
    setFormSelector('')
    setFormInterval(60)
    setShowAdd(false)
    setAdding(false)
    fetchMonitors()
  }

  const checkNow = async (id: string) => {
    setCheckingId(id)
    await fetch(`/api/monitors/${id}/check`, { method: 'POST' })
    setCheckingId(null)
    fetchMonitors()
  }

  const checkAll = async () => {
    setChecking(true)
    await fetch('/api/monitors', { method: 'PATCH' })
    setChecking(false)
    fetchMonitors()
  }

  const toggleStatus = async (id: string, current: string) => {
    await fetch(`/api/monitors/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: current === 'active' ? 'paused' : 'active' }),
    })
    fetchMonitors()
  }

  const deleteMonitor = async (id: string) => {
    if (!window.confirm('Delete this monitor and all its change history?')) return
    await fetch(`/api/monitors/${id}`, { method: 'DELETE' })
    if (expandedId === id) { setExpandedId(null); setDetail(null) }
    fetchMonitors()
  }

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null)
      setDetail(null)
      return
    }
    setExpandedId(id)
    setDetailLoading(true)
    const res = await fetch(`/api/monitors/${id}`)
    const data = await res.json() as { monitor: MonitorDetail }
    setDetail(data.monitor)
    setDetailLoading(false)
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-bright)]">Web Monitor</h1>
          <p className="text-sm text-[var(--text-muted)] mt-0.5">
            Track web pages for changes — get notified when content updates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={checkAll} disabled={checking || monitors.length === 0}>
            <RefreshCw size={13} className={checking ? 'animate-spin' : ''} />
            Check all
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowAdd(v => !v)}>
            <Plus size={13} />
            Add monitor
          </Button>
        </div>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em]">New monitor</span>
            <button onClick={() => setShowAdd(false)} className="text-[var(--text-muted)] hover:text-[var(--text-body)]">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs text-[var(--text-subtle)] mb-1 block">Name</label>
              <Input inputSize="sm" value={formName} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormName(e.target.value)} placeholder="e.g. City Council Agenda" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-subtle)] mb-1 block">URL</label>
              <Input inputSize="sm" value={formUrl} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormUrl(e.target.value)} placeholder="https://example.gov/meetings" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-subtle)] mb-1 block">CSS selector <span className="text-[var(--text-muted)]">(optional)</span></label>
              <Input inputSize="sm" value={formSelector} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormSelector(e.target.value)} placeholder="e.g. #main-content, .article-body" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-subtle)] mb-1 block">Check interval</label>
              <SelectField
                value={String(formInterval)}
                onChange={v => setFormInterval(Number(v))}
                options={INTERVALS.map(i => ({ value: String(i.value), label: i.label }))}
              />
            </div>
          </div>
          {formError && <p className="text-xs text-[var(--red)] mb-3">{formError}</p>}
          <div className="flex justify-end">
            <Button variant="primary" size="sm" onClick={handleAdd} disabled={adding}>
              {adding ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              {adding ? 'Adding…' : 'Add & check now'}
            </Button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 text-[var(--text-muted)]">
          <Loader2 size={16} className="animate-spin mr-2" /> Loading monitors…
        </div>
      )}

      {/* Empty state */}
      {!loading && monitors.length === 0 && (
        <div className="text-center py-16">
          <Eye size={32} className="mx-auto text-[var(--text-muted)] mb-3" />
          <h2 className="text-sm font-semibold text-[var(--text-body)] mb-1">No monitors yet</h2>
          <p className="text-xs text-[var(--text-muted)] mb-4">Add a URL to start tracking web page changes</p>
          <Button variant="primary" size="sm" onClick={() => setShowAdd(true)}>
            <Plus size={13} /> Add your first monitor
          </Button>
        </div>
      )}

      {/* Monitor list */}
      <div className="space-y-3">
        {monitors.map(m => {
          const isExpanded = expandedId === m.id
          const hasError = m.errorCount > 0
          const lastChange = m.changes[0]

          return (
            <div key={m.id} className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] overflow-hidden">
              {/* Monitor header row */}
              <div className="px-4 py-3 flex items-center gap-3">
                <button onClick={() => toggleExpand(m.id)} className="text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors">
                  {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={cn(
                      'w-2 h-2 rounded-full shrink-0',
                      m.status === 'active' ? 'bg-[var(--green)]' : 'bg-[var(--text-muted)]'
                    )} />
                    <button
                      onClick={() => toggleExpand(m.id)}
                      className="text-sm font-semibold text-[var(--text-bright)] hover:underline truncate text-left"
                    >
                      {m.name}
                    </button>
                    {hasError && (
                      <span className="flex items-center gap-1 text-[10px] text-[var(--red)] font-medium">
                        <AlertTriangle size={10} /> Error
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-[var(--blue)] truncate max-w-xs flex items-center gap-1"
                    >
                      {m.url.replace(/^https?:\/\//, '').slice(0, 50)}
                      <ExternalLink size={9} />
                    </a>
                    {m.selector && <span className="font-mono text-[10px] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">{m.selector}</span>}
                    <span className="flex items-center gap-1">
                      <Clock size={10} />
                      {INTERVALS.find(i => i.value === m.intervalMins)?.label ?? `${m.intervalMins}m`}
                    </span>
                    <span>{m._count.changes} change{m._count.changes !== 1 ? 's' : ''}</span>
                    {m.lastCheckedAt && <span>Checked {formatRelativeDate(new Date(m.lastCheckedAt))}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => checkNow(m.id)}
                    disabled={checkingId === m.id}
                    className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50"
                    title="Check now"
                  >
                    <RefreshCw size={13} className={checkingId === m.id ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={() => toggleStatus(m.id, m.status)}
                    className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--surface-2)] transition-colors"
                    title={m.status === 'active' ? 'Pause' : 'Resume'}
                  >
                    {m.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
                  </button>
                  <button
                    onClick={() => deleteMonitor(m.id)}
                    className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--red)] hover:bg-[var(--surface-2)] transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Last change summary */}
              {lastChange?.summary && !isExpanded && (
                <div className="px-4 pb-3 -mt-1">
                  <p className="text-xs text-[var(--text-subtle)] pl-7 line-clamp-1">
                    <CheckCircle2 size={10} className="inline mr-1 text-[var(--green)]" />
                    {lastChange.summary}
                  </p>
                </div>
              )}

              {/* Expanded: change history */}
              {isExpanded && (
                <div className="border-t border-[var(--border)] px-4 py-4">
                  {hasError && m.lastError && (
                    <div className="bg-[var(--red-dim)] border border-[var(--red)] rounded-[6px] px-3 py-2 mb-4 text-xs text-[var(--red)]">
                      <strong>Last error:</strong> {m.lastError}
                    </div>
                  )}

                  {detailLoading ? (
                    <div className="flex items-center gap-2 text-sm text-[var(--text-muted)] py-4">
                      <Loader2 size={14} className="animate-spin" /> Loading change history…
                    </div>
                  ) : detail && detail.changes.length > 0 ? (
                    <div className="space-y-4">
                      <span className="font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-[0.1em]">
                        Change history ({detail.changes.length})
                      </span>
                      {detail.changes.map(change => {
                        const diff: DiffLine[] = (() => { try { return JSON.parse(change.diff) as DiffLine[] } catch { return [] } })()
                        return (
                          <div key={change.id} className="border border-[var(--border)] rounded-[6px] overflow-hidden">
                            <div className="bg-[var(--surface-2)] px-3 py-2 flex items-center justify-between">
                              <span className="text-xs text-[var(--text-muted)]">{formatRelativeDate(new Date(change.createdAt))}</span>
                              <span className="text-xs text-[var(--text-muted)]">
                                {diff.filter(d => d.type === 'add').length} added, {diff.filter(d => d.type === 'remove').length} removed
                              </span>
                            </div>
                            {change.summary && (
                              <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--surface)]">
                                <p className="text-xs text-[var(--text-body)]">{change.summary}</p>
                              </div>
                            )}
                            <div className="px-3 py-2 max-h-64 overflow-y-auto font-mono text-xs leading-relaxed">
                              {diff.slice(0, 50).map((d, i) => (
                                <div
                                  key={i}
                                  className={cn(
                                    'px-2 py-0.5 rounded-sm mb-0.5',
                                    d.type === 'add' && 'bg-[rgba(34,197,94,0.1)] text-green-700 dark:text-green-400',
                                    d.type === 'remove' && 'bg-[rgba(239,68,68,0.1)] text-red-700 dark:text-red-400 line-through',
                                  )}
                                >
                                  <span className="select-none mr-2 opacity-50">{d.type === 'add' ? '+' : '-'}</span>
                                  {d.text}
                                </div>
                              ))}
                              {diff.length > 50 && (
                                <p className="text-[var(--text-muted)] py-2">…and {diff.length - 50} more changes</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--text-muted)] py-4">No changes detected yet. The page will be checked on schedule.</p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
