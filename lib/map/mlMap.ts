// MapLibre GL map factory — story map feature
// Only import inside 'use client' components or dynamic(() => …, { ssr: false }) boundaries.

import type { StyleSpecification } from 'maplibre-gl'
// MapLibre expression arrays are deeply recursive types — cast the whole style object
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyStyle = any

export interface LocationPin {
  name: string
  lon: number
  lat: number
  reportIds: string[]
  reportTitles: Record<string, string>
  reportAreas: Record<string, string>
  contexts: string[]
  contextsByReport: Array<{ reportId: string; reportTitle: string; area: string; context: string }>
}

export type MapLayer = 'osm' | 'satellite' | 'topo'

// ── Styles ────────────────────────────────────────────────────────────────────

const OFM_GLYPHS = 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'
const OFM_TILES  = 'https://tiles.openfreemap.org/planet'

// Light: OpenFreeMap Positron (CartoDB-style clean light)
const LIGHT_STYLE = 'https://tiles.openfreemap.org/styles/positron'

// Dark: custom style built on the same OpenFreeMap vector tiles
const DARK_STYLE: AnyStyle = {
  version: 8,
  name: 'Operator Dark',
  glyphs: OFM_GLYPHS,
  sources: {
    openmaptiles: { type: 'vector', url: OFM_TILES },
  },
  layers: [
    { id: 'background', type: 'background',
      paint: { 'background-color': '#18181b' } },

    { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water',
      paint: { 'fill-color': '#0f172a' } },

    { id: 'waterway', type: 'line', source: 'openmaptiles', 'source-layer': 'waterway',
      paint: { 'line-color': '#0f172a', 'line-width': 1 } },

    { id: 'landcover-green', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',
      filter: ['in', 'class', 'grass', 'wood', 'forest', 'scrub'],
      paint: { 'fill-color': '#1c2b1c', 'fill-opacity': 0.7 } },

    { id: 'landuse-park', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse',
      filter: ['in', 'class', 'park', 'national_park', 'protected_area', 'cemetery'],
      paint: { 'fill-color': '#1c2b1c', 'fill-opacity': 0.8 } },

    { id: 'building', type: 'fill', source: 'openmaptiles', 'source-layer': 'building',
      minzoom: 13,
      paint: { 'fill-color': '#27272a', 'fill-opacity': 0.7 } },

    { id: 'road-service', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      filter: ['in', 'class', 'service', 'track', 'path', 'footway'],
      minzoom: 14,
      paint: { 'line-color': '#2a2a2e', 'line-width': 1 } },

    { id: 'road-minor', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      filter: ['in', 'class', 'minor', 'residential'],
      minzoom: 12,
      paint: { 'line-color': '#2d2d32',
               'line-width': ['interpolate', ['linear'], ['zoom'], 12, 1, 16, 3] } },

    { id: 'road-secondary', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      filter: ['in', 'class', 'secondary', 'tertiary'],
      paint: { 'line-color': '#3a3a40',
               'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 3] } },

    { id: 'road-primary', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      filter: ['in', 'class', 'primary', 'trunk'],
      paint: { 'line-color': '#4a4a52',
               'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.5, 14, 5] } },

    { id: 'road-motorway', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
      filter: ['==', 'class', 'motorway'],
      paint: { 'line-color': '#52525b',
               'line-width': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 14, 7] } },

    { id: 'boundary-country', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary',
      filter: ['all', ['==', 'admin_level', 2], ['!has', 'disputed']],
      paint: { 'line-color': '#3f3f46',
               'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.5, 10, 1.5] } },

    { id: 'boundary-state', type: 'line', source: 'openmaptiles', 'source-layer': 'boundary',
      filter: ['==', 'admin_level', 4],
      minzoom: 4,
      paint: { 'line-color': '#2d2d30', 'line-width': 0.75, 'line-dasharray': [3, 2] } },

    { id: 'place-country', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
      filter: ['==', 'class', 'country'],
      layout: {
        'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 1, 10, 6, 14],
        'text-max-width': 6,
        'text-transform': 'uppercase',
        'text-letter-spacing': 0.1,
      },
      paint: { 'text-color': '#71717a', 'text-halo-color': '#18181b', 'text-halo-width': 1.5 } },

    { id: 'place-state', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
      filter: ['==', 'class', 'state'],
      minzoom: 4, maxzoom: 8,
      layout: {
        'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 4, 9, 8, 12],
        'text-max-width': 8,
      },
      paint: { 'text-color': '#52525b', 'text-halo-color': '#18181b', 'text-halo-width': 1 } },

    { id: 'place-city', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
      filter: ['in', 'class', 'city', 'town'],
      minzoom: 3,
      layout: {
        'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 10, 15],
        'text-max-width': 8,
      },
      paint: { 'text-color': '#a1a1aa', 'text-halo-color': '#18181b', 'text-halo-width': 1.5 } },

    { id: 'place-small', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place',
      filter: ['in', 'class', 'village', 'suburb', 'hamlet', 'quarter', 'neighbourhood'],
      minzoom: 9,
      layout: {
        'text-field': ['coalesce', ['get', 'name_en'], ['get', 'name']],
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-max-width': 8,
      },
      paint: { 'text-color': '#52525b', 'text-halo-color': '#18181b', 'text-halo-width': 1 } },
  ],
}

// Satellite — Esri World Imagery raster
const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Tiles © Esri',
    },
  },
  layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }],
}

