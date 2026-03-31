// OpenLayers map factory helpers — story map feature
// All imports are dynamic/lazy; this file must only be imported inside
// a 'use client' component or dynamic(() => ..., { ssr: false }) boundary.

export interface LocationPin {
  name: string
  lon: number
  lat: number
  reportIds: string[]
  reportTitles: Record<string, string>
  reportAreas: Record<string, string>
  contexts: string[]
}

type MapLayer = 'osm' | 'satellite' | 'topo'

export type DrawMode = 'Point' | 'LineString' | 'Polygon'

export interface DrawLayerHandle {
  setMode: (mode: DrawMode | null) => void
  clear: () => void
  destroy: () => void
}

export async function initStoryMap(
  container: HTMLElement,
  pins: LocationPin[],
  onPinClick: (pin: LocationPin) => void,
  layer: MapLayer = 'osm'
): Promise<{ destroy: () => void; drawLayer: DrawLayerHandle }> {
  const { Map, View } = await import('ol')
  const { Tile: TileLayer, Vector: VectorLayer } = await import('ol/layer')
  const { OSM, XYZ, Vector: VectorSource } = await import('ol/source')
  const { fromLonLat } = await import('ol/proj')
  const Feature = (await import('ol/Feature')).default
  const Point = (await import('ol/geom/Point')).default
  const { Style, Fill, Stroke, Circle: CircleStyle, Text: TextStyle } = await import('ol/style')
  const { Draw } = await import('ol/interaction')

  // Build features
  const features = pins.map(pin => {
    const f = new Feature({ geometry: new Point(fromLonLat([pin.lon, pin.lat])) })
    f.set('pin', pin)
    return f
  })

  const vectorSource = new VectorSource({ features })

  const vectorLayer = new VectorLayer({
    source: vectorSource,
    style: (feature) => {
      const pin = feature.get('pin') as LocationPin
      const count = pin.reportIds.length
      return new Style({
        image: new CircleStyle({
          radius: Math.min(6 + count * 2, 18),
          fill: new Fill({ color: 'rgba(99, 102, 241, 0.85)' }),
          stroke: new Stroke({ color: '#fff', width: 2 }),
        }),
        text: count > 1 ? new TextStyle({
          text: String(count),
          fill: new Fill({ color: '#fff' }),
          font: 'bold 10px sans-serif',
          offsetY: 1,
        }) : undefined,
      })
    },
  })

  // Base tile layer — OSM, Esri satellite, or OpenTopoMap
  let tileLayer: InstanceType<typeof TileLayer>
  if (layer === 'satellite') {
    tileLayer = new TileLayer({
      source: new XYZ({
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attributions: 'Tiles © Esri — Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
        maxZoom: 19,
      }),
    })
  } else if (layer === 'topo') {
    tileLayer = new TileLayer({
      source: new XYZ({
        url: 'https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png',
        attributions: 'Map data: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: © <a href="https://opentopomap.org">OpenTopoMap</a>',
        maxZoom: 17,
      }),
    })
  } else {
    tileLayer = new TileLayer({ source: new OSM() })
  }

  const map = new Map({
    target: container,
    layers: [tileLayer, vectorLayer],
    view: new View({
      center: fromLonLat([0, 20]),
      zoom: 2,
    }),
  })

  // Fit to pins if any exist
  if (features.length > 0) {
    const extent = vectorSource.getExtent()
    if (extent) {
      map.getView().fit(extent, { padding: [60, 60, 60, 60], maxZoom: 8, duration: 0 })
    }
  }

  // Hover cursor
  map.on('pointermove', (e) => {
    const hit = map.hasFeatureAtPixel(e.pixel)
    map.getTargetElement().style.cursor = hit ? 'pointer' : ''
  })

  // Click handler
  map.on('click', (e) => {
    const feature = map.forEachFeatureAtPixel(e.pixel, f => f)
    if (feature) {
      const pin = feature.get('pin') as LocationPin
      if (pin) onPinClick(pin)
    }
  })

  // Draw layer (in-memory, not persisted)
  const drawSource = new VectorSource({ wrapX: false })
  const drawLayer = new VectorLayer({
    source: drawSource,
    style: new Style({
      fill: new Fill({ color: 'rgba(249, 115, 22, 0.15)' }),
      stroke: new Stroke({ color: 'rgba(249, 115, 22, 0.9)', width: 2.5 }),
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({ color: 'rgba(249, 115, 22, 0.85)' }),
        stroke: new Stroke({ color: '#fff', width: 1.5 }),
      }),
    }),
    zIndex: 10,
  })
  map.addLayer(drawLayer)

  let activeDrawInteraction: InstanceType<typeof Draw> | null = null
  const removeDrawInteraction = () => {
    if (activeDrawInteraction) { map.removeInteraction(activeDrawInteraction); activeDrawInteraction = null }
    // Reset cursor
    map.getTargetElement().style.cursor = ''
  }

  const drawLayerHandle: DrawLayerHandle = {
    setMode(mode: DrawMode | null) {
      removeDrawInteraction()
      if (!mode) return
      const draw = new Draw({ source: drawSource, type: mode })
      map.addInteraction(draw)
      activeDrawInteraction = draw
      map.getTargetElement().style.cursor = 'crosshair'
    },
    clear() { drawSource.clear() },
    destroy() { removeDrawInteraction(); map.removeLayer(drawLayer) },
  }

  return {
    destroy: () => { drawLayerHandle.destroy(); map.setTarget(undefined) },
    drawLayer: drawLayerHandle,
  }
}

