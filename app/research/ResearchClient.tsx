'use client'
import { useState, useMemo, useRef } from 'react'
import { Button, Spinner, EmptyState, Input, Card, CardHeader, CardBody } from '@/components/ui'
import SelectField from '@/components/SelectField'
import { ExternalLink, Clock, AlertCircle, GitCompare, Upload } from 'lucide-react'
import { diff_match_patch } from 'diff-match-patch'

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'wayback' | 'diff'

interface Snapshot {
  timestamp: string
  url: string
  statusCode: string
  mimetype: string
}

interface AvailableResult {
  url: string
  closest?: {
    status: string
    available: boolean
    url: string
    timestamp: string
  }
}

interface Report {
  id: string
  title: string
  rawContent: string
}

interface Project {
  id: string
  name: string
  reports: Report[]
}

interface Props {
  projects: Project[]
}

// ── Wayback helpers ───────────────────────────────────────────────────────────

function formatTimestamp(ts: string): string {
  if (ts.length < 14) return ts
  return `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)} ${ts.slice(8, 10)}:${ts.slice(10, 12)}`
}

function waybackUrl(timestamp: string, original: string): string {
  return `https://web.archive.org/web/${timestamp}/${original}`
}

// ── Diff helpers ──────────────────────────────────────────────────────────────

type DiffOp = -1 | 0 | 1
type DiffSegment = [DiffOp, string]

function buildDiff(textA: string, textB: string): DiffSegment[] {
  const dmp = new diff_match_patch()
  dmp.Diff_Timeout = 2
  const diffs = dmp.diff_main(textA, textB)
  dmp.diff_cleanupSemantic(diffs)
  return diffs as DiffSegment[]
}

function DiffView({ diffs }: { diffs: DiffSegment[] }) {
  return (
    <div className="font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
      {diffs.map((seg, i) => {
        const [op, text] = seg
        if (op === 0) return <span key={i} className="text-[var(--text-body)]">{text}</span>
        if (op === -1) return <span key={i} className="bg-[var(--red-dim)] text-[var(--red)] line-through">{text}</span>
        return <span key={i} className="bg-[var(--green-dim)] text-[var(--green)]">{text}</span>
      })}
    </div>
  )
}

function countChanges(diffs: DiffSegment[]): { added: number; removed: number } {
  let added = 0; let removed = 0
  for (const [op, text] of diffs) {
    const words = text.split(/\s+/).filter(Boolean).length
    if (op === 1) added += words
    if (op === -1) removed += words
  }
  return { added, removed }
}

// ── Doc picker (upload OR select from index) ──────────────────────────────────

interface DocPickerProps {
  label: string
  projects: Project[]
  onText: (text: string, label: string) => void
  disabled?: boolean
}

