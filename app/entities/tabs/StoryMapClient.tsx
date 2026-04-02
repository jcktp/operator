'use client'

import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState, useCallback } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import type { LocationPin, MapLayer } from '@/lib/map/mlMap'
import { useInspector } from '@/components/InspectorContext'

export interface RawLocation {
  name: string
  reportIds: string[]
  reportTitles: Record<string, string>
  reportAreas: Record<string, string>
  reportStoryNames: Record<string, string>
  contexts: string[]
  contextsByReport: Array<{ reportId: string; reportTitle: string; area: string; context: string }>
}

interface Props {
  locations: RawLocation[]
  storyNames: string[]
}

async function geocode(name: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1`
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
    if (!res.ok) return null
    const data = await res.json() as Array<{ lat: string; lon: string }>
    if (!data.length) return null
    return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
  } catch {
    return null
  }
}

async function geocodeAll(
  locations: RawLocation[],
  onProgress: (done: number) => void
): Promise<{ pins: LocationPin[]; failed: string[] }> {
  const pins: LocationPin[] = []
  const failed: string[] = []
  for (let i = 0; i < locations.length; i++) {
    const loc = locations[i]
    const coords = await geocode(loc.name)
    if (coords) {
      pins.push({ ...loc, lon: coords.lon, lat: coords.lat })
    } else {
      failed.push(loc.name)
    }
    onProgress(i + 1)
    if (i < locations.length - 1) await new Promise(r => setTimeout(r, 1100))
  }
  return { pins, failed }
}

function readCache(): Record<string, { lat: number; lon: number }> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem('geocode_cache_v1') ?? '{}') } catch { return {} }
}
function writeCache(cache: Record<string, { lat: number; lon: number }>) {
  try { localStorage.setItem('geocode_cache_v1', JSON.stringify(cache)) } catch {}
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

export default function StoryMapClient({ locations, storyNames }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const destroyRef = useRef<(() => void) | null>(null)
  const geocodedKeyRef = useRef<string>('')
  const [allPins, setAllPins] = useState<LocationPin[]>([])
  const [pins, setPins] = useState<LocationPin[]>([])
  const [failedLocations, setFailedLocations] = useState<string[]>([])
  const [geocoding, setGeocoding] = useState(false)
  const [geocodedCount, setGeocodedCount] = useState(0)
  const [mapReady, setMapReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeLayer, setActiveLayer] = useState<MapLayer>('osm')
  const [activeStory, setActiveStory] = useState<string | null>(null)
  const { setSelected } = useInspector()
  const dark = useDarkMode()

  useEffect(() => {
    if (locations.length === 0) return
    const key = locations.map(l => l.name).sort().join('|')
    if (key === geocodedKeyRef.current) return
    geocodedKeyRef.current = key

    const cache = readCache()
    const uncached = locations.filter(l => !(l.name in cache))

    const buildPins = (coordMap: Record<string, { lat: number; lon: number }>) =>
      locations
        .filter(l => l.name in coordMap)
        .map(l => ({ ...l, ...coordMap[l.name] }))

    if (uncached.length === 0) {
      const p = buildPins(cache)
      setAllPins(p)
      setPins(p)
      setFailedLocations(locations.filter(l => !(l.name in cache)).map(l => l.name))
      return
    }

    setGeocoding(true)
    setGeocodedCount(0)
    geocodeAll(uncached, n => setGeocodedCount(n))
      .then(({ pins: newPins, failed }) => {
        const updatedCache = { ...cache }
        for (const pin of newPins) updatedCache[pin.name] = { lat: pin.lat, lon: pin.lon }
        writeCache(updatedCache)
        const p = buildPins(updatedCache)
        setAllPins(p)
        setPins(p)
        setFailedLocations([
          ...locations.filter(l => !(l.name in updatedCache)).map(l => l.name),
          ...failed,
        ])
        setGeocoding(false)
      })
      .catch(e => { setError(String(e)); setGeocoding(false) })
  }, [locations])

  useEffect(() => {
    if (!activeStory) { setPins(allPins); return }
    setPins(allPins.filter(p => {
      const loc = locations.find(l => l.name === p.name)
      return loc ? Object.values(loc.reportStoryNames).includes(activeStory) : false
    }))
  }, [activeStory, allPins, locations])

  const initMap = useCallback(async (pinsToShow: LocationPin[], layer: MapLayer, isDark: boolean) => {
    if (!mapRef.current || pinsToShow.length === 0) { setMapReady(true); return }
    destroyRef.current?.()
    const { initStoryMap } = await import('@/lib/map/mlMap')
    const result = await initStoryMap(mapRef.current, pinsToShow, pin => setSelected({
      type: 'location',
      name: pin.name,
      reportIds: pin.reportIds,
      reportTitles: pin.reportTitles,
      contextsByReport: pin.contextsByReport,
    }), layer, isDark)
    destroyRef.current = result.destroy
    setMapReady(true)
  }, [setSelected])

  useEffect(() => {
    if (!geocoding) {
      initMap(pins, activeLayer, dark).catch(e => setError(String(e)))
    }
    return () => { destroyRef.current?.(); destroyRef.current = null }
  }, [geocoding, pins, activeLayer, dark, initMap])

  if (locations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-12 h-12 bg-gray-100 dark:bg-zinc-800 rounded-xl flex items-center justify-center mb-4">
          <MapPin size={20} className="text-gray-400 dark:text-zinc-500" />
        </div>
        <p className="text-sm text-gray-500 dark:text-zinc-400">No location entities yet.</p>
        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1 max-w-xs">
          Location entities are extracted automatically when documents are analysed.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {storyNames.length > 0 && (
        <div className="flex flex-wrap gap-1 items-center">
          <span className="text-[10px] text-gray-400 dark:text-zinc-500 mr-1">Story:</span>
          <button
            onClick={() => setActiveStory(null)}
            className={`text-xs px-2.5 py-0.5 rounded-full transition-colors ${
              activeStory === null
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
            }`}
          >
            All
          </button>
          {storyNames.map(s => (
            <button
              key={s}
              onClick={() => setActiveStory(activeStory === s ? null : s)}
              className={`text-xs px-2.5 py-0.5 rounded-full transition-colors ${
                activeStory === s
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {geocoding && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400">
          <Loader2 size={12} className="animate-spin" />
          Geocoding locations… {geocodedCount}/{locations.length}
          <span className="text-gray-400 dark:text-zinc-500">· Nominatim / OpenStreetMap</span>
        </div>
      )}
      {!geocoding && mapReady && pins.length === 0 && (
        <p className="text-xs text-gray-400 dark:text-zinc-500">
          No locations could be geocoded — place names need to be recognisable geographic locations.
        </p>
      )}
      {!geocoding && mapReady && pins.length > 0 && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-gray-400 dark:text-zinc-500">
            {pins.length} of {locations.length} location{locations.length !== 1 ? 's' : ''} plotted · Click a pin for details
          </p>
          <div className="flex gap-1">
            {(['osm', 'satellite', 'topo'] as const).map(l => (
              <button
                key={l}
                onClick={() => setActiveLayer(l)}
                className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                  activeLayer === l
                    ? 'bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-gray-900 dark:border-zinc-100'
                    : 'bg-white dark:bg-zinc-900 text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500'
                }`}
              >
                {l === 'osm' ? 'Standard' : l === 'satellite' ? 'Satellite' : 'Topo'}
              </button>
            ))}
          </div>
        </div>
      )}

      {!geocoding && failedLocations.length > 0 && (
        <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          <span className="font-medium">{failedLocations.length} location{failedLocations.length !== 1 ? 's' : ''} could not be placed:</span>{' '}
          {failedLocations.join(', ')}
        </div>
      )}

      <div className="flex-1 min-w-0 relative">
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-zinc-800 rounded-xl z-10">
            <p className="text-sm text-red-500 px-4 text-center">{error}</p>
          </div>
        )}
        {(!mapReady || geocoding) && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 dark:bg-zinc-800 rounded-xl z-10">
            <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-zinc-500">
              <Loader2 size={13} className="animate-spin" />
              {geocoding ? `Geocoding ${geocodedCount}/${locations.length}…` : 'Loading map…'}
            </div>
          </div>
        )}
        <div
          ref={mapRef}
          style={{ height: 520 }}
          className="w-full rounded-xl border border-gray-200 dark:border-zinc-700 overflow-hidden bg-gray-100 dark:bg-zinc-800"
        />
        <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1 text-right">
          Map © <a href="https://openfreemap.org" target="_blank" rel="noreferrer" className="underline">OpenFreeMap</a> / <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a> contributors · Geocoding by Nominatim
        </p>
      </div>
    </div>
  )
}
