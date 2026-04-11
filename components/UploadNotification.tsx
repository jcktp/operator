'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, CheckCircle, AlertCircle, X, FileText, Inbox } from 'lucide-react'
import Link from 'next/link'

interface JobItem {
  id: string
  title: string
  area: string
  status: string
  step: string | null
  reportId: string | null
  error: string | null
}

interface Job {
  id: string
  status: string
  total: number
  processed: number
  createdAt: string
  items: JobItem[]
}

interface ReceivedSubmission {
  id: string
  title: string
  area: string
  submitterName: string | null
  createdAt: string
}

type DismissedSet = Set<string>

const DISMISSED_KEY = 'operator:dismissed-jobs'
const DISMISSED_SUBS_KEY = 'operator:dismissed-submissions'
const RECENT_HOURS = 24

function loadDismissed(): DismissedSet {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]') as string[]) }
  catch { return new Set() }
}

function saveDismissed(s: DismissedSet) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...s])) } catch {}
}

function loadDismissedSubs(): DismissedSet {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_SUBS_KEY) ?? '[]') as string[]) }
  catch { return new Set() }
}

function saveDismissedSubs(s: DismissedSet) {
  try { localStorage.setItem(DISMISSED_SUBS_KEY, JSON.stringify([...s])) } catch {}
}