// Topo — OpenTopoMap raster
const TOPO_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    topo: {
      type: 'raster',
      tiles: [
        'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
        'https://c.tile.opentopomap.org/{z}/{x}/{y}.png',
      ],
      tileSize: 256,
      attribution: '© OpenTopoMap contributors',
      maxzoom: 17,
    },
  },
  layers: [{ id: 'topo', type: 'raster', source: 'topo' }],
}

function getStyle(layer: MapLayer, dark: boolean): AnyStyle {
  if (layer === 'satellite') return SATELLITE_STYLE
  if (layer === 'topo')      return TOPO_STYLE
  return dark ? DARK_STYLE : LIGHT_STYLE
}

// ── Map init ─────────────────────────────────────────────────────────────────

export async function initStoryMap(
  container: HTMLElement,
  pins: LocationPin[],
  onPinClick: (pin: LocationPin) => void,
  layer: MapLayer = 'osm',
  dark = false,
): Promise<{ destroy: () => void }> {
  const maplibregl = (await import('maplibre-gl')).default

  const map = new maplibregl.Map({
    container,
    style: getStyle(layer, dark),
    center: [0, 20],
    zoom: 2,
    attributionControl: { compact: true },
  })

  const addPins = () => {
    if (map.getSource('pins')) return

    map.addSource('pins', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: pins.map(pin => ({
          type: 'Feature' as const,
          geometry: { type: 'Point' as const, coordinates: [pin.lon, pin.lat] },
          properties: { count: pin.reportIds.length, pin: JSON.stringify(pin) },
        })),
      },
    })

    map.addLayer({
      id: 'pins-circle',
      type: 'circle',
      source: 'pins',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['get', 'count'], 1, 8, 10, 18] ,
        'circle-color': 'rgba(99,102,241,0.85)',
        'circle-stroke-color': '#fff',
        'circle-stroke-width': 2,
      },
    })

    map.addLayer({
      id: 'pins-label',
      type: 'symbol',
      source: 'pins',
      filter: ['>', ['get', 'count'], 1],
      layout: {
        'text-field': ['to-string', ['get', 'count']],
        'text-font': ['Noto Sans Bold', 'Noto Sans Regular'],
        'text-size': 10,
        'text-allow-overlap': true,
        'text-ignore-placement': true,
      },
      paint: { 'text-color': '#fff' },
    })

    // Fit to pins
    if (pins.length > 0) {
      const bounds = new maplibregl.LngLatBounds()
      pins.forEach(p => bounds.extend([p.lon, p.lat]))
      map.fitBounds(bounds, { padding: 60, maxZoom: 8, duration: 0 })
    }
  }

  map.once('load', addPins)

  // Click
  map.on('click', 'pins-circle', e => {
    const f = e.features?.[0]
    if (!f) return
    try { onPinClick(JSON.parse(f.properties.pin) as LocationPin) } catch { /* ignore */ }
  })

  // Cursor
  map.on('mouseenter', 'pins-circle', () => { map.getCanvas().style.cursor = 'pointer' })
  map.on('mouseleave', 'pins-circle', () => { map.getCanvas().style.cursor = '' })

  return { destroy: () => map.remove() }
}
