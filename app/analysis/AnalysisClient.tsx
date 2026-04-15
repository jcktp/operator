'use client'
import { useState } from 'react'
import FaceExtract from './FaceExtract'
import FaceCompare from './FaceCompare'
import FaceSearch from './FaceSearch'
import { AlertCircle, CheckCircle, HelpCircle } from 'lucide-react'
import { Button, Spinner, Card, CardHeader, CardBody } from '@/components/ui'
import SelectField from '@/components/SelectField'
import FilePicker from './FilePicker'

interface Project {
  id: string
  name: string
}

interface Props {
  projects: Project[]
  initialProjectId: string
}

// ── Shared tab types ──────────────────────────────────────────────────────────

type Tab = 'extract' | 'compare' | 'search' | 'ela' | 'deepfake'

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'extract',  label: 'Extract' },
  { id: 'compare',  label: 'Compare' },
  { id: 'search',   label: 'Search' },
  { id: 'ela',      label: 'ELA' },
  { id: 'deepfake', label: 'Deepfake' },
]

// ── Forensics helpers ─────────────────────────────────────────────────────────

interface ElaResult {
  score: number
  max_score: number
  verdict: string
  ela_image_base64: string
}

interface DeepfakeResult {
  score: number
  verdict: string
  detail: string
}

function verdictColor(verdict: string): string {
  if (verdict.includes('authentic') || verdict.includes('real')) return 'var(--green)'
  if (verdict.includes('possibly')) return 'var(--amber)'
  return 'var(--red)'
}

function verdictIcon(verdict: string) {
  if (verdict.includes('authentic') || verdict.includes('real'))
    return <CheckCircle size={14} />
  if (verdict.includes('possibly'))
    return <HelpCircle size={14} />
  return <AlertCircle size={14} />
}

function verdictLabel(verdict: string): string {
  const map: Record<string, string> = {
    likely_authentic: 'Likely authentic',
    possibly_manipulated: 'Possibly manipulated',
    likely_manipulated: 'Likely manipulated',
    likely_real: 'Likely real',
    possibly_synthetic: 'Possibly synthetic',
    likely_synthetic: 'Likely synthetic (deepfake)',
  }
  return map[verdict] ?? verdict
}

// ── ELA tab ───────────────────────────────────────────────────────────────────

function ElaTab() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ElaResult | null>(null)

  async function run() {
    if (!file) return
    setLoading(true); setError(null); setResult(null)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch('/api/forensics/ela', { method: 'POST', body: fd })
      const data = await res.json() as ElaResult & { error?: string }
      if (!res.ok) { setError(data.error ?? 'ELA failed'); return }
      setResult(data)
    } catch { setError('Could not reach the server') }
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-muted)]">
        Error Level Analysis — detects JPEG re-save artefacts indicating manipulation.
      </p>
      <FilePicker value={file} onChange={setFile} label="Upload image" disabled={loading} />
      <Button variant="primary" size="sm" onClick={run} disabled={loading || !file}>
        {loading ? <Spinner size="xs" /> : 'Analyse'}
      </Button>
      {error && <p className="text-xs text-[var(--red)]">{error}</p>}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2" style={{ color: verdictColor(result.verdict) }}>
            {verdictIcon(result.verdict)}
            <span className="text-sm font-medium">{verdictLabel(result.verdict)}</span>
          </div>
          <div className="flex gap-4 text-xs text-[var(--text-muted)]">
            <span>Mean score: {(result.score * 100).toFixed(2)}%</span>
            <span>Peak: {(result.max_score * 100).toFixed(2)}%</span>
          </div>
          <div>
            <p className="text-xs text-[var(--text-muted)] mb-1.5">ELA difference image:</p>
            <img
              src={`data:image/jpeg;base64,${result.ela_image_base64}`}
              alt="ELA result"
              className="rounded-[6px] border border-[var(--border)] max-w-full"
              style={{ maxHeight: 280, objectFit: 'contain' }}
            />
            <p className="text-[11px] text-[var(--text-muted)] mt-1">
              Bright regions indicate areas re-saved at different quality — potential tampering.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Deepfake tab ──────────────────────────────────────────────────────────────

function DeepfakeTab() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DeepfakeResult | null>(null)

  async function run() {
    if (!file) return
    setLoading(true); setError(null); setResult(null)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch('/api/forensics/deepfake', { method: 'POST', body: fd })
      const data = await res.json() as DeepfakeResult & { error?: string }
      if (!res.ok) { setError(data.error ?? 'Deepfake analysis failed'); return }
      setResult(data)
    } catch { setError('Could not reach the server') }
    finally { setLoading(false) }
  }

  const pct = result ? Math.round(result.score * 100) : 0
  const barColor = result ? verdictColor(result.verdict) : 'var(--border-mid)'

  return (
    <div className="space-y-4">
      <p className="text-xs text-[var(--text-muted)]">
        Frequency-domain analysis — detects GAN/diffusion generated images.
      </p>
      <FilePicker value={file} onChange={setFile} label="Upload image" disabled={loading} />
      <Button variant="primary" size="sm" onClick={run} disabled={loading || !file}>
        {loading ? <Spinner size="xs" /> : 'Analyse'}
      </Button>
      {error && <p className="text-xs text-[var(--red)]">{error}</p>}
      {result && (
        <div className="space-y-3">
          <div className="flex items-center gap-2" style={{ color: verdictColor(result.verdict) }}>
            {verdictIcon(result.verdict)}
            <span className="text-sm font-medium">{verdictLabel(result.verdict)}</span>
          </div>
          <div>
            <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
              <span>Synthetic probability</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--surface-3)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: barColor }}
              />
            </div>
          </div>
          <p className="text-xs text-[var(--text-muted)]">{result.detail}</p>
        </div>
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AnalysisClient({ projects, initialProjectId }: Props) {
  const [tab, setTab] = useState<Tab>('extract')
  const [projectId, setProjectId] = useState(initialProjectId || (projects[0]?.id ?? ''))

  const needsProject = tab === 'extract' || tab === 'compare' || tab === 'search'

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-[var(--text-bright)]">Image Analysis</h1>
        {needsProject && projects.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--text-muted)]">Story</span>
            <SelectField
              value={projectId}
              onChange={setProjectId}
              options={projects.map(p => ({ value: p.id, label: p.name }))}
              placeholder="Select story…"
              className="w-44"
            />
          </div>
        )}
      </div>

      {/* Tabs */}
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

      {/* Tab content */}
      <div>
        {tab === 'extract' && <FaceExtract projectId={projectId} />}
        {tab === 'compare' && <FaceCompare projectId={projectId} />}
        {tab === 'search'  && <FaceSearch  projectId={projectId} />}
        {tab === 'ela'     && <ElaTab />}
        {tab === 'deepfake' && <DeepfakeTab />}
      </div>
    </div>
  )
}
