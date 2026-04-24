'use client'
import { useEffect, useRef, useState } from 'react'
import { Button, Spinner, EmptyState } from '@/components/ui'
import FilePicker from './FilePicker'

interface SavedFace {
  id: string
  imageSource: string
  bbox: string
  createdAt: string
}

interface MatchResult {
  id: string
  distance: number
  imageSource: string
  bbox: [number, number, number, number] | null
  createdAt: string
}

interface Props {
  projectId: string
}

function FaceCrop({ imageSource, bbox }: { imageSource: string; bbox: [number, number, number, number] | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !bbox) return
    const [x, y, w, h] = bbox
    const thumb = 72
    canvas.width = thumb
    canvas.height = thumb
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      ctx.drawImage(img, x, y, w, h, 0, 0, thumb, thumb)
    }
    img.src = `/api/files/download?path=${encodeURIComponent(imageSource)}`
  }, [imageSource, bbox])

  return (
    <canvas
      ref={canvasRef}
      width={72}
      height={72}
      className="rounded border border-[var(--border)] bg-[var(--surface-2)]"
      style={{ width: 72, height: 72 }}
    />
  )
}

export default function FaceSearch({ projectId }: Props) {
  const [probeFile, setProbeFile] = useState<File | null>(null)
  const [extracting, setExtracting] = useState(false)
  const [probeFaces, setProbeFaces] = useState<SavedFace[]>([])
  const [probeFaceId, setProbeFaceId] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [matches, setMatches] = useState<MatchResult[] | null>(null)

  useEffect(() => {
    setProbeFaces([])
    setProbeFaceId(null)
    setMatches(null)
    setError(null)
  }, [projectId])

  // When a new file is picked, auto-extract probe faces
  useEffect(() => {
    if (!probeFile || !projectId) return
    setProbeFaces([])
    setProbeFaceId(null)
    setMatches(null)
    setError(null)
    setExtracting(true)
    const formData = new FormData()
    formData.append('projectId', projectId)
    formData.append('image', probeFile)
    fetch('/api/faces/extract', {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: formData,
    })
      .then((r) => r.json())
      .then((data: { faces?: SavedFace[]; error?: string }) => {
        if (data.error) { setError(data.error); return }
        const extracted = data.faces ?? []
        setProbeFaces(extracted)
        if (extracted.length === 1) setProbeFaceId(extracted[0].id)
      })
      .catch(() => setError('Could not reach the server'))
      .finally(() => setExtracting(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [probeFile])

  async function handleSearch() {
    if (!probeFaceId || !projectId) return
    setSearching(true)
    setError(null)
    setMatches(null)
    try {
      const res = await fetch('/api/faces/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ projectId, probeFaceId }),
      })
      const data = await res.json() as { matches?: MatchResult[]; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Search failed')
        return
      }
      setMatches(data.matches ?? [])
    } catch {
      setError('Could not reach the server')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="space-y-4">
      <FilePicker
        value={probeFile}
        onChange={(f) => { setProbeFile(f) }}
        label="Upload probe image"
        disabled={extracting || searching}
      />

      {extracting && (
        <div className="flex items-center gap-2 text-xs text-[var(--text-subtle)]">
          <Spinner size="xs" /> Detecting faces…
        </div>
      )}

      {/* When multiple faces detected, let user pick the probe */}
      {!extracting && probeFaces.length > 1 && (
        <div>
          <p className="text-xs text-[var(--text-muted)] mb-2">
            Multiple faces found — select the one to search for:
          </p>
          <div className="flex flex-wrap gap-2">
            {probeFaces.map((face) => (
              <button
                key={face.id}
                onClick={() => setProbeFaceId(face.id)}
                className="rounded focus:outline-none"
                style={{
                  outline: probeFaceId === face.id ? '2px solid var(--blue)' : '2px solid transparent',
                  outlineOffset: 2,
                }}
              >
                <FaceCrop imageSource={face.imageSource} bbox={JSON.parse(face.bbox)} />
              </button>
            ))}
          </div>
        </div>
      )}

      {!extracting && probeFaces.length === 1 && (
        <div className="flex items-center gap-2">
          <FaceCrop
            imageSource={probeFaces[0].imageSource}
            bbox={JSON.parse(probeFaces[0].bbox)}
          />
          <span className="text-xs text-[var(--text-subtle)]">Probe face ready</span>
        </div>
      )}

      <Button variant="primary" size="sm" onClick={handleSearch} disabled={!probeFaceId || searching}>
        {searching ? <Spinner size="xs" /> : 'Search Case Index'}
      </Button>

      {error && <p className="text-xs text-[var(--red)]">{error}</p>}

      {matches !== null && matches.length === 0 && (
        <EmptyState
          title="No matches found"
          description="No faces in the case index matched the probe above the threshold."
          size="sm"
        />
      )}

      {matches && matches.length > 0 && (
        <div>
          <p className="text-xs text-[var(--text-subtle)] mb-3">
            {matches.length} match{matches.length !== 1 ? 'es' : ''} found
          </p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {matches.map((m) => (
              <div
                key={m.id}
                className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] p-2 space-y-1"
              >
                <FaceCrop imageSource={m.imageSource} bbox={m.bbox} />
                <p className="text-[11px] text-[var(--text-muted)] truncate" title={m.imageSource}>
                  {m.imageSource.split('/').pop()}
                </p>
                <p className="text-[11px] text-[var(--text-subtle)]">
                  dist {m.distance.toFixed(3)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
