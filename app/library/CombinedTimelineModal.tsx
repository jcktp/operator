'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Clock, Loader2 } from 'lucide-react'
import Link from 'next/link'

interface TimelineEvent {
  id: string
  reportId: string
  reportTitle: string
  dateText: string
  dateSortKey: string | null
  event: string
}

export default function CombinedTimelineModal({
  reportIds,
  onClose,
}: {
  reportIds: string[]
  onClose: () => void
}) {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/timeline?reportIds=${reportIds.join(',')}`)
      if (!res.ok) throw new Error('Failed to fetch timeline')
      const data = await res.json() as { events: TimelineEvent[] }
      setEvents(data.events)
    } catch (e) {
      setError('Could not load timeline. Please try again.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [reportIds])

  useEffect(() => { void load() }, [load])

  // Group events by document for colour coding
  const reportColors = [
    'bg-violet-100 text-violet-700',
    'bg-sky-100 text-sky-700',
    'bg-emerald-100 text-emerald-700',
    'bg-amber-100 text-amber-700',
    'bg-pink-100 text-pink-700',
  ]
  const reportColorMap = new Map(
    reportIds.map((id, i) => [id, reportColors[i % reportColors.length]])
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Clock size={16} />
            Combined Timeline
            <span className="text-sm font-normal text-gray-400">
              · {reportIds.length} document{reportIds.length !== 1 ? 's' : ''}
            </span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-sm">Building timeline…</span>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-500 text-center py-8">{error}</p>
          )}

          {!loading && !error && events.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">
              No dated events found in the selected documents.
            </p>
          )}

          {!loading && !error && events.length > 0 && (
            <div className="space-y-0">
              {events.map((event, i) => (
                <div key={event.id} className="flex items-start gap-4">
                  {/* Timeline spine */}
                  <div className="flex flex-col items-center shrink-0 pt-1.5">
                    <div className="w-2 h-2 rounded-full bg-gray-300 shrink-0" />
                    {i < events.length - 1 && (
                      <div className="w-px bg-gray-100 flex-1 min-h-[20px] mt-1" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pb-4">
                    <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
                      <span className="text-xs font-semibold text-gray-500">{event.dateText}</span>
                      <Link
                        href={`/reports/${event.reportId}`}
                        className={`text-xs px-1.5 py-0.5 rounded font-medium hover:opacity-80 transition-opacity ${reportColorMap.get(event.reportId) ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {event.reportTitle.length > 40 ? event.reportTitle.slice(0, 40) + '…' : event.reportTitle}
                      </Link>
                    </div>
                    <p className="text-sm text-gray-700">{event.event}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
