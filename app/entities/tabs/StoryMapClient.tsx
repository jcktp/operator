'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { X, MapPin, Loader2 } from 'lucide-react'
import type { LocationPin } from '@/lib/map/olMap'

export interface RawLocation {
  name: string
  reportIds: string[]
  reportTitles: Record<string, string>
  reportAreas: Record<string, string>
  contexts: string[]
}

interface Props {
  locations: RawLocation[]
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
    // Nominatim rate limit: max 1 req/sec
    if (i < locations.length - 1) await new Promise(r => setTimeout(r, 1100))
  }
  return { pins, failed }
}

export default function StoryMapClient({ locations }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
  const destroyRef = useRef<(() => void) | null>(null)
  const [pins, setPins] = useState<LocationPin[]>([])
  const [failedLocations, setFailedLocations] = useState<string[]>([])
  const [geocoding, setGeocoding] = useState(false)
  const [geocodedCount, setGeocodedCount] = useState(0)
  const [mapReady, setMapReady] = useState(false)
  const [selectedPin, setSelectedPin] = useState<LocationPin | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeLayer, setActiveLayer] = useState<'osm' | 'satellite' | 'topo'>('osm')

  // Geocode all locations once
  useEffect(() => {
    if (locations.length === 0) return
    setGeocoding(true)
    setGeocodedCount(0)
    geocodeAll(locations, n => setGeocodedCount(n))
      .then(({ pins: p, failed }) => { setPins(p); setFailedLocations(failed); setGeocoding(false) })
      .catch(e => { setError(String(e)); setGeocoding(false) })
  }, [locations])

  // Init map once pins are ready, or re-init when layer changes
  const initMap = useCallback(async (pinsToShow: LocationPin[], layer: 'osm' | 'satellite' | 'topo') => {
    if (!mapRef.current || pinsToShow.length === 0) { setMapReady(true); return }
    destroyRef.current?.()
    const { initStoryMap } = await import('@/lib/map/olMap')
    const destroy = await initStoryMap(mapRef.current, pinsToShow, pin => setSelectedPin(pin), layer)
    destroyRef.current = destroy
    setMapReady(true)
  }, [])

  useEffect(() => {
    if (!geocoding && pins.length >= 0) {
      initMap(pins, activeLayer).catch(e => setError(String(e)))
    }
    return () => { destroyRef.current?.(); destroyRef.current = null }
  }, [geocoding, pins, activeLayer, initMap])

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
      {/* Status bar */}
      {geocoding && (
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400">
          <Loader2 size={12} className="animate-spin" />
          Geocoding locations… {geocodedCount}/{locations.length}
          <span className="text-gray-400 dark:text-zinc-500">· Uses OpenStreetMap Nominatim</span>
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
          {/* Layer switcher */}
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
      {/* Geocoding failures */}
      {!geocoding && failedLocations.length > 0 && (
        <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          <span className="font-medium">{failedLocations.length} location{failedLocations.length !== 1 ? 's' : ''} could not be placed:</span>{' '}
          {failedLocations.join(', ')}
        </div>
      )}

      <div className="flex gap-4 items-start">
        {/* Map */}
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
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/ol/ol.css" />
          <div
            ref={mapRef}
            style={{ height: 520 }}
            className="w-full rounded-xl border border-gray-200 dark:border-zinc-700 overflow-hidden bg-gray-100 dark:bg-zinc-800"
          />
          <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-1 text-right">
            Map © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a> contributors · Geocoding by Nominatim
          </p>
        </div>

        {/* Side panel */}
        {selectedPin ? (
          <aside className="w-64 shrink-0 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-zinc-50 flex items-center gap-1.5">
                  <MapPin size={12} className="text-indigo-500" />
                  {selectedPin.name}
                </p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                  {selectedPin.reportIds.length} document{selectedPin.reportIds.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={() => setSelectedPin(null)}
                className="p-1 text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 rounded"
              >
                <X size={13} />
              </button>
            </div>

            {selectedPin.contexts.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-1.5">Context</p>
                <div className="space-y-1.5">
                  {selectedPin.contexts.slice(0, 3).map((ctx, i) => (
                    <p key={i} className="text-xs text-gray-600 dark:text-zinc-300 italic leading-relaxed">
                      &ldquo;{ctx}&rdquo;
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-gray-400 dark:text-zinc-500 uppercase tracking-wide mb-1.5">Documents</p>
              <div className="space-y-1">
                {selectedPin.reportIds.map(id => (
                  <a
                    key={id}
                    href={`/reports/${id}`}
                    className="block text-xs text-gray-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline truncate"
                  >
                    {selectedPin.reportTitles[id] ?? id}
                  </a>
                ))}
              </div>
            </div>
          </aside>
        ) : (
          <aside className="w-64 shrink-0">
            <div className="space-y-1">
              {locations.slice(0, 15).map(loc => {
                const hasPin = pins.some(p => p.name === loc.name)
                return (
                  <button
                    key={loc.name}
                    onClick={() => {
                      const pin = pins.find(p => p.name === loc.name)
                      if (pin) setSelectedPin(pin)
                    }}
                    disabled={!hasPin}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${hasPin ? 'hover:bg-gray-50 dark:hover:bg-zinc-800' : 'opacity-50 cursor-not-allowed'}`}
                  >
                    <MapPin size={11} className={hasPin ? 'text-indigo-400 shrink-0' : 'text-gray-300 dark:text-zinc-600 shrink-0'} />
                    <span className="text-xs text-gray-700 dark:text-zinc-300 truncate flex-1">{loc.name}</span>
                    <span className="text-xs text-gray-400 dark:text-zinc-500 shrink-0">{loc.reportIds.length}</span>
                  </button>
                )
              })}
              {locations.length > 15 && (
                <p className="text-xs text-gray-400 dark:text-zinc-500 text-center pt-1">
                  +{locations.length - 15} more on map
                </p>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
