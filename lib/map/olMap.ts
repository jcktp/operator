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

export async function initStoryMap(
  container: HTMLElement,
  pins: LocationPin[],
  onPinClick: (pin: LocationPin) => void
): Promise<() => void> {
  const { Map, View } = await import('ol')
  const { Tile: TileLayer, Vector: VectorLayer } = await import('ol/layer')
  const { OSM, Vector: VectorSource } = await import('ol/source')
  const { fromLonLat } = await import('ol/proj')
  const Feature = (await import('ol/Feature')).default
  const Point = (await import('ol/geom/Point')).default
  const { Style, Fill, Stroke, Circle: CircleStyle, Text: TextStyle } = await import('ol/style')

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

  const map = new Map({
    target: container,
    layers: [
      new TileLayer({ source: new OSM() }),
      vectorLayer,
    ],
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

  return () => map.setTarget(undefined)
}
