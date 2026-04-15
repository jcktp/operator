'use client'

import { useState } from 'react'
import { Play, Pause, ChevronDown, ChevronUp, Trash2, FileText } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'
import { AreaBadge } from '@/components/Badge'
import { useRouter } from 'next/navigation'

interface Segment {
  speaker: string
  start: number
  end: number
  duration: number
}

interface AudioReport {
  id: string
  title: string
  area: string
  filePath: string
  diarization: { segments: Segment[]; num_speakers: number; duration: number }
  speakerNames: Record<string, string>
  createdAt: Date
}

const SPEAKER_COLORS = [
  'var(--blue)', 'var(--green)', 'var(--amber)', 'var(--red)',
  '#a855f7', '#06b6d4', '#ec4899', '#f97316',
]

function speakerColor(speaker: string, segments: Segment[]): string {
  const unique = [...new Set(segments.map(s => s.speaker))]
  const idx = unique.indexOf(speaker)
  return SPEAKER_COLORS[idx % SPEAKER_COLORS.length]
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function speakerStats(segments: Segment[], total: number) {
  const map = new Map<string, number>()
  for (const seg of segments) map.set(seg.speaker, (map.get(seg.speaker) ?? 0) + seg.duration)
  return [...map.entries()]
    .map(([speaker, secs]) => ({ speaker, secs, pct: Math.round((secs / total) * 100) }))
    .sort((a, b) => b.secs - a.secs)
}

function AudioCard({ report, onDelete }: { report: AudioReport; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)

  const { diarization, speakerNames } = report
  const seg = diarization.segments
  const stats = speakerStats(seg, diarization.duration)

  const audioSrc = `/api/files/download?path=${encodeURIComponent(report.filePath)}`

  const transcript = seg
    .map(s => `[${formatTime(s.start)}–${formatTime(s.end)}] ${speakerNames[s.speaker] || s.speaker}`)
    .join('\n')

  async function handleDelete() {
    if (!window.confirm(`Delete "${report.title}"? This cannot be undone.`)) return
    setDeleting(true)
    await fetch(`/api/reports/${report.id}`, { method: 'DELETE' })
    onDelete(report.id)
  }

  return (
    <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[10px] hover:border-[var(--border-mid)] transition-all">
      {/* Header */}
      <div className="px-4 py-3 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <AreaBadge area={report.area} />
            <span className="text-sm font-semibold text-[var(--text-bright)] truncate">{report.title}</span>
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            {diarization.num_speakers} speakers · {formatTime(diarization.duration)} · {formatRelativeDate(report.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--red)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-40"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:bg-[var(--surface-2)] transition-colors"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
        </div>
      </div>

      {/* Speaker timeline bar */}
      {seg.length > 0 && (
        <div className="px-4 pb-3">
          <div className="h-4 w-full rounded-[3px] overflow-hidden flex">
            {seg.map((s, i) => (
              <div
                key={i}
                title={`${speakerNames[s.speaker] || s.speaker}: ${formatTime(s.start)}–${formatTime(s.end)}`}
                style={{
                  width: `${(s.duration / (diarization.duration || 1)) * 100}%`,
                  backgroundColor: speakerColor(s.speaker, seg),
                  opacity: 0.8,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-[var(--border)]">
          {/* Native audio element */}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls src={audioSrc} className="w-full mt-3" style={{ height: 36 }} />

          {/* Speaker stats */}
          <div className="space-y-1.5">
            {stats.map(({ speaker, secs, pct }) => {
              const color = speakerColor(speaker, seg)
              const name = speakerNames[speaker] || speaker
              return (
                <div key={speaker} className="space-y-0.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium" style={{ color }}>{name}</span>
                    <span className="text-[var(--text-muted)]">{formatTime(secs)} · {pct}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-[var(--surface-3)] overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color, opacity: 0.85 }} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Transcript toggle */}
          <div>
            <button
              onClick={() => setShowTranscript(v => !v)}
              className="flex items-center gap-1.5 text-xs text-[var(--text-subtle)] hover:text-[var(--text-body)] transition-colors"
            >
              <FileText size={12} />
              {showTranscript ? 'Hide transcript' : 'View transcript'}
            </button>
            {showTranscript && (
              <pre className="mt-2 max-h-48 overflow-y-auto rounded-[5px] bg-[var(--surface-2)] border border-[var(--border)] p-3 text-[11px] leading-relaxed text-[var(--text-body)] whitespace-pre-wrap font-mono">
                {transcript}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AudioGallery({ reports: initial }: { reports: AudioReport[] }) {
  const router = useRouter()
  const [reports, setReports] = useState(initial)

  function handleDelete(id: string) {
    setReports(prev => prev.filter(r => r.id !== id))
    router.refresh()
  }

  if (reports.length === 0) {
    return (
      <p className="text-sm text-[var(--text-muted)] text-center py-12">No audio recordings in this area.</p>
    )
  }

  return (
    <div className="space-y-3">
      {reports.map(r => (
        <AudioCard key={r.id} report={r} onDelete={handleDelete} />
      ))}
    </div>
  )
}
