'use client'
import { useRef, useState, useEffect, useCallback } from 'react'
import { Button, Spinner, EmptyState, Input } from '@/components/ui'
import SelectField from '@/components/SelectField'
import { Mic, X, Play, Pause, Check, ChevronDown, ChevronUp, Plus, FileText } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Segment {
  speaker: string
  start: number
  end: number
  duration: number
  text?: string
}

interface DiarizeResult {
  segments: Segment[]
  num_speakers: number
  duration: number
  language?: string
}

interface Project {
  id: string
  name: string
  areas: string[]
}

interface Job {
  id: string
  file: File
  audioUrl: string
  status: 'pending' | 'processing' | 'done' | 'error'
  error?: string
  result?: DiarizeResult
  speakerNames: Record<string, string>  // "Speaker 1" → real name
  savedReportId?: string
  expanded: boolean
}

interface Props {
  projects: Project[]
}

// ── Whisper model options ─────────────────────────────────────────────────────

const WHISPER_MODELS = [
  {
    value: 'tiny',
    label: 'Tiny — fastest, ~75 MB',
    desc: 'Good enough for clear, single-language recordings with minimal background noise. May miss words in fast speech, accents, or overlapping speakers. Best for quick previews.',
  },
  {
    value: 'base',
    label: 'Base — fast, ~150 MB',
    desc: 'Handles most clear recordings well. Reliable for interviews, meetings, and phone calls in common languages. Struggles with heavy accents, technical jargon, or noisy environments.',
  },
  {
    value: 'small',
    label: 'Small — balanced, ~500 MB',
    desc: 'Strong accuracy across languages and accents. Handles background noise, crosstalk, and domain-specific vocabulary better. Noticeably slower than Base — expect 2-3x the processing time.',
  },
  {
    value: 'medium',
    label: 'Medium — accurate, ~1.5 GB',
    desc: 'High accuracy even with difficult audio: heavy accents, low-quality recordings, technical terms. Supports 90+ languages well. Slow on CPU — a 5-minute file may take several minutes.',
  },
  {
    value: 'large-v3',
    label: 'Large — best accuracy, ~3 GB',
    desc: 'Maximum accuracy for any language or condition. Use for critical transcriptions where every word matters: legal recordings, evidence, foreign language audio. Very slow on CPU and memory-heavy.',
  },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function formatDur(s: number): string {
  if (s >= 60) {
    const m = Math.floor(s / 60); const sec = Math.round(s % 60)
    return sec > 0 ? `${m}m ${sec}s` : `${m}m`
  }
  return `${Math.round(s)}s`
}

function speakerStats(segments: Segment[], total: number): Array<{ speaker: string; secs: number; pct: number }> {
  const map = new Map<string, number>()
  for (const seg of segments) map.set(seg.speaker, (map.get(seg.speaker) ?? 0) + seg.duration)
  return [...map.entries()]
    .map(([speaker, secs]) => ({ speaker, secs, pct: Math.round((secs / total) * 100) }))
    .sort((a, b) => b.secs - a.secs)
}

function buildTranscript(segments: Segment[], speakerNames: Record<string, string>): string {
  return segments
    .map(seg => {
      const name = speakerNames[seg.speaker] || seg.speaker
      const time = `[${formatTime(seg.start)}–${formatTime(seg.end)}]`
      return seg.text ? `${time} ${name}: ${seg.text}` : `${time} ${name}`
    })
    .join('\n')
}

// ── Inline audio player with live transcript ─────────────────────────────────

function AudioPlayer({ src, segments, speakerNames }: {
  src: string
  segments: Segment[]
  speakerNames: Record<string, string>
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
  const activeSeg = activeIdx >= 0 ? segments[activeIdx] : undefined
  const activeColor = activeSeg ? speakerColor(activeSeg.speaker, segments) : undefined
  const activeName = activeSeg ? (speakerNames[activeSeg.speaker] || activeSeg.speaker) : null
  const dur = duration || segments[segments.length - 1]?.end || 1
  const hasText = segments.some(s => s.text)

  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] p-3 space-y-2">
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
      {activeName && !hasText && (
        <p className="text-xs text-[var(--text-muted)]">
          Now: <span className="font-medium" style={{ color: activeColor }}>{activeName}</span>
        </p>
      )}
      {/* Clickable timeline */}
      {segments.length > 0 && (
        <div className="h-5 w-full rounded-[3px] overflow-hidden flex cursor-pointer relative"
          onClick={e => {
            const r = e.currentTarget.getBoundingClientRect()
            seekTo(((e.clientX - r.left) / r.width) * dur)
          }}
        >
          {segments.map((seg, i) => (
            <div key={i}
              title={`${speakerNames[seg.speaker] || seg.speaker}: ${formatTime(seg.start)}–${formatTime(seg.end)}`}
              style={{ width: `${(seg.duration / dur) * 100}%`, backgroundColor: speakerColor(seg.speaker, segments), opacity: 0.8 }}
            />
          ))}
          <div className="absolute top-0 bottom-0 w-0.5 bg-white/70 pointer-events-none"
            style={{ left: `${(currentTime / dur) * 100}%` }} />
        </div>
      )}
      {/* Live transcript — karaoke style */}
      {hasText && (
        <div ref={transcriptRef}
          className="max-h-48 overflow-y-auto rounded-[5px] bg-[var(--surface-3)] border border-[var(--border)] p-2 space-y-0.5 scroll-smooth"
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
                    ? 'bg-[var(--surface-2)] shadow-sm'
                    : 'hover:bg-[var(--surface-2)]'
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

// ── Speaker name editor ───────────────────────────────────────────────────────

function SpeakerNameEditor({ speaker, value, color, onChange }: {
  speaker: string
  value: string
  color: string
  onChange: (name: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function commit() {
    onChange(draft.trim() || speaker)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        className="text-xs font-medium w-28 px-1.5 py-0.5 rounded border border-[var(--border-mid)] bg-[var(--surface)] text-[var(--text-body)] outline-none"
        style={{ color }}
      />
    )
  }

  return (
    <button
      onClick={() => { setDraft(value); setEditing(true) }}
      className="text-xs font-medium hover:underline text-left"
      style={{ color }}
      title="Click to rename"
    >
      {value}
    </button>
  )
}

// ── Single job card ───────────────────────────────────────────────────────────

function JobCard({ job, onToggle, onSpeakerRename, onResave }: {
  job: Job
  onToggle: () => void
  onSpeakerRename: (jobId: string, speaker: string, name: string) => void
  onResave: (jobId: string) => void
}) {
  const [showTranscript, setShowTranscript] = useState(false)

  const result = job.result

  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--surface-3)] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[var(--text-bright)] truncate">{job.file.name}</p>
          <div className="text-xs text-[var(--text-muted)] mt-0.5">
            {job.status === 'pending' && 'Queued'}
            {job.status === 'processing' && <span className="flex items-center gap-1"><Spinner size="xs" /> Processing…</span>}
            {job.status === 'error' && <span className="text-[var(--red)]">{job.error}</span>}
            {job.status === 'done' && result && (
              `${result.num_speakers} speakers · ${formatTime(result.duration)} · ${result.segments.length} segments${result.language ? ` · ${result.language}` : ''}`
            )}
            {job.savedReportId && <span className="text-[var(--green)] ml-2">· Saved to library</span>}
          </div>
        </div>
        {job.expanded ? <ChevronUp size={14} className="text-[var(--text-muted)] shrink-0" /> : <ChevronDown size={14} className="text-[var(--text-muted)] shrink-0" />}
      </button>

      {job.expanded && result && (
        <div className="px-4 pb-4 space-y-4 border-t border-[var(--border)]">
          {/* Player */}
          <div className="pt-3">
            <AudioPlayer
              src={job.audioUrl}
              segments={result.segments}
              speakerNames={job.speakerNames}
            />
          </div>

          {/* Per-speaker stats + name editing */}
          <div className="space-y-2">
            {speakerStats(result.segments, result.duration).map(({ speaker, secs, pct }) => {
              const color = speakerColor(speaker, result.segments)
              const displayName = job.speakerNames[speaker] || speaker
              return (
                <div key={speaker} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <SpeakerNameEditor
                      speaker={speaker}
                      value={displayName}
                      color={color}
                      onChange={name => onSpeakerRename(job.id, speaker, name)}
                    />
                    <span className="text-[var(--text-muted)]">{formatDur(secs)} · {pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--surface-3)] overflow-hidden">
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
              <pre className="mt-2 max-h-52 overflow-y-auto rounded-[5px] bg-[var(--surface-3)] border border-[var(--border)] p-3 text-[11px] leading-relaxed text-[var(--text-body)] whitespace-pre-wrap font-mono">
                {buildTranscript(result.segments, job.speakerNames)}
              </pre>
            )}
          </div>

          {/* Segments */}
          <div className="space-y-1 max-h-52 overflow-y-auto">
            {result.segments.map((seg, i) => {
              const color = speakerColor(seg.speaker, result.segments)
              const name = job.speakerNames[seg.speaker] || seg.speaker
              return (
                <div key={i} className="px-3 py-1.5 rounded-[5px] bg-[var(--surface-3)] text-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <span className="font-medium w-24 shrink-0 truncate" style={{ color }}>{name}</span>
                    <span className="text-[var(--text-muted)] tabular-nums">{formatTime(seg.start)} – {formatTime(seg.end)}</span>
                    <span className="ml-auto text-[var(--text-muted)] tabular-nums">{formatDur(seg.duration)}</span>
                  </div>
                  {seg.text && (
                    <p className="mt-1 ml-[26px] text-[var(--text-body)] leading-relaxed">{seg.text}</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Save status */}
          {job.savedReportId ? (
            <div className="flex items-center gap-3">
              <p className="flex items-center gap-1.5 text-xs text-[var(--green)]">
                <Check size={12} /> Saved to library
              </p>
              <button
                onClick={() => onResave(job.id)}
                className="text-[11px] text-[var(--text-muted)] hover:text-[var(--text-body)] underline"
              >
                Update saved version
              </button>
            </div>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
              <Spinner size="xs" /> Saving…
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

let jobCounter = 0

export default function SpeakersClient({ projects }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [numSpeakers, setNumSpeakers] = useState('')
  const [transcribe, setTranscribe] = useState(true)
  const [modelSize, setModelSize] = useState('base')
  const [processing, setProcessing] = useState(false)
  const [saveProjectId, setSaveProjectId] = useState(projects[0]?.id ?? '')
  const [saveArea, setSaveArea] = useState('Audio')

  // Auto-save immediately after processing — uses current project/area settings
  function autoSave(jobId: string, file: File, result: DiarizeResult, speakerNames: Record<string, string>) {
    const fd = new FormData()
    fd.append('audio', file)
    const meta: Record<string, unknown> = {
      area: saveArea || 'Audio',
      fileName: file.name,
      diarization: result,
      speakerNames,
    }
    if (saveProjectId) meta.projectId = saveProjectId
    fd.append('meta', JSON.stringify(meta))
    fetch('/api/speakers/save', { method: 'POST', body: fd })
      .then(r => r.json())
      .then((data: { reportId?: string }) => {
        if (data.reportId) {
          setJobs(prev => prev.map(j => j.id === jobId ? { ...j, savedReportId: data.reportId } : j))
        }
      })
      .catch(() => { /* silent */ })
  }

  function addFiles(files: FileList) {
    const newJobs: Job[] = Array.from(files).map(file => ({
      id: String(++jobCounter),
      file,
      audioUrl: URL.createObjectURL(file),
      status: 'pending',
      speakerNames: {},
      expanded: false,
    }))
    setJobs(prev => [...prev, ...newJobs])
  }

  const processQueue = useCallback(async (queue: Job[]) => {
    setProcessing(true)
    for (const job of queue) {
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'processing', expanded: false } : j))
      try {
        const fd = new FormData()
        fd.append('audio', job.file)
        const n = parseInt(numSpeakers, 10)
        if (!isNaN(n) && n >= 2) fd.append('numSpeakers', String(n))
        if (transcribe) fd.append('modelSize', modelSize)
        const endpoint = transcribe ? '/api/speakers/transcribe' : '/api/speakers/diarize'
        const res = await fetch(endpoint, { method: 'POST', body: fd })
        const data = await res.json() as DiarizeResult & { error?: string }
        if (!res.ok) {
          setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'error', error: data.error ?? 'Failed', expanded: true } : j))
        } else {
          const speakerNames: Record<string, string> = {}
          const unique = [...new Set(data.segments.map(s => s.speaker))]
          unique.forEach(sp => { speakerNames[sp] = sp })
          setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'done', result: data, speakerNames, expanded: true } : j))

          // Try to identify speaker names from transcript (non-blocking)
          const hasText = data.segments.some(s => s.text)
          if (hasText && unique.length > 0) {
            fetch('/api/speakers/identify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ segments: data.segments, speakerLabels: unique }),
            })
              .then(r => r.json())
              .then((idData: { names?: Record<string, string> }) => {
                if (idData.names && Object.keys(idData.names).length > 0) {
                  setJobs(prev => prev.map(j => j.id === job.id
                    ? { ...j, speakerNames: { ...j.speakerNames, ...idData.names } }
                    : j
                  ))
                }
              })
              .catch(() => { /* silent — name identification is best-effort */ })
          }

          // Auto-save to file system
          autoSave(job.id, job.file, data, speakerNames)
        }
      } catch {
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'error', error: 'Could not reach server', expanded: true } : j))
      }
    }
    setProcessing(false)
  }, [numSpeakers, transcribe, modelSize])

  async function handleDiarizeAll() {
    const pending = jobs.filter(j => j.status === 'pending')
    if (pending.length === 0) return
    await processQueue(pending)
  }

  function renameSpeaker(jobId: string, speaker: string, name: string) {
    setJobs(prev => prev.map(j => j.id === jobId
      ? { ...j, speakerNames: { ...j.speakerNames, [speaker]: name } }
      : j
    ))
  }

  async function saveJob(jobId: string) {
    const job = jobs.find(j => j.id === jobId)
    if (!job || !job.result) return
    try {
      const fd = new FormData()
      fd.append('audio', job.file)
      const meta: Record<string, unknown> = {
        area: saveArea || 'Audio',
        fileName: job.file.name,
        diarization: job.result,
        speakerNames: job.speakerNames,
      }
      if (saveProjectId) meta.projectId = saveProjectId
      fd.append('meta', JSON.stringify(meta))
      const res = await fetch('/api/speakers/save', { method: 'POST', body: fd })
      const data = await res.json() as { reportId?: string; error?: string }
      if (data.reportId) {
        setJobs(prev => prev.map(j => j.id === jobId ? { ...j, savedReportId: data.reportId } : j))
      }
    } catch { /* silent */ }
  }

  function toggleJob(jobId: string) {
    setJobs(prev => prev.map(j => j.id === jobId ? { ...j, expanded: !j.expanded } : j))
  }

  function removeJob(jobId: string) {
    setJobs(prev => {
      const job = prev.find(j => j.id === jobId)
      if (job) URL.revokeObjectURL(job.audioUrl)
      return prev.filter(j => j.id !== jobId)
    })
  }

  const selectedProjectAreas = projects.find(p => p.id === saveProjectId)?.areas ?? []
  const pendingCount = jobs.filter(j => j.status === 'pending').length
  const doneCount = jobs.filter(j => j.status === 'done').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[var(--text-bright)]">Speaker Diarization</h1>
        <p className="text-sm text-[var(--text-subtle)] mt-1">
          Identify and segment speakers in audio recordings. Click speaker labels to rename them.
        </p>
      </div>

      {/* Mode toggle: diarize only vs diarize + transcribe */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setTranscribe(false)}
            disabled={processing}
            className={`px-3 py-1.5 rounded-[6px] text-xs font-medium transition-colors ${
              !transcribe
                ? 'bg-[var(--ink)] text-[var(--ink-contrast)]'
                : 'bg-[var(--surface-2)] text-[var(--text-subtle)] hover:text-[var(--text-body)]'
            }`}
          >
            Diarize only
          </button>
          <button
            onClick={() => setTranscribe(true)}
            disabled={processing}
            className={`px-3 py-1.5 rounded-[6px] text-xs font-medium transition-colors ${
              transcribe
                ? 'bg-[var(--ink)] text-[var(--ink-contrast)]'
                : 'bg-[var(--surface-2)] text-[var(--text-subtle)] hover:text-[var(--text-body)]'
            }`}
          >
            Diarize + Transcribe
          </button>
        </div>

        {/* Whisper model selector — only shown when transcription is enabled */}
        {transcribe && (
          <div className="space-y-2">
            <p className="text-xs text-[var(--text-muted)]">Transcription model</p>
            <div className="grid gap-2">
              {WHISPER_MODELS.map(m => (
                <button
                  key={m.value}
                  onClick={() => setModelSize(m.value)}
                  disabled={processing}
                  className={`text-left px-3 py-2.5 rounded-[6px] border transition-colors ${
                    modelSize === m.value
                      ? 'border-[var(--blue)] bg-[var(--blue-dim,var(--surface-2))]'
                      : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--border-mid)]'
                  }`}
                >
                  <p className={`text-xs font-medium ${modelSize === m.value ? 'text-[var(--blue)]' : 'text-[var(--text-bright)]'}`}>
                    {m.label}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5 leading-relaxed">{m.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Save destination — project + area */}
      <div className="flex items-end gap-3 flex-wrap">
        <div className="space-y-1">
          <p className="text-[11px] text-[var(--text-muted)]">Story (optional)</p>
          <SelectField
            value={saveProjectId}
            onChange={setSaveProjectId}
            options={[
              { value: '', label: 'No story — save to General' },
              ...projects.map(p => ({ value: p.id, label: p.name })),
            ]}
            placeholder="Select story…"
            className="w-52"
          />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] text-[var(--text-muted)]">Area</p>
          {selectedProjectAreas.length > 0 ? (
            <SelectField
              value={saveArea}
              onChange={setSaveArea}
              options={selectedProjectAreas.map(a => ({ value: a, label: a }))}
              placeholder="Select area…"
              className="w-40"
            />
          ) : (
            <Input
              value={saveArea}
              onChange={e => setSaveArea(e.target.value)}
              placeholder="e.g. Interviews"
              inputSize="sm"
              className="w-40"
            />
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <input ref={inputRef} type="file" multiple
          accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac,.opus,.webm"
          className="hidden"
          onChange={e => { if (e.target.files?.length) addFiles(e.target.files) }}
        />
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={processing}>
          <Plus size={13} /> Add files
        </Button>
        <Input
          value={numSpeakers}
          onChange={e => setNumSpeakers(e.target.value)}
          placeholder="Speakers (optional)"
          inputSize="sm"
          type="number"
          min="2"
          max="20"
          className="w-40"
          disabled={processing}
        />
        {pendingCount > 0 && (
          <Button variant="primary" size="sm" onClick={handleDiarizeAll} disabled={processing}>
            {processing ? <Spinner size="xs" /> : `${transcribe ? 'Transcribe' : 'Diarize'} ${pendingCount} file${pendingCount !== 1 ? 's' : ''}`}
          </Button>
        )}
      </div>

      {/* Job list */}
      {jobs.length === 0 && (
        <EmptyState
          icon={<Mic size={20} />}
          title="No audio files yet"
          description='Click "Add files" to pick one or more recordings.'
          size="sm"
        />
      )}

      {jobs.length > 0 && (
        <div className="space-y-2">
          {jobs.map(job => (
            <div key={job.id} className="relative group">
              <JobCard
                job={job}
                onToggle={() => toggleJob(job.id)}
                onSpeakerRename={renameSpeaker}
                onResave={saveJob}
              />
              {/* Remove button */}
              {job.status !== 'processing' && (
                <button
                  onClick={() => removeJob(job.id)}
                  className="absolute top-3 right-10 hidden group-hover:flex items-center justify-center w-5 h-5 rounded-full bg-[var(--surface-3)] text-[var(--text-muted)] hover:text-[var(--red)] transition-colors"
                  title="Remove"
                >
                  <X size={10} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {doneCount > 0 && (
        <p className="text-xs text-[var(--text-muted)]">
          Tip: click any speaker name to rename it, then save to your story library.
        </p>
      )}
    </div>
  )
}
