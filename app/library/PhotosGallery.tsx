'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { X, ZoomIn, Clock, ImageOff, Trash2 } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'
import { AreaBadge } from '@/components/Badge'

interface PhotoReport {
  id: string
  title: string
  area: string
  // rawContent is the vision/OCR description — shown instead of summary
  rawContent: string
  createdAt: Date
  storyName: string | null
}

interface Props {
  photos: PhotoReport[]
}

export default function PhotosGallery({ photos: initial }: Props) {
  const [photos, setPhotos] = useState(initial)
  const [lightbox, setLightbox] = useState<PhotoReport | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const close = useCallback(() => setLightbox(null), [])

  useEffect(() => {
    if (!lightbox) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [lightbox, close])

  const deletePhoto = async (id: string) => {
    setDeleting(id)
    setPhotos(p => p.filter(x => x.id !== id))
    if (lightbox?.id === id) close()
    await fetch(`/api/reports/${id}`, { method: 'DELETE' })
    setDeleting(null)
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <ImageOff size={24} className="text-gray-300 dark:text-zinc-600" />
        <p className="text-sm text-gray-400 dark:text-zinc-500">No images in this area yet.</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {photos.map(photo => (
          <div
            key={photo.id}
            className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl hover:border-gray-300 dark:hover:border-zinc-600 hover:shadow-sm transition-all flex gap-4 p-3 items-start group"
          >
            {/* Thumbnail */}
            <button
              onClick={() => setLightbox(photo)}
              className="shrink-0 relative rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500 transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/reports/${photo.id}/image`}
                alt={photo.title}
                className="w-52 h-36 object-cover block"
                onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <div className="absolute inset-0 bg-black/0 hover:bg-black/25 transition-colors flex items-center justify-center">
                <ZoomIn size={18} className="text-white opacity-0 hover:opacity-100 drop-shadow transition-opacity" />
              </div>
            </button>

            {/* Details */}
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-start justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <AreaBadge area={photo.area} />
                  <Link
                    href={`/reports/${photo.id}`}
                    className="text-sm font-semibold text-gray-900 dark:text-zinc-50 hover:underline truncate"
                  >
                    {photo.title}
                  </Link>
                </div>
                <button
                  onClick={() => deletePhoto(photo.id)}
                  disabled={deleting === photo.id}
                  title="Delete photo"
                  className="shrink-0 p-1 rounded text-gray-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-zinc-500 mb-2">
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {formatRelativeDate(photo.createdAt)}
                </span>
                {photo.storyName && (
                  <span className="text-indigo-500 dark:text-indigo-400 font-medium">{photo.storyName}</span>
                )}
              </div>

              {/* Show the vision/OCR description, not the report summary */}
              {photo.rawContent && !photo.rawContent.startsWith('[Image') && (
                <p className="text-sm text-gray-600 dark:text-zinc-300 line-clamp-4 leading-relaxed">
                  {photo.rawContent}
                </p>
              )}

              <Link
                href={`/reports/${photo.id}`}
                className="inline-block mt-2 text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors"
              >
                View full analysis →
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-6"
          onClick={close}
        >
          <div
            className="relative max-w-4xl w-full"
            onClick={e => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/reports/${lightbox.id}/image`}
              alt={lightbox.title}
              className="max-w-full max-h-[78vh] object-contain mx-auto rounded-xl block"
            />
            <div className="mt-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{lightbox.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-white/50">{lightbox.area}</span>
                  {lightbox.storyName && (
                    <span className="text-xs text-indigo-300">{lightbox.storyName}</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/reports/${lightbox.id}`} className="text-xs text-white/60 hover:text-white transition-colors">
                  View report →
                </Link>
                <button onClick={close} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
