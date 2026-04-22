'use client'

import { useState, useRef, useEffect } from 'react'
import { Play, Pause, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'
import { AreaBadge } from '@/components/Badge'
import { useRouter } from 'next/navigation'

interface Segment {
  speaker: string
  start: number
  end: number
  duration: number
  text?: string
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

// ── Synced audio player with karaoke transcript ──────────────────────────────

function SyncedPlayer({ src, segments, speakerNames, duration: totalDuration }: {
  src: string
  segments: Segment[]
  speakerNames: Record<string, string>
  duration: number
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const transcriptRef = useRef<HTMLDivElement | null>(null)
  const activeLineRef = useRef<HTMLDivElement | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const onTime = () => setCurrentTime(audio.currentTime)
    const onMeta = () => setDuration(audio.duration || 0)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => { setPlaying(false); setCurrentTime(0) }
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
    }
  }, [src])

  // Auto-scroll within the transcript container only — never move the page
  useEffect(() => {
    if (playing && activeLineRef.current && transcriptRef.current) {
      const container = transcriptRef.current
      const line = activeLineRef.current
      const lineTop = line.offsetTop - container.offsetTop
      const target = lineTop - container.clientHeight / 2 + line.clientHeight / 2
      container.scrollTo({ top: target, behavior: 'smooth' })
    }
  }, [currentTime, playing])

  const seekTo = (t: number) => {
    if (audioRef.current) { audioRef.current.currentTime = t; audioRef.current.play().catch(() => {}) }
  }
  const togglePlay = () => {
    if (!audioRef.current) return
    if (audioRef.current.paused) audioRef.current.play().catch(() => {})
    else audioRef.current.pause()
  }

  const activeIdx = segments.findIndex(s => currentTime >= s.start && currentTime < s.end)
  const dur = duration || totalDuration || segments[segments.length - 1]?.end || 1
  const hasText = segments.some(s => s.text)

  return (
    <div className="space-y-2">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={src} preload="metadata" />
      <div className="flex items-center gap-3">
        <button onClick={togglePlay}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--ink)] text-[var(--ink-contrast)] hover:opacity-80 transition-opacity shrink-0"
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <input type="range" min={0} max={dur} step={0.1} value={currentTime}
          onChange={e => seekTo(parseFloat(e.target.value))}
          className="flex-1 accent-[var(--blue)] h-1"
        />
        <span className="text-xs text-[var(--text-muted)] tabular-nums shrink-0">
          {formatTime(currentTime)} / {formatTime(dur)}
        </span>
      </div>
      {/* Clickable timeline */}
      {segments.length > 0 && (
        <div className="h-4 w-full rounded-[3px] overflow-hidden flex cursor-pointer relative"
          onClick={e => {
            const r = e.currentTarget.getBoundingClientRect()
            seekTo(((e.clientX - r.left) / r.width) * dur)
          }}
        >
          {segments.map((seg, i) => (
            <div key={i}
              title={`${speakerNames[seg.speaker] || seg.speaker}: ${formatTime(seg.start)}–${formatTime(seg.end)}`}
              style={{ width: `${(seg.duration / (dur || 1)) * 100}%`, backgroundColor: speakerColor(seg.speaker, segments), opacity: 0.8 }}
            />
          ))}
          <div className="absolute top-0 bottom-0 w-0.5 bg-white/70 pointer-events-none"
            style={{ left: `${(currentTime / dur) * 100}%` }} />
        </div>
      )}
      {/* Live transcript */}
      {hasText && (
        <div ref={transcriptRef}
          className="max-h-48 overflow-y-auto rounded-[5px] bg-[var(--surface-2)] border border-[var(--border)] p-2 space-y-0.5 scroll-smooth"
        >
          {segments.map((seg, i) => {
            const isActive = i === activeIdx
            const isPast = currentTime >= seg.end
            const color = speakerColor(seg.speaker, segments)
            const name = speakerNames[seg.speaker] || seg.speaker
            return (
              <div
                key={i}
                ref={isActive ? activeLineRef : undefined}
                onClick={() => seekTo(seg.start)}
                className={`px-2 py-1.5 rounded-[4px] cursor-pointer transition-all ${
                  isActive
                    ? 'bg-[var(--surface-3)] shadow-sm'
                    : 'hover:bg-[var(--surface-3)]'
                }`}
                style={{ opacity: isPast && !isActive ? 0.5 : 1 }}
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[10px] text-[var(--text-muted)] tabular-nums shrink-0 w-10">
                    {formatTime(seg.start)}
                  </span>
                  <span className="text-[11px] font-medium shrink-0" style={{ color }}>{name}</span>
                </div>
                {seg.text && (
                  <p className={`text-xs leading-relaxed mt-0.5 ml-12 ${
                    isActive ? 'text-[var(--text-bright)]' : 'text-[var(--text-body)]'
                  }`}>
                    {seg.text}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Audio card ───────────────────────────────────────────────────────────────

function AudioCard({ report, onDelete }: { report: AudioReport; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const { diarization, speakerNames } = report
  const seg = diarization.segments
  const stats = speakerStats(seg, diarization.duration)

  const audioSrc = `/api/files/download?path=${encodeURIComponent(report.filePath)}`

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

      {/* Speaker timeline bar (collapsed preview) */}
      {!expanded && seg.length > 0 && (
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
          {/* Synced player with karaoke transcript */}
          <div className="pt-3">
            <SyncedPlayer
              src={audioSrc}
              segments={seg}
              speakerNames={speakerNames}
              duration={diarization.duration}
            />
          </div>

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
