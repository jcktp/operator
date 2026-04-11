'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface EntityPreview {
  type: 'entity'
  name: string
  entityType: string
  docCount: number
  context?: string
}

interface DocumentPreview {
  type: 'document'
  title: string
  fileType: string
  createdAt: string
  summary?: string
  entityCount: number
  eventCount: number
  id: string
}

interface TimelinePreview {
  type: 'timeline'
  dateText: string
  event: string
  reportId: string
  id: string
}

type Preview = EntityPreview | DocumentPreview | TimelinePreview

interface Props {
  refType: 'entity' | 'document' | 'timeline'
  refId: string
  label: string
  projectId: string
}

export default function PreviewCard({ refType, refId, label, projectId }: Props) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    setLoading(true)
    let cancelled = false

    const load = async () => {
      try {
        if (refType === 'entity') {
          const r = await fetch(`/api/entities/profile?name=${encodeURIComponent(label)}&projectId=${projectId}`)
          if (!r.ok) throw new Error()
          const d = await r.json() as { type: string; docCount: number; context?: string }
          if (!cancelled) setPreview({ type: 'entity', name: label, entityType: d.type ?? '', docCount: d.docCount ?? 0, context: d.context })
        } else if (refType === 'document') {
          const r = await fetch(`/api/reports/${refId}`)
          if (!r.ok) throw new Error()
          const d = await r.json() as { report: { title: string; fileType: string; createdAt: string; summary?: string } }
          const rpt = d.report
          // Get entity + event counts
          const [ec, ev] = await Promise.all([
            fetch(`/api/entities?reportId=${refId}`).then(r => r.json()).then((d: { entities?: unknown[] }) => d.entities?.length ?? 0).catch(() => 0),
            fetch(`/api/timeline?reportIds=${refId}`).then(r => r.json()).then((d: { events?: unknown[] }) => d.events?.length ?? 0).catch(() => 0),
          ])
          if (!cancelled) setPreview({ type: 'document', title: rpt.title, fileType: rpt.fileType, createdAt: rpt.createdAt, summary: rpt.summary, entityCount: ec, eventCount: ev, id: refId })
        } else {
          const r = await fetch(`/api/timeline?reportIds=all&eventId=${refId}`)
          if (!r.ok) throw new Error()
          const d = await r.json() as { events?: Array<{ dateText: string; event: string; reportId: string }> }
          const ev = d.events?.[0]
          if (ev && !cancelled) setPreview({ type: 'timeline', dateText: ev.dateText, event: ev.event, reportId: ev.reportId, id: refId })
        }
      } catch {
        // show label only on error
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [refType, refId, label, projectId])

  const handleOpen = () => {
    if (refType === 'entity') router.push(`/entities?q=${encodeURIComponent(label)}`)
    else if (refType === 'document') router.push(`/reports/${refId}`)
    else router.push(`/timeline?highlight=${refId}`)
  }

  return (
    <div className="w-[260px] bg-[var(--surface)] border border-[var(--border)] rounded-[10px] shadow-lg p-3 text-xs pointer-events-auto">
      {loading ? (
        <div className="flex items-center gap-2 text-[var(--text-muted)]">
          <Loader2 size={12} className="animate-spin" />
          Loading…
        </div>
      ) : preview ? (
        <>
          {preview.type === 'entity' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-[var(--text-bright)] truncate">{preview.name}</p>
                <span className="text-[10px] text-[var(--text-muted)] shrink-0 capitalize">{preview.entityType}</span>
              </div>
              <div className="h-px bg-[var(--surface-2)]" />
              <p className="text-[var(--text-muted)]">Appears in {preview.docCount} document{preview.docCount !== 1 ? 's' : ''}</p>
              {preview.context && <p className="text-[var(--text-body)] line-clamp-2">{preview.context}</p>}
            </div>
          )}
          {preview.type === 'document' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-[var(--text-bright)] truncate">{preview.title}</p>
                <span className="text-[10px] text-[var(--text-muted)] shrink-0 uppercase">{preview.fileType}</span>
              </div>
              <div className="h-px bg-[var(--surface-2)]" />
              <p className="text-[var(--text-muted)]">{preview.entityCount} entities · {preview.eventCount} events</p>
              {preview.summary && <p className="text-[var(--text-body)] line-clamp-2">{preview.summary}</p>}
            </div>
          )}
          {preview.type === 'timeline' && (
            <div className="space-y-1.5">
              <p className="font-semibold text-[var(--text-bright)]">{preview.dateText}</p>
              <div className="h-px bg-[var(--surface-2)]" />
              <p className="text-[var(--text-body)] line-clamp-3">{preview.event}</p>
            </div>
          )}
          <button
            type="button"
            onClick={handleOpen}
            className="mt-2 flex items-center gap-1 text-[var(--blue)] hover:opacity-80 font-medium transition-colors"
          >
            Open <ExternalLink size={10} />
          </button>
        </>
      ) : (
        <p className="text-[var(--text-muted)]">{label}</p>
      )}
    </div>
  )
}
