'use client'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, MapPin, Camera, Plus, Minus } from 'lucide-react'
import { EmptyState } from '@/components/ui'
import SelectField from '@/components/SelectField'
import type { MapLayer } from '@/lib/map/mlMap'
import type { ImagePoint } from '@/app/api/map/points/route'

interface Project {
  id: string
  name: string
}

interface Props {
  projects: Project[]
}

function useDarkMode(): boolean {
  const [dark, setDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  )
  useEffect(() => {
    const obs = new MutationObserver(() =>
      setDark(document.documentElement.classList.contains('dark'))
    )
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return dark
}

export default function MapPageClient({ projects }: Props) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [points, setPoints] = useState<ImagePoint[] | null>(null)
  const [totalImages, setTotalImages] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [activeLayer, setActiveLayer] = useState<MapLayer>('osm')
  const [selected, setSelected] = useState<ImagePoint | null>(null)
  const [mapReady, setMapReady] = useState(false)

  const mapRef = useRef<HTMLDivElement>(null)
  const destroyRef = useRef<(() => void) | null>(null)
  const zoomInRef = useRef<(() => void) | null>(null)
  const zoomOutRef = useRef<(() => void) | null>(null)
  const dark = useDarkMode()

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    setPoints(null)
    setError(null)
    setSelected(null)
    setMapReady(false)
    fetch(`/api/map/points?projectId=${projectId}`)
      .then(r => r.json())
      .then((d: { points?: ImagePoint[]; totalImages?: number; error?: string }) => {
        if (d.error) { setError(d.error); return }
        setPoints(d.points ?? [])
        setTotalImages(d.totalImages ?? 0)
      })
      .catch(() => setError('Could not load map data'))
      .finally(() => setLoading(false))
  }, [projectId])

  const initMap = useCallback(async (pts: ImagePoint[], layer: MapLayer, isDark: boolean) => {
    if (!mapRef.current || pts.length === 0) { setMapReady(true); return }
    destroyRef.current?.()
    destroyRef.current = null

    const { initStoryMap } = await import('@/lib/map/mlMap')
    const pins = pts.map(p => ({
      name: p.title,
      lon: p.lon,
      lat: p.lat,
      reportIds: [p.reportId],
      reportTitles: { [p.reportId]: p.title },
      reportAreas: { [p.reportId]: p.area },
      contexts: [],
      contextsByReport: [],
    }))
    const result = await initStoryMap(mapRef.current, pins, (pin) => {
      const pt = pts.find(p => p.reportId === pin.reportIds[0])
      if (pt) setSelected(pt)
    }, layer, isDark)
    destroyRef.current = result.destroy
    zoomInRef.current = result.zoomIn
    zoomOutRef.current = result.zoomOut
    setMapReady(true)
  }, [])

  useEffect(() => {
    if (points === null) return
    initMap(points, activeLayer, dark).catch(e => setError(String(e)))
    return () => { destroyRef.current?.(); destroyRef.current = null }
  }, [points, activeLayer, dark, initMap])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-bright)]">Photo Map</h1>
          <p className="text-sm text-[var(--text-subtle)] mt-0.5">
            Images with GPS EXIF data plotted on a map.
          </p>
        </div>
        <SelectField
          value={projectId}
          onChange={setProjectId}
          options={projects.map(p => ({ value: p.id, label: p.name }))}
          placeholder="Select story…"
          className="w-48"
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-[var(--text-subtle)]">
          <Loader2 size={13} className="animate-spin" /> Reading EXIF data…
        </div>
      )}
      {error && <p className="text-xs text-[var(--red)]">{error}</p>}

      {!loading && points !== null && points.length === 0 && (
        <EmptyState
          icon={<MapPin size={20} />}
          title="No geotagged images"
          description={
            totalImages > 0
              ? `${totalImages} image${totalImages !== 1 ? 's' : ''} found but none have GPS coordinates embedded. Enable location on your camera or phone to capture GPS metadata.`
              : "Upload photos with GPS metadata to plot them here."
          }
          size="md"
        />
      )}

      {points !== null && points.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-4">
            <p className="text-xs text-[var(--text-muted)] flex items-center gap-1.5">
              <Camera size={12} />
              {points.length} geotagged image{points.length !== 1 ? 's' : ''} · Click a pin for details
            </p>
            <div className="flex gap-1">
              {(['osm', 'satellite', 'topo'] as const).map(l => (
                <button
                  key={l}
                  onClick={() => setActiveLayer(l)}
                  className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                    activeLayer === l
                      ? 'bg-[var(--ink)] text-[var(--ink-contrast)] border-[var(--ink)]'
                      : 'bg-[var(--surface)] text-[var(--text-subtle)] border-[var(--border)] hover:border-[var(--border-mid)]'
                  }`}
                >
                  {l === 'osm' ? 'Standard' : l === 'satellite' ? 'Satellite' : 'Topo'}
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            {!mapReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-2)] rounded-[10px] z-10">
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                  <Loader2 size={13} className="animate-spin" /> Loading map…
                </div>
              </div>
            )}
            <div
              ref={mapRef}
              style={{ height: 480 }}
              className="w-full rounded-[10px] border border-[var(--border)] overflow-hidden bg-[var(--surface-2)]"
            />
            {mapReady && points.length > 0 && (
              <div className="absolute bottom-8 right-2 flex flex-col gap-0.5 z-10">
                <button
                  onClick={() => zoomInRef.current?.()}
                  className="w-7 h-7 flex items-center justify-center bg-[var(--surface)] border border-[var(--border)] rounded-t-md text-[var(--text-body)] hover:bg-[var(--surface-2)] shadow-sm transition-colors"
                >
                  <Plus size={13} />
                </button>
                <button
                  onClick={() => zoomOutRef.current?.()}
                  className="w-7 h-7 flex items-center justify-center bg-[var(--surface)] border border-[var(--border)] rounded-b-md text-[var(--text-body)] hover:bg-[var(--surface-2)] shadow-sm transition-colors border-t-0"
                >
                  <Minus size={13} />
                </button>
              </div>
            )}
            <p className="text-[10px] text-[var(--text-muted)] mt-1 text-right">
              Map © <a href="https://openfreemap.org" target="_blank" rel="noreferrer" className="underline">OpenFreeMap</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a> contributors
            </p>
          </div>

          {selected && (
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-2)] overflow-hidden">
              {/* Photo thumbnail */}
              <div className="relative bg-[var(--surface-3)] h-40 overflow-hidden">
                <img
                  src={`/api/files/download?path=${encodeURIComponent(selected.imagePath)}`}
                  alt={selected.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/50 text-white text-[13px] leading-none flex items-center justify-center hover:bg-black/70 transition-colors"
                >×</button>
              </div>
              <div className="p-2.5 space-y-0.5">
                <p className="text-xs font-medium text-[var(--text-bright)] truncate">{selected.title}</p>
                <p className="text-[11px] font-mono text-[var(--text-muted)]">
                  {selected.lat.toFixed(5)}, {selected.lon.toFixed(5)}
                </p>
                {selected.camera && <p className="text-[11px] text-[var(--text-subtle)]">{selected.camera}</p>}
                {selected.dateTaken && (
                  <p className="text-[11px] text-[var(--text-muted)]">{new Date(selected.dateTaken).toLocaleDateString()}</p>
                )}
                <p className="text-[11px] text-[var(--text-muted)]">{selected.area}</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
