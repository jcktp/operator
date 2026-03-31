'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, CheckCircle, AlertCircle, X, FileText } from 'lucide-react'
import Link from 'next/link'

interface JobItem {
  id: string
  title: string
  area: string
  status: string
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

type DismissedSet = Set<string>

const DISMISSED_KEY = 'operator:dismissed-jobs'

function loadDismissed(): DismissedSet {
  try { return new Set(JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '[]') as string[]) }
  catch { return new Set() }
}

function saveDismissed(s: DismissedSet) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify([...s])) } catch {}
}

export default function UploadNotification() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [dismissed, setDismissed] = useState<DismissedSet>(new Set())
  const [expanded, setExpanded] = useState(false)
  const [cancelling, setCancelling] = useState<Set<string>>(new Set())

  const hasActive = jobs.some(j => j.status === 'queued' || j.status === 'processing')
  const visibleJobs = jobs.filter(j => !dismissed.has(j.id))

  // Load persisted dismissed IDs after hydration (localStorage not available on server)
  useEffect(() => {
    setDismissed(loadDismissed())
  }, [])

  const poll = useCallback(async () => {
    try {
      const res = await fetch('/api/upload-jobs', { headers: { 'Accept': 'application/json' } })
      if (!res.ok) return
      const data = await res.json() as { jobs: Job[] }
      setJobs(data.jobs ?? [])
    } catch {}
  }, [])

  useEffect(() => {
    poll()
    const interval = setInterval(poll, hasActive ? 2500 : 15000)
    return () => clearInterval(interval)
  }, [poll, hasActive])

  const dismiss = (jobId: string) => {
    setDismissed(prev => {
      const next = new Set([...prev, jobId])
      saveDismissed(next)
      return next
    })
    setExpanded(false)
  }

  const dismissAll = () => {
    setDismissed(prev => {
      const next = new Set([...prev, ...jobs.map(j => j.id)])
      saveDismissed(next)
      return next
    })
    setExpanded(false)
  }

  const cancel = async (jobId: string) => {
    setCancelling(prev => new Set([...prev, jobId]))
    await fetch(`/api/upload-jobs/${jobId}/cancel`, { method: 'POST' }).catch(() => {})
    setCancelling(prev => { const s = new Set(prev); s.delete(jobId); return s })
    poll()
  }

  if (visibleJobs.length === 0) return null

  // Summary counts
  const activeJobs = visibleJobs.filter(j => j.status === 'queued' || j.status === 'processing')
  const doneJobs = visibleJobs.filter(j => j.status === 'done')
  const errorJobs = visibleJobs.filter(j => j.status === 'error')

  const totalInProgress = activeJobs.reduce((sum, j) => sum + (j.total - j.processed), 0)
  const totalProcessed = activeJobs.reduce((sum, j) => sum + j.processed, 0)
  const totalItems = activeJobs.reduce((sum, j) => sum + j.total, 0)

  // Compact pill in nav — one line
  const statusText = activeJobs.length > 0
    ? totalItems > 1
      ? `Analysing ${totalProcessed + 1} of ${totalItems}…`
      : 'Analysing…'
    : doneJobs.length > 0
      ? `${doneJobs.reduce((s, j) => s + j.processed, 0)} document${doneJobs.reduce((s, j) => s + j.processed, 0) !== 1 ? 's' : ''} ready`
      : `${errorJobs.length} failed`

  return (
    <div className="relative flex items-center gap-1">
      <button
        onClick={() => setExpanded(v => !v)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          activeJobs.length > 0
            ? 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900'
            : errorJobs.length > 0 && doneJobs.length === 0
              ? 'bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900'
              : 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900'
        }`}
      >
        {activeJobs.length > 0
          ? <Loader2 size={11} className="animate-spin shrink-0" />
          : errorJobs.length > 0 && doneJobs.length === 0
            ? <AlertCircle size={11} className="shrink-0" />
            : <CheckCircle size={11} className="shrink-0" />
        }
        {statusText}
      </button>

      {/* Clear-all button — only when no active jobs */}
      {activeJobs.length === 0 && (
        <button
          onClick={dismissAll}
          title="Clear notification"
          className="p-1 text-gray-300 hover:text-gray-500 dark:text-zinc-600 dark:hover:text-zinc-400 transition-colors"
        >
          <X size={11} />
        </button>
      )}

      {expanded && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl shadow-xl overflow-hidden">
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
                          ? `${job.processed} document${job.processed !== 1 ? 's' : ''} complete`
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
                      <span className={`text-[11px] truncate flex-1 ${
                        item.status === 'done' ? 'text-gray-600 dark:text-zinc-300' :
                        item.status === 'error' ? 'text-red-600 dark:text-red-400' :
                        item.status === 'processing' ? 'text-blue-600 dark:text-blue-400 font-medium' :
                        'text-gray-400 dark:text-zinc-500'
                      }`}>{item.title}</span>
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