export default function UploadNotification() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [dismissed, setDismissed] = useState<DismissedSet>(new Set())
  const [dismissedSubs, setDismissedSubs] = useState<DismissedSet>(new Set())
  const [receivedSubs, setReceivedSubs] = useState<ReceivedSubmission[]>([])
  const [expanded, setExpanded] = useState(false)
  const [cancelling, setCancelling] = useState<Set<string>>(new Set())

  const hasActive = jobs.some(j => j.status === 'queued' || j.status === 'processing')
  // Strip deleted items from each job before rendering
  const visibleJobs = jobs
    .filter(j => !dismissed.has(j.id))
    .map(j => ({ ...j, items: j.items.filter(i => i.status !== 'deleted') }))
    .filter(j => {
      if (j.status === 'queued' || j.status === 'processing') return true
      return j.items.some(i => i.status === 'done' || i.status === 'error')
    })

  const visibleSubs = receivedSubs.filter(s => !dismissedSubs.has(s.id))

  // Load persisted dismissed IDs after hydration (localStorage not available on server)
  useEffect(() => {
    setDismissed(loadDismissed())
    setDismissedSubs(loadDismissedSubs())
  }, [])

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/upload-jobs', { headers: { 'Accept': 'application/json' } })
      if (!res.ok) return
      const data = await res.json() as { jobs: Job[] }
      setJobs(data.jobs ?? [])
    } catch {}
  }, [])

  const pollSubs = useCallback(async () => {
    try {
      const res = await fetch('/api/report-requests', { headers: { 'Accept': 'application/json' } })
      if (!res.ok) return
      const data = await res.json() as { requests: Array<{ id: string; title: string; area: string; status: string; createdAt: string; directReport: { name: string } | null }> }
      const cutoff = Date.now() - RECENT_HOURS * 60 * 60 * 1000
      const recent = (data.requests ?? [])
        .filter(r => r.status === 'submitted' && new Date(r.createdAt).getTime() > cutoff)
        .map(r => ({
          id: r.id,
          title: r.title,
          area: r.area,
          submitterName: r.directReport?.name ?? null,
          createdAt: r.createdAt,
        }))
      setReceivedSubs(recent)
    } catch {}
  }, [])

  useEffect(() => {
    poll()
    const interval = setInterval(poll, hasActive ? 2500 : 15000)
    return () => clearInterval(interval)
  }, [poll, hasActive])

  useEffect(() => {
    pollSubs()
    const interval = setInterval(pollSubs, 30000)
    return () => clearInterval(interval)
  }, [pollSubs])

  const dismiss = (jobId: string) => {
    setDismissed(prev => {
      const next = new Set([...prev, jobId])
      saveDismissed(next)
      return next
    })
  }

  const dismissSub = (id: string) => {
    setDismissedSubs(prev => {
      const next = new Set([...prev, id])
      saveDismissedSubs(next)
      return next
    })
  }

  const dismissAll = () => {
    setDismissed(prev => {
      const next = new Set([...prev, ...jobs.map(j => j.id)])
      saveDismissed(next)
      return next
    })
    setDismissedSubs(prev => {
      const next = new Set([...prev, ...receivedSubs.map(s => s.id)])
      saveDismissedSubs(next)
      return next
    })
    setExpanded(false)
  }

  // Auto-dismiss completed jobs 5 seconds after they finish (not submissions — those persist until dismissed)
  useEffect(() => {
    if (visibleJobs.length === 0) return
    const allDone = visibleJobs.every(j => j.status === 'done' || j.status === 'error')
    if (!allDone) return
    const timer = setTimeout(() => {
      setDismissed(prev => {
        const next = new Set([...prev, ...jobs.map(j => j.id)])
        saveDismissed(next)
        return next
      })
    }, 5000)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleJobs.map(j => j.status).join(',')])

  const cancel = async (jobId: string) => {
    setCancelling(prev => new Set([...prev, jobId]))
    await fetch(`/api/upload-jobs/${jobId}/cancel`, { method: 'POST' }).catch(() => {})
    setCancelling(prev => { const s = new Set(prev); s.delete(jobId); return s })
    poll()
  }

  if (visibleJobs.length === 0 && visibleSubs.length === 0) return null

  // Summary counts
  const activeJobs = visibleJobs.filter(j => j.status === 'queued' || j.status === 'processing')
  const doneJobs = visibleJobs.filter(j => j.status === 'done')
  const errorJobs = visibleJobs.filter(j => j.status === 'error')

  const totalProcessed = activeJobs.reduce((sum, j) => sum + j.processed, 0)
  const totalItems = activeJobs.reduce((sum, j) => sum + j.total, 0)

  // Compact pill in nav — count only, no step details (those live in the dropdown)
  const statusText = activeJobs.length > 0
    ? totalItems > 1
      ? `Analysing ${totalProcessed + 1} of ${totalItems}…`
      : 'Analysing…'
    : doneJobs.length > 0
      ? (() => { const n = doneJobs.reduce((s, j) => s + j.items.filter(i => i.status === 'done').length, 0); return `${n} document${n !== 1 ? 's' : ''} ready` })()
    : errorJobs.length > 0
      ? `${errorJobs.length} failed`
      : `${visibleSubs.length} received`

  return (
    <div className="relative flex items-center gap-1">
      <button
        onClick={() => setExpanded(v => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-[4px] text-xs font-medium transition-colors ${
          activeJobs.length > 0
            ? 'bg-blue-500/20 text-blue-300 hover:bg-blue-500/30'
            : errorJobs.length > 0 && doneJobs.length === 0
              ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
              : 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
        }`}
      >
        {activeJobs.length > 0
          ? <Loader2 size={11} className="animate-spin shrink-0" />
          : errorJobs.length > 0 && doneJobs.length === 0
            ? <AlertCircle size={11} className="shrink-0" />
            : visibleJobs.length === 0 && visibleSubs.length > 0
              ? <Inbox size={11} className="shrink-0" />
              : <CheckCircle size={11} className="shrink-0" />
        }
        {statusText}
      </button>

      {/* Clear-all button — only when no active jobs */}
      {activeJobs.length === 0 && (
        <button
          onClick={dismissAll}
          title="Clear notifications"
          className="p-1 text-white/30 hover:text-white/60 transition-colors"
        >
          <X size={11} />
        </button>
      )}

      {expanded && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-[10px] shadow-xl overflow-hidden">
          {/* Received remote submissions */}
          {visibleSubs.map(sub => (
            <div key={sub.id} className="p-3 border-b border-gray-100 dark:border-zinc-800 last:border-b-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Inbox size={12} className="text-green-500 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-900 dark:text-zinc-50 truncate">{sub.title}</p>
                    <p className="text-[11px] text-gray-400 dark:text-zinc-500">
                      {sub.submitterName ? `From ${sub.submitterName}` : 'Remote submission'}{sub.area ? ` · ${sub.area}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href="/library"
                    className="text-[10px] text-indigo-500 hover:underline"
                    onClick={() => { dismissSub(sub.id); setExpanded(false) }}
                  >
                    View
                  </Link>
                  <button onClick={() => dismissSub(sub.id)} className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300">
                    <X size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {visibleJobs.map(job => {
            const inProgress = job.status === 'queued' || job.status === 'processing'
            const currentItem = job.items.find(i => i.status === 'processing')
            const doneItems = job.items.filter(i => i.status === 'done')
            const errorItems = job.items.filter(i => i.status === 'error')

            return (
              <div key={job.id} className="p-3 border-b border-gray-100 dark:border-zinc-800 last:border-b-0">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    {inProgress
                      ? <Loader2 size={12} className="animate-spin text-blue-500 shrink-0" />
                      : job.status === 'done'
                        ? <CheckCircle size={12} className="text-green-500 shrink-0" />
                        : <AlertCircle size={12} className="text-red-500 shrink-0" />
                    }
                    <span className="text-xs font-medium text-gray-900 dark:text-zinc-50">
                      {inProgress
                        ? `Analysing ${job.processed + (currentItem ? 1 : 0)} of ${job.total}…`
                        : job.status === 'done'
                          ? (() => { const n = doneItems.length; return `${n} document${n !== 1 ? 's' : ''} complete` })()

                          : `${errorItems.length} failed`
                      }
                    </span>
                  </div>
                  {inProgress ? (
                    <button
                      onClick={() => cancel(job.id)}
                      disabled={cancelling.has(job.id)}
                      title="Cancel analysis"
                      className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-400 disabled:opacity-40 shrink-0 transition-colors"
                    >
                      {cancelling.has(job.id) ? <Loader2 size={11} className="animate-spin" /> : 'Cancel'}
                    </button>
                  ) : (
                    <button
                      onClick={() => dismiss(job.id)}
                      className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 shrink-0"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {/* Progress bar */}
                {inProgress && job.total > 1 && (
                  <div className="h-1 bg-gray-100 dark:bg-zinc-800 rounded-full mb-2 overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all"
                      style={{ width: `${Math.round((job.processed / job.total) * 100)}%` }}
                    />
                  </div>
                )}

                {/* Item list */}
                <div className="space-y-1">
                  {job.items.map(item => (
                    <div key={item.id} className="flex items-center gap-1.5">
                      {item.status === 'done'
                        ? <CheckCircle size={10} className="text-green-500 shrink-0" />
                        : item.status === 'error'
                          ? <AlertCircle size={10} className="text-red-500 shrink-0" />
                          : item.status === 'processing'
                            ? <Loader2 size={10} className="animate-spin text-blue-500 shrink-0" />
                            : <FileText size={10} className="text-gray-300 dark:text-zinc-600 shrink-0" />
                      }
                      <span className={`text-[11px] flex-1 min-w-0 ${
                        item.status === 'done' ? 'text-gray-600 dark:text-zinc-300' :
                        item.status === 'error' ? 'text-red-600 dark:text-red-400' :
                        item.status === 'processing' ? 'text-blue-600 dark:text-blue-400 font-medium' :
                        'text-gray-400 dark:text-zinc-500'
                      }`}>
                        <span className="truncate block">{item.title}</span>
                        {item.status === 'processing' && item.step && (
                          <span className="text-[10px] text-blue-400 dark:text-blue-500 font-normal">{item.step}</span>
                        )}
                      </span>
                      {item.status === 'done' && item.reportId && (
                        <Link
                          href={`/reports/${item.reportId}`}
                          className="text-[10px] text-indigo-500 hover:underline shrink-0"
                          onClick={() => setExpanded(false)}
                        >
                          View
                        </Link>
                      )}
                    </div>
                  ))}
                </div>

                {/* Errors */}
                {errorItems.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {errorItems.map(item => (
                      <p key={item.id} className="text-[11px] text-red-500 dark:text-red-400">
                        {item.title}: {item.error ?? 'Unknown error'}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
