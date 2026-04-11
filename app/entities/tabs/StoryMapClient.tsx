'use client'

import 'maplibre-gl/dist/maplibre-gl.css'
import { useEffect, useRef, useState, useCallback } from 'react'
import { MapPin, Loader2, RotateCcw, Plus, Minus } from 'lucide-react'
import type { LocationPin, MapLayer } from '@/lib/map/mlMap'
import { useInspector } from '@/components/InspectorContext'

export interface RawLocation {
 name: string
 reportIds: string[]
 reportTitles: Record<string, string>
 reportAreas: Record<string, string>
 reportStoryNames: Record<string, string>
 reportSummaries: Record<string, string>
 contexts: string[]
 contextsByReport: Array<{ reportId: string; reportTitle: string; area: string; context: string }>
}

interface Props {
 locations: RawLocation[]
 storyNames: string[]
}

async function geocode(name: string): Promise<{ lat: number; lon: number } | null> {
 try {
 const res = await fetch(`/api/geocode?name=${encodeURIComponent(name)}`)
 if (!res.ok) return null
 const data = await res.json() as { result: { lat: number; lon: number } | null }
 return data.result ?? null
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
 const zoomInRef = useRef<(() => void) | null>(null)
 const zoomOutRef = useRef<(() => void) | null>(null)
 const geocodedKeyRef = useRef<string>('')

 const clearGeoCache = () => {
 try { localStorage.removeItem('geocode_cache_v1') } catch {}
 geocodedKeyRef.current = ''
 setAllPins([])
 setPins([])
 setFailedLocations([])
 setMapReady(false)
 }
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
 const result = await initStoryMap(mapRef.current, pinsToShow, pin => {
 const loc = locations.find(l => l.name === pin.name)
 setSelected({
 type: 'location',
 name: pin.name,
 reportIds: pin.reportIds,
 reportTitles: pin.reportTitles,
 reportSummaries: loc?.reportSummaries ?? {},
 contextsByReport: pin.contextsByReport,
 })
 }, layer, isDark)
 destroyRef.current = result.destroy
 zoomInRef.current = result.zoomIn
 zoomOutRef.current = result.zoomOut
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
 <div className="w-12 h-12 bg-[var(--surface-2)] rounded-[10px] flex items-center justify-center mb-4">
 <MapPin size={20} className="text-[var(--text-muted)]" />
 </div>
 <p className="text-sm text-[var(--text-subtle)]">No location entities yet.</p>
 <p className="text-xs text-[var(--text-muted)] mt-1 max-w-xs">
 Location entities are extracted automatically when documents are analysed.
 </p>
 </div>
 )
 }

 return (
 <div className="space-y-3">
 {storyNames.length > 0 && (
 <div className="flex flex-wrap gap-1 items-center">
 <span className="text-[10px] text-[var(--text-muted)] mr-1">Story:</span>
 <button
 onClick={() => setActiveStory(null)}
 className={`text-xs px-2.5 py-0.5 rounded-[4px] transition-colors ${
 activeStory === null
 ? 'bg-[var(--ink)] text-white'
 : 'bg-[var(--surface-2)] text-[var(--text-body)] hover:bg-[var(--surface-3)]'
 }`}
 >
 All
 </button>
 {storyNames.map(s => (
 <button
 key={s}
 onClick={() => setActiveStory(activeStory === s ? null : s)}
 className={`text-xs px-2.5 py-0.5 rounded-[4px] transition-colors ${
 activeStory === s
 ? 'bg-[var(--ink)] text-white'
 : 'bg-[var(--surface-2)] text-[var(--text-body)] hover:bg-[var(--surface-3)]'
 }`}
 >
 {s}
 </button>
 ))}
 </div>
 )}

 {geocoding && (
 <div className="flex items-center gap-2 text-xs text-[var(--text-subtle)]">
 <Loader2 size={12} className="animate-spin" />
 Geocoding locations… {geocodedCount}/{locations.length}
 <span className="text-[var(--text-muted)]">· Nominatim / OpenStreetMap</span>
 </div>
 )}
 {!geocoding && mapReady && pins.length === 0 && (
 <p className="text-xs text-[var(--text-muted)]">
 No locations could be geocoded — place names need to be recognisable geographic locations.
 </p>
 )}
 {!geocoding && mapReady && pins.length > 0 && (
 <div className="flex items-center justify-between gap-4">
 <p className="text-xs text-[var(--text-muted)]">
 {pins.length} of {locations.length} location{locations.length !== 1 ? 's' : ''} plotted · Click a pin for details
 </p>
 <div className="flex items-center gap-2">
 <button
 onClick={clearGeoCache}
 title="Clear location cache and re-geocode all pins"
 className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-body)] hover:border-[var(--border-mid)] bg-[var(--surface)] transition-colors"
 >
 <RotateCcw size={10} />
 Reset cache
 </button>
 <div className="flex gap-1">
 {(['osm', 'satellite', 'topo'] as const).map(l => (
 <button
 key={l}
 onClick={() => setActiveLayer(l)}
 className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
 activeLayer === l
 ? 'bg-[var(--ink)] text-white border-[var(--ink)]'
 : 'bg-[var(--surface)] text-[var(--text-subtle)] border-[var(--border)] hover:border-[var(--border-mid)]'
 }`}
 >
 {l === 'osm' ? 'Standard' : l === 'satellite' ? 'Satellite' : 'Topo'}
 </button>
 ))}
 </div>
 </div>
 </div>
 )}

 {!geocoding && failedLocations.length > 0 && (
 <div className="text-xs text-[var(--amber)] bg-[var(--amber-dim)] border border-[var(--amber)] border-opacity-30 rounded-[4px] px-3 py-2">
 <span className="font-medium">{failedLocations.length} unrecognised location{failedLocations.length !== 1 ? 's' : ''}:</span>{' '}
 {failedLocations.join(', ')}
 </div>
 )}

 <div className="flex-1 min-w-0 relative">
 {error && (
 <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-2)] rounded-[10px] z-10">
 <p className="text-sm text-[var(--red)] px-4 text-center">{error}</p>
 </div>
 )}
 {(!mapReady || geocoding) && !error && (
 <div className="absolute inset-0 flex items-center justify-center bg-[var(--surface-2)] rounded-[10px] z-10">
 <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
 <Loader2 size={13} className="animate-spin" />
 {geocoding ? `Geocoding ${geocodedCount}/${locations.length}…` : 'Loading map…'}
 </div>
 </div>
 )}
 <div
 ref={mapRef}
 style={{ height: 520 }}
 className="w-full rounded-[10px] border border-[var(--border)] overflow-hidden bg-[var(--surface-2)]"
 />
 {mapReady && pins.length > 0 && (
 <div className="absolute bottom-8 right-2 flex flex-col gap-0.5 z-10">
 <button
 onClick={() => zoomInRef.current?.()}
 title="Zoom in"
 className="w-7 h-7 flex items-center justify-center bg-[var(--surface)] border border-[var(--border)] rounded-t-md text-[var(--text-body)] hover:bg-[var(--surface-2)] shadow-sm transition-colors"
 >
 <Plus size={13} />
 </button>
 <button
 onClick={() => zoomOutRef.current?.()}
 title="Zoom out"
 className="w-7 h-7 flex items-center justify-center bg-[var(--surface)] border border-[var(--border)] rounded-b-md text-[var(--text-body)] hover:bg-[var(--surface-2)] shadow-sm transition-colors border-t-0"
 >
 <Minus size={13} />
 </button>
 </div>
 )}
 <p className="text-[10px] text-[var(--text-muted)] mt-1 text-right">
 Map © <a href="https://openfreemap.org"target="_blank"rel="noreferrer"className="underline">OpenFreeMap</a> / <a href="https://www.openstreetmap.org/copyright"target="_blank"rel="noreferrer"className="underline">OpenStreetMap</a> contributors · Geocoding by Nominatim
 </p>
 </div>
 </div>
 )
}
