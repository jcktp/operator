'use client'
import { useRef, useState, useEffect, useCallback } from 'react'
import { Button, Spinner, EmptyState } from '@/components/ui'
import { X } from 'lucide-react'
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
  const [lightbox, setLightbox] = useState(false)
  const imgUrl = `/api/files/download?path=${encodeURIComponent(imageSource)}`

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
    img.src = imgUrl
  }, [imgUrl, bboxJson])

  return (
    <>
      <canvas
        ref={canvasRef}
        width={80}
        height={80}
        className="rounded border border-[var(--border)] bg-[var(--surface-2)] cursor-pointer hover:ring-2 hover:ring-[var(--brand)] transition-shadow"
        style={{ width: 80, height: 80 }}
        onClick={() => setLightbox(true)}
        title="Click to view full image"
      />
      {lightbox && (
        <FaceLightbox imgUrl={imgUrl} bboxJson={bboxJson} onClose={() => setLightbox(false)} />
      )}
    </>
  )
}

function FaceLightbox({ imgUrl, bboxJson, onClose }: { imgUrl: string; bboxJson: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let bbox: [number, number, number, number]
    try {
      bbox = JSON.parse(bboxJson) as [number, number, number, number]
    } catch {
      return
    }
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0)
      const [x, y, w, h] = bbox
      ctx.strokeStyle = '#22c55e'
      ctx.lineWidth = Math.max(2, Math.round(img.naturalWidth / 300))
      ctx.strokeRect(x, y, w, h)
    }
    img.src = imgUrl
  }, [imgUrl, bboxJson])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 flex items-center justify-center w-8 h-8 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-10"
        aria-label="Close"
      >
        <X size={16} />
      </button>
      <canvas
        ref={canvasRef}
        className="max-w-[90vw] max-h-[85vh] rounded-lg shadow-2xl object-contain"
        style={{ width: 'auto', height: 'auto', maxWidth: '90vw', maxHeight: '85vh' }}
        onClick={(e) => e.stopPropagation()}
      />
    </div>
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
