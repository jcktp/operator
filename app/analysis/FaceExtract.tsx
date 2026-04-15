'use client'
import { useRef, useState, useEffect } from 'react'
import { Button, Spinner, EmptyState } from '@/components/ui'
import FilePicker from './FilePicker'

interface SavedFace {
  id: string
  imageSource: string
  bbox: string
  createdAt: string
}

interface Props {
  projectId: string
}

function FaceCrop({ imageSource, bboxJson }: { imageSource: string; bboxJson: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let bbox: [number, number, number, number]
    try {
      bbox = JSON.parse(bboxJson) as [number, number, number, number]
    } catch {
      return
    }
    const [x, y, w, h] = bbox
    const thumb = 80
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
  }, [imageSource, bboxJson])

  return (
    <canvas
      ref={canvasRef}
      width={80}
      height={80}
      className="rounded border border-[var(--border)] bg-[var(--surface-2)]"
      style={{ width: 80, height: 80 }}
    />
  )
}

export default function FaceExtract({ projectId }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [faces, setFaces] = useState<SavedFace[]>([])

  async function handleExtract() {
    if (!file || !projectId) return
    setLoading(true)
    setError(null)
    setFaces([])
    try {
      const formData = new FormData()
      formData.append('projectId', projectId)
      formData.append('image', file)
      const res = await fetch('/api/faces/extract', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: formData,
      })
      const data = await res.json() as { faces?: SavedFace[]; error?: string }
      if (!res.ok) {
        setError(data.error ?? 'Extraction failed')
        return
      }
      setFaces(data.faces ?? [])
    } catch {
      setError('Could not reach the server')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <FilePicker
        value={file}
        onChange={setFile}
        label="Click to choose an image"
        disabled={loading}
      />

      <Button
        variant="primary"
        size="sm"
        onClick={handleExtract}
        disabled={loading || !file || !projectId}
      >
        {loading ? <Spinner size="xs" /> : 'Extract Faces'}
      </Button>

      {error && <p className="text-xs text-[var(--red)]">{error}</p>}

      {!loading && faces.length === 0 && !error && (
        <EmptyState
          title="No faces extracted yet"
          description="Choose an image above and click Extract Faces."
          size="sm"
        />
      )}

      {faces.length > 0 && (
        <div>
          <p className="text-xs text-[var(--text-subtle)] mb-2">
            {faces.length} face{faces.length !== 1 ? 's' : ''} detected — saved to case index
          </p>
          <div className="flex flex-wrap gap-2">
            {faces.map((face) => (
              <FaceCrop key={face.id} imageSource={face.imageSource} bboxJson={face.bbox} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