function DocPicker({ label, projects, onText, disabled }: DocPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'upload' | 'select'>('upload')
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [reportId, setReportId] = useState('')
  const [uploading, setUploading] = useState(false)
  const [fileName, setFileName] = useState('')

  const reports = projects.find(p => p.id === projectId)?.reports ?? []

  async function handleFile(file: File) {
    setUploading(true)
    setFileName(file.name)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/research/extract-text', { method: 'POST', body: fd })
      const data = await res.json() as { text?: string; error?: string }
      if (data.text) onText(data.text, file.name)
    } finally {
      setUploading(false)
    }
  }

  function handleSelect() {
    const report = reports.find(r => r.id === reportId)
    if (report) onText(report.rawContent, report.title)
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>
      <div className="flex gap-1">
        {(['upload', 'select'] as const).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`text-[11px] px-2.5 py-1 rounded-[4px] border transition-colors ${
              mode === m
                ? 'bg-[var(--ink)] text-[var(--ink-contrast)] border-[var(--ink)]'
                : 'bg-[var(--surface)] text-[var(--text-subtle)] border-[var(--border)] hover:border-[var(--border-mid)]'
            }`}
          >
            {m === 'upload' ? 'Upload file' : 'From index'}
          </button>
        ))}
      </div>

      {mode === 'upload' && (
        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.docx,.doc,.txt,.md,.csv,.json,.xml"
            className="hidden"
            disabled={disabled || uploading}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || uploading}
            className="flex items-center gap-2 w-full min-h-[44px] rounded-[8px] border-2 border-dashed border-[var(--border-mid)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] hover:border-[var(--text-muted)] transition-colors disabled:opacity-40 disabled:pointer-events-none px-3"
          >
            {uploading ? <Spinner size="xs" /> : <Upload size={14} className="text-[var(--text-muted)]" />}
            <span className="text-xs text-[var(--text-subtle)] truncate">
              {fileName || 'PDF, DOCX, TXT, MD…'}
            </span>
          </button>
        </div>
      )}

      {mode === 'select' && (
        <div className="space-y-1.5">
          <SelectField
            value={projectId}
            onChange={v => { setProjectId(v); setReportId('') }}
            options={projects.map(p => ({ value: p.id, label: p.name }))}
            placeholder="Select story…"
          />
          <div className="flex gap-2">
            <SelectField
              value={reportId}
              onChange={setReportId}
              options={reports.map(r => ({ value: r.id, label: r.title }))}
              placeholder="— select document —"
              className="flex-1"
            />
            <Button variant="outline" size="sm" onClick={handleSelect} disabled={!reportId || disabled}>
              Use
            </Button>
          </div>
          {reports.length === 0 && (
            <p className="text-[11px] text-[var(--text-muted)]">No documents in this story yet.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ── Wayback tab ───────────────────────────────────────────────────────────────

function WaybackTab() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [available, setAvailable] = useState<AvailableResult | null>(null)
  const [snapshots, setSnapshots] = useState<Snapshot[] | null>(null)

  async function handleCheck() {
    const trimmed = url.trim()
    if (!trimmed) return
    setLoading(true); setError(null); setAvailable(null); setSnapshots(null)
    try {
      const res = await fetch(`/api/wayback/check?url=${encodeURIComponent(trimmed)}`)
      const data = await res.json() as { available?: AvailableResult; snapshots?: Snapshot[]; error?: string }
      if (!res.ok) { setError(data.error ?? 'Lookup failed'); return }
      setAvailable(data.available ?? null)
      setSnapshots(data.snapshots ?? null)
    } catch { setError('Could not reach the server') }
    finally { setLoading(false) }
  }

  const noResults = !loading && available !== null && !available.closest?.available && (!snapshots || snapshots.length === 0)

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-muted)]">
        Check archive.org for saved snapshots of a URL.
      </p>
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="https://example.com/article"
          inputSize="md"
          className="flex-1"
          onKeyDown={e => { if (e.key === 'Enter') handleCheck() }}
          disabled={loading}
        />
        <Button variant="primary" size="md" onClick={handleCheck} disabled={loading || !url.trim()}>
          {loading ? <Spinner size="xs" /> : 'Check'}
        </Button>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-sm text-[var(--red)]">
          <AlertCircle size={14} />{error}
        </div>
      )}
      {noResults && (
        <p className="text-xs text-[var(--text-muted)]">No snapshots found for this URL.</p>
      )}
      {available?.closest?.available && (
        <Card variant="flat">
          <CardHeader>
            <span className="text-sm font-medium text-[var(--text-bright)]">Closest snapshot</span>
          </CardHeader>
          <CardBody>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs text-[var(--text-muted)]">Captured {formatTimestamp(available.closest.timestamp)}</p>
                <p className="text-xs text-[var(--text-subtle)]">Status: {available.closest.status}</p>
              </div>
              <a href={available.closest.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-[var(--blue)] hover:underline">
                Open <ExternalLink size={11} />
              </a>
            </div>
          </CardBody>
        </Card>
      )}
      {snapshots && snapshots.length > 0 && (
        <div>
          <p className="text-xs text-[var(--text-subtle)] mb-3 flex items-center gap-1.5">
            <Clock size={13} />
            {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''} found
          </p>
          <div className="space-y-1.5">
            {snapshots.map(s => (
              <div key={s.timestamp}
                className="flex items-center justify-between rounded-[6px] border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
                <div className="space-y-0.5">
                  <p className="text-xs text-[var(--text-body)]">{formatTimestamp(s.timestamp)}</p>
                  <p className="text-[11px] text-[var(--text-muted)]">{s.mimetype} · HTTP {s.statusCode}</p>
                </div>
                <a href={waybackUrl(s.timestamp, url.trim())} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs text-[var(--blue)] hover:underline">
                  View <ExternalLink size={11} />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Diff tab ──────────────────────────────────────────────────────────────────

function DiffTab({ projects }: { projects: Project[] }) {
  const [textA, setTextA] = useState('')
  const [textB, setTextB] = useState('')
  const [labelA, setLabelA] = useState('Document A')
  const [labelB, setLabelB] = useState('Document B')

  const diffs = useMemo(() => {
    if (!textA || !textB) return null
    return buildDiff(textA, textB)
  }, [textA, textB])

  const stats = useMemo(() => diffs ? countChanges(diffs) : null, [diffs])
  const ready = !!textA && !!textB

  return (
    <div className="space-y-5">
      <p className="text-xs text-[var(--text-muted)]">
        Compare two documents — upload files or select from your story index.
      </p>
      <div className="grid grid-cols-2 gap-4">
        <DocPicker
          label="Document A"
          projects={projects}
          onText={(t, l) => { setTextA(t); setLabelA(l) }}
        />
        <DocPicker
          label="Document B"
          projects={projects}
          onText={(t, l) => { setTextB(t); setLabelB(l) }}
        />
      </div>

      {!ready && (
        <EmptyState
          icon={<GitCompare size={20} />}
          title="Select two documents"
          description="Upload or choose a document for each side above."
          size="sm"
        />
      )}

      {ready && diffs && (
        <>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs">
              <span className="text-[var(--green)]">+{stats?.added} words added</span>
              <span className="text-[var(--red)]">−{stats?.removed} words removed</span>
              {stats?.added === 0 && stats?.removed === 0 && (
                <span className="text-[var(--text-muted)]">Documents are identical</span>
              )}
            </div>
            <div className="text-xs text-[var(--text-muted)]">{labelA} → {labelB}</div>
          </div>
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] p-4 overflow-auto max-h-[560px]">
            <DiffView diffs={diffs} />
          </div>
        </>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'wayback', label: 'Wayback Machine' },
  { id: 'diff',    label: 'Document Diff' },
]

export default function ResearchClient({ projects }: Props) {
  const [tab, setTab] = useState<Tab>('wayback')

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-[var(--text-bright)]">Research Tools</h1>

      <div className="flex gap-1 border-b border-[var(--border)]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id
                ? 'border-[var(--ink)] text-[var(--text-bright)]'
                : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-body)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div>
        {tab === 'wayback' && <WaybackTab />}
        {tab === 'diff'    && <DiffTab projects={projects} />}
      </div>
    </div>
  )
}
