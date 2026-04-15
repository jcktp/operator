'use client'
import { useState } from 'react'
import { Button, Spinner, EmptyState } from '@/components/ui'
import FilePicker from './FilePicker'

interface CompareResult {
  verified: boolean
  distance: number
  threshold: number
  model: string
}

interface Props {
  projectId: string
}

function confidencePct(distance: number, threshold: number): number {
  return Math.round(Math.max(0, 1 - distance / threshold) * 100)
}

function confidenceColor(pct: number): string {
  if (pct >= 80) return 'var(--green)'
  if (pct >= 60) return 'var(--amber)'
  return 'var(--red)'
}

export default function FaceCompare({ projectId }: Props) {
  const [fileA, setFileA] = useState<File | null>(null)
  const [fileB, setFileB] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CompareResult | null>(null)

  async function handleCompare() {
    if (!fileA || !fileB || !projectId) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append('projectId', projectId)
      formData.append('imageA', fileA)
      formData.append('imageB', fileB)
      const res = await fetch('/api/faces/compare', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
      })
      const data = await res.json() as CompareResult & { error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Comparison failed')
        return
      }
      setResult(data)
    } catch {
      setError('Could not reach the server')
    } finally {
      setLoading(false)
    }
  }

  const pct = result ? confidencePct(result.distance, result.threshold) : 0
  const barColor = result ? confidenceColor(pct) : 'var(--border-mid)'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-1.5">Image A</p>
          <FilePicker value={fileA} onChange={setFileA} label="Choose image A" disabled={loading} />
        </div>
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-1.5">Image B</p>
          <FilePicker value={fileB} onChange={setFileB} label="Choose image B" disabled={loading} />
        </div>
      </div>

      <Button
        variant="primary"
        size="sm"
        onClick={handleCompare}
        disabled={loading || !fileA || !fileB || !projectId}
      >
        {loading ? <Spinner size="xs" /> : 'Compare Faces'}
      </Button>

      {error && <p className="text-xs text-[var(--red)]">{error}</p>}

      {!loading && !result && !error && (
        <EmptyState
          title="No comparison yet"
          description="Upload two photos and click Compare Faces."
          size="sm"
        />
      )}

      {result && (
        <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span
              className="text-sm font-semibold"
              style={{ color: result.verified ? 'var(--green)' : 'var(--red)' }}
            >
              {result.verified ? 'Same person' : 'Different people'}
            </span>
            <span className="text-xs text-[var(--text-muted)]">
              {result.model} · distance {result.distance.toFixed(3)}
            </span>
          </div>
          <div>
            <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
              <span>Confidence</span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-[var(--surface-3)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: barColor }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
