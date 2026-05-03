'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { X, Loader2, Plus, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReportOption {
  id: string
  title: string
  area: string
}

interface Props {
  open: boolean
  onClose: () => void
  /** All reports available for attachment in the active project. */
  allReports: ReportOption[]
}

const STATUS_OPTIONS = [
  { id: 'draft',   label: 'Draft' },
  { id: 'writing', label: 'Writing' },
  { id: 'filed',   label: 'Filed' },
] as const

type Status = typeof STATUS_OPTIONS[number]['id']

export default function NewStoryModal({ open, onClose, allReports }: Props) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState<Status>('draft')
  const [shared, setShared] = useState(false)
  const [reportIds, setReportIds] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Reset state when modal opens fresh
  useEffect(() => {
    if (!open) return
    setTitle('')
    setDescription('')
    setStatus('draft')
    setShared(false)
    setReportIds([])
    setSearch('')
  }, [open])

  // Esc to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const filteredReports = (() => {
    const q = search.trim().toLowerCase()
    if (!q) return allReports
    return allReports.filter(r =>
      r.title.toLowerCase().includes(q) || r.area.toLowerCase().includes(q)
    )
  })()

  const toggleReport = (id: string) => {
    setReportIds(prev => prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id])
  }

  const submit = async () => {
    if (!title.trim() || submitting) return
    setSubmitting(true)
    try {
      // Story = Project. One POST creates everything. All fields sent in one shot.
      const createRes = await fetch('/api/stories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:       title.trim(),
          description: description.trim() || undefined,
          status:      status !== 'draft' ? status : undefined,
          reportIds:   reportIds.length > 0 ? reportIds : undefined,
          shared:      shared || undefined,
        }),
      })
      if (!createRes.ok) throw new Error('Create failed')
      const { project } = await createRes.json() as { project: { id: string } }

      window.dispatchEvent(new Event('project:changed'))
      router.push(`/stories/${project.id}`)
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--border)] shrink-0">
          <h2 className="text-base font-semibold text-[var(--text-bright)]">New story</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-body)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Title */}
          <div className="space-y-1">
            <label className="text-[11px] font-mono uppercase tracking-[0.08em] text-[var(--text-muted)]">Title</label>
            <input
              autoFocus
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit() }}
              placeholder="What's this story about?"
              className="w-full h-9 px-3 text-sm border border-[var(--border-mid)] bg-[var(--surface)] rounded-[6px] text-[var(--text-body)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--blue)] focus:border-[var(--blue)] transition-colors"
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[11px] font-mono uppercase tracking-[0.08em] text-[var(--text-muted)]">Working hypothesis (optional)</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="A one-line summary of what you're investigating."
              rows={2}
              className="w-full px-3 py-2 text-sm border border-[var(--border-mid)] bg-[var(--surface)] rounded-[6px] text-[var(--text-body)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--blue)] focus:border-[var(--blue)] transition-colors resize-none"
            />
          </div>

          {/* Status + sharing */}
          <div className="flex items-end gap-3">
            <div className="space-y-1 flex-1">
              <label className="text-[11px] font-mono uppercase tracking-[0.08em] text-[var(--text-muted)]">Status</label>
              <div className="flex gap-1">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setStatus(opt.id)}
                    className={cn(
                      'flex-1 h-8 text-xs font-medium rounded-[6px] transition-colors',
                      status === opt.id
                        ? 'bg-[var(--ink)] text-[var(--ink-contrast)]'
                        : 'bg-[var(--surface-2)] text-[var(--text-body)] hover:bg-[var(--surface-3)]'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-mono uppercase tracking-[0.08em] text-[var(--text-muted)]">Sharing</label>
              <button
                type="button"
                onClick={() => setShared(s => !s)}
                title={shared ? 'Story will sync to peers when project is shared' : 'Story stays local to your instance'}
                className={cn(
                  'h-8 px-3 text-xs font-medium rounded-[6px] transition-colors flex items-center gap-1.5',
                  shared
                    ? 'bg-[var(--blue-dim)] text-[var(--blue)]'
                    : 'bg-[var(--surface-2)] text-[var(--text-muted)] hover:text-[var(--text-body)]'
                )}
              >
                {shared ? 'Shared' : 'Private'}
              </button>
            </div>
          </div>

          {/* Documents */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-mono uppercase tracking-[0.08em] text-[var(--text-muted)]">
                Attach documents {reportIds.length > 0 && <span className="text-[var(--text-body)]">({reportIds.length})</span>}
              </label>
              <a
                href="/upload"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[var(--blue)] hover:opacity-80 transition-opacity inline-flex items-center gap-1"
              >
                <Plus size={10} /> Upload more
              </a>
            </div>
            {allReports.length === 0 ? (
              <p className="text-[11px] text-[var(--text-muted)] italic px-1">
                No documents in this project yet. You can attach them later from the story workspace.
              </p>
            ) : (
              <>
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search documents…"
                    className="w-full h-7 pl-7 pr-3 text-[11.5px] border border-[var(--border)] bg-[var(--surface-2)] rounded-[6px] text-[var(--text-body)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--blue)] focus:border-[var(--blue)]"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto border border-[var(--border)] rounded-[6px]">
                  {filteredReports.length === 0 ? (
                    <p className="text-[11px] text-[var(--text-muted)] italic px-3 py-2.5">No matches.</p>
                  ) : filteredReports.map(r => (
                    <label
                      key={r.id}
                      className="flex items-start gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--surface-2)] border-b border-[var(--border)] last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={reportIds.includes(r.id)}
                        onChange={() => toggleReport(r.id)}
                        className="mt-0.5 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-[var(--text-body)] truncate">{r.title}</p>
                        <p className="text-[10px] text-[var(--text-muted)] mt-0.5 font-mono">{r.area}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[var(--border)] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium px-4 py-2 rounded-full text-[var(--text-body)] hover:bg-[var(--surface-2)] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!title.trim() || submitting}
            className="text-xs font-medium px-4 py-2 rounded-full bg-[var(--ink)] text-[var(--ink-contrast)] hover:opacity-90 transition-colors disabled:opacity-40 inline-flex items-center gap-1.5"
          >
            {submitting && <Loader2 size={12} className="animate-spin" />}
            Create story
          </button>
        </div>
      </div>
    </div>
  )
}
