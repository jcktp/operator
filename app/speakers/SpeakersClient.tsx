'use client'
import { useRef, useState, useEffect, useCallback } from 'react'
import { Button, Spinner, EmptyState, Input } from '@/components/ui'
import SelectField from '@/components/SelectField'
import { Mic, X, Play, Pause, Check, Save, ChevronDown, ChevronUp, Plus, FileText } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Segment {
  speaker: string
  start: number
  end: number
  duration: number
}

interface DiarizeResult {
  segments: Segment[]
  num_speakers: number
  duration: number
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
    .map(seg => `[${formatTime(seg.start)}–${formatTime(seg.end)}] ${speakerNames[seg.speaker] || seg.speaker}`)
    .join('\n')
}

// ── Inline audio player ───────────────────────────────────────────────────────

function AudioPlayer({ src, segments, speakerNames }: {
  src: string
  segments: Segment[]
  speakerNames: Record<string, string>
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
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

  const seekTo = (t: number) => {
    if (audioRef.current) { audioRef.current.currentTime = t; audioRef.current.play().catch(() => {}) }
  }
  const togglePlay = () => {
    if (!audioRef.current) return
    if (audioRef.current.paused) audioRef.current.play().catch(() => {})
    else audioRef.current.pause()
  }

  const activeSeg = segments.find(s => currentTime >= s.start && currentTime < s.end)
  const activeColor = activeSeg ? speakerColor(activeSeg.speaker, segments) : undefined
  const activeName = activeSeg ? (speakerNames[activeSeg.speaker] || activeSeg.speaker) : null
  const dur = duration || segments[segments.length - 1]?.end || 1

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
      {activeName && (
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

function JobCard({ job, projects, onToggle, onSpeakerRename, onSave }: {
  job: Job
  projects: Project[]
  onToggle: () => void
  onSpeakerRename: (jobId: string, speaker: string, name: string) => void
  onSave: (jobId: string, projectId: string, area: string) => void
}) {
  const [saveProjectId, setSaveProjectId] = useState(projects[0]?.id ?? '')
  const [saveArea, setSaveArea] = useState('')
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [showTranscript, setShowTranscript] = useState(false)

  const projectOptions = projects.map(p => ({ value: p.id, label: p.name }))
  const projectAreas = projects.find(p => p.id === saveProjectId)?.areas ?? []
  const areaOptions = projectAreas.map(a => ({ value: a, label: a }))

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
              `${result.num_speakers} speakers · ${formatTime(result.duration)} · ${result.segments.length} segments`
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
                <div key={i} className="flex items-center gap-3 px-3 py-1.5 rounded-[5px] bg-[var(--surface-3)] text-xs">
                  <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="font-medium w-24 shrink-0 truncate" style={{ color }}>{name}</span>
                  <span className="text-[var(--text-muted)] tabular-nums">{formatTime(seg.start)} – {formatTime(seg.end)}</span>
                  <span className="ml-auto text-[var(--text-muted)] tabular-nums">{formatDur(seg.duration)}</span>
                </div>
              )
            })}
          </div>

          {/* Save to library */}
          {!job.savedReportId && (
            <div>
              {!showSaveForm ? (
                <button
                  onClick={() => setShowSaveForm(true)}
                  className="flex items-center gap-1.5 text-xs text-[var(--blue)] hover:underline"
                >
                  <Save size={12} /> Save to library
                </button>
              ) : (
                <div className="flex items-end gap-2 flex-wrap">
                  <div className="space-y-1">
                    <p className="text-[11px] text-[var(--text-muted)]">Story</p>
                    <SelectField
                      value={saveProjectId}
                      onChange={setSaveProjectId}
                      options={projectOptions}
                      placeholder="Select story…"
                      className="w-40"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[11px] text-[var(--text-muted)]">Area</p>
                    {areaOptions.length > 0 ? (
                      <SelectField
                        value={saveArea}
                        onChange={setSaveArea}
                        options={areaOptions}
                        placeholder="Select area…"
                        className="w-36"
                      />
                    ) : (
                      <Input
                        value={saveArea}
                        onChange={e => setSaveArea(e.target.value)}
                        placeholder="e.g. Interviews"
                        inputSize="sm"
                        className="w-36"
                      />
                    )}
                  </div>
                  <Button variant="primary" size="sm"
                    disabled={!saveProjectId || !saveArea}
                    onClick={() => { onSave(job.id, saveProjectId, saveArea); setShowSaveForm(false) }}
                  >
                    Save
                  </Button>
                  <button onClick={() => setShowSaveForm(false)} className="text-xs text-[var(--text-muted)] hover:text-[var(--text-body)]">Cancel</button>
                </div>
              )}
            </div>
          )}

          {job.savedReportId && (
            <p className="flex items-center gap-1.5 text-xs text-[var(--green)]">
              <Check size={12} /> Saved to library
            </p>
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
  const [processing, setProcessing] = useState(false)

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
        const res = await fetch('/api/speakers/diarize', { method: 'POST', body: fd })
        const data = await res.json() as DiarizeResult & { error?: string }
        if (!res.ok) {
          setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'error', error: data.error ?? 'Failed', expanded: true } : j))
        } else {
          const speakerNames: Record<string, string> = {}
          const unique = [...new Set(data.segments.map(s => s.speaker))]
          unique.forEach(sp => { speakerNames[sp] = sp })
          setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'done', result: data, speakerNames, expanded: true } : j))
        }
      } catch {
        setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'error', error: 'Could not reach server', expanded: true } : j))
      }
    }
    setProcessing(false)
  }, [numSpeakers])

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

  async function saveJob(jobId: string, projectId: string, area: string) {
    const job = jobs.find(j => j.id === jobId)
    if (!job || !job.result) return
    try {
      const fd = new FormData()
      fd.append('audio', job.file)
      fd.append('meta', JSON.stringify({
        projectId,
        area,
        fileName: job.file.name,
        diarization: job.result,
        speakerNames: job.speakerNames,
      }))
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
            {processing ? <Spinner size="xs" /> : `Diarize ${pendingCount} file${pendingCount !== 1 ? 's' : ''}`}
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
                projects={projects}
                onToggle={() => toggleJob(job.id)}
                onSpeakerRename={renameSpeaker}
                onSave={saveJob}
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
