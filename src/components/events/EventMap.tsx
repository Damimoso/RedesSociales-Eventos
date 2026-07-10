import { useRef, useEffect, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { NearbyEvent } from '@/hooks/useEvents'
import { MAP_TILE_STYLE } from '@/lib/constants'

type Props = {
  events: NearbyEvent[]
  center: { lat: number; lng: number }
  onEventClick?: (id: string) => void
}

function createPinCanvas(color: string): HTMLCanvasElement {
  const size = 36
  const c = document.createElement('canvas')
  c.width = size
  c.height = size
  const ctx = c.getContext('2d')!
  const cx = size / 2
  const cy = size / 2 - 2

  ctx.beginPath()
  ctx.moveTo(cx, size - 2)
  ctx.bezierCurveTo(cx - 10, cy + 8, 2, cy - 2, 2, cy - 8)
  ctx.bezierCurveTo(2, cy - 18, cx - 6, cy - 18, cx, cy - 18)
  ctx.bezierCurveTo(cx + 6, cy - 18, cx + 14, cy - 18, cx + 14, cy - 8)
  ctx.bezierCurveTo(cx + 14, cy - 2, cx + 10, cy + 8, cx, size - 2)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = '#fff'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(cx, cy - 9, 5, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()

  return c
}

export function EventMap({ events, center, onEventClick }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const popupRef = useRef<maplibregl.Popup | null>(null)
  const [ready, setReady] = useState(false)
  const onEventClickRef = useRef(onEventClick)
  onEventClickRef.current = onEventClick

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_TILE_STYLE,
      center: [center.lng, center.lat],
      zoom: 11,
      attributionControl: false,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

    map.on('load', () => {
      map.resize()
      setReady(true)
    })
    map.on('error', (e) => console.warn('MapLibre error:', e.error?.message))

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null; setReady(false) }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !ready) return

    // Limpiar capas anteriores
    for (const id of ['clusters', 'cluster-count', 'event-pin', 'event-label']) {
      if (map.getLayer(id)) map.removeLayer(id)
    }
    if (map.getSource('events')) map.removeSource('events')
    if (map.hasImage('pin-free')) map.removeImage('pin-free')
    if (map.hasImage('pin-paid')) map.removeImage('pin-paid')
    popupRef.current?.remove()
    popupRef.current = null

    const valid = events.filter(e => typeof e.lat === 'number' && typeof e.lng === 'number')
    if (valid.length === 0) return

    // Crear imágenes de pines
    const addPinImg = async (id: string, color: string) => {
      const img = await createImageBitmap(createPinCanvas(color))
      if (!map.hasImage(id)) map.addImage(id, img)
    }
    addPinImg('pin-free', '#34D399')
    addPinImg('pin-paid', '#7C5CFC')

    const features = valid.map(e => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [e.lng, e.lat] },
      properties: {
        id: e.id, title: e.title, city: e.city,
        start_date: e.start_date, is_free: e.is_free,
        price: e.price ?? 0, organizer_name: e.organizer_name,
      },
    }))

    map.addSource('events', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features },
      cluster: true,
      clusterMaxZoom: 14,
      clusterRadius: 50,
    })

    // Círculos de cluster
    map.addLayer({
      id: 'clusters', type: 'circle', source: 'events',
      filter: ['has', 'point_count'],
      paint: {
        'circle-color': ['step', ['get', 'point_count'],
          '#7C5CFC', 5, '#FF6B9D', 15, '#EF4444'],
        'circle-radius': ['step', ['get', 'point_count'], 18, 5, 26, 15, 34],
        'circle-opacity': 0.85,
        'circle-stroke-width': 3,
        'circle-stroke-color': '#fff',
      },
    })

    // Número dentro del cluster
    map.addLayer({
      id: 'cluster-count', type: 'symbol', source: 'events',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-size': 13,
      },
      paint: { 'text-color': '#fff' },
    })

    // Pin individual
    map.addLayer({
      id: 'event-pin', type: 'symbol', source: 'events',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': ['case', ['get', 'is_free'], 'pin-free', 'pin-paid'],
        'icon-size': 1,
        'icon-anchor': 'bottom',
        'icon-offset': [0, 0],
      },
    })

    // Etiqueta debajo del pin
    map.addLayer({
      id: 'event-label', type: 'symbol', source: 'events',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'text-field': '{title}',
        'text-offset': [0, 2.5],
        'text-anchor': 'top',
        'text-size': 10,
        'text-max-width': 8,
      },
      paint: {
        'text-color': '#1F2937',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1.5,
      },
    })

    // Click en cluster → zoom in
    map.on('click', 'clusters', (e) => {
      const feature = e.features?.[0]
      if (!feature) return
      const geom = feature.geometry as GeoJSON.Point
      map.flyTo({ center: geom.coordinates as [number, number], zoom: map.getZoom() + 2 })
    })

    // Click en pin individual → popup + navegar
    const onPinClick = (e: maplibregl.MapMouseEvent & { features?: GeoJSON.Feature[] }) => {
      const feature = e.features?.[0]
      if (!feature) return
      const props = feature.properties
      if (!props) return
      popupRef.current?.remove()
      const d = new Date(props.start_date).toLocaleDateString('es-ES', {
        day: 'numeric', month: 'long', year: 'numeric',
      })
      const geom = feature.geometry as GeoJSON.Point
      const coords: [number, number] = [geom.coordinates[0], geom.coordinates[1]]
      popupRef.current = new maplibregl.Popup({ offset: [0, -36], closeButton: true, maxWidth: '240px' })
        .setLngLat(coords)
        .setHTML(`
          <div style="font-family: system-ui, sans-serif; cursor: pointer; min-width: 160px;"
               onclick="(function(){ window.__mapEventId = '${props.id}'; })()">
            <strong style="font-size: 13px; color: #111827;">${props.title}</strong>
            <div style="font-size: 11px; color: #6B7280; margin-top: 4px;">
              📍 ${props.city}
            </div>
            <div style="font-size: 11px; color: #6B7280;">
              📅 ${d}
            </div>
            <div style="font-size: 11px; color: #6B7280; margin-top: 2px;">
              ${props.organizer_name}
            </div>
            <div style="font-size: 11px; font-weight: 600; color: ${props.is_free ? '#10B981' : '#7C5CFC'}; margin-top: 4px;">
              ${props.is_free ? 'Gratuito' : 'Desde ' + (props.price / 100).toFixed(2) + ' €'}
            </div>
          </div>
        `)
        .addTo(map)

      // Click en el popup → navegar al evento
      const popupEl = popupRef.current.getElement()
      const handler = () => {
        if (onEventClickRef.current) onEventClickRef.current(props.id)
      }
      popupEl?.querySelector('div')?.addEventListener('click', handler)
      popupRef.current.on('close', () => { popupRef.current = null })
    }

    map.on('click', 'event-pin', onPinClick)
    map.on('click', 'event-label', onPinClick)

    // Hover cursor
    map.on('mouseenter', 'event-pin', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'event-pin', () => { map.getCanvas().style.cursor = '' })
    map.on('mouseenter', 'clusters', () => { map.getCanvas().style.cursor = 'pointer' })
    map.on('mouseleave', 'clusters', () => { map.getCanvas().style.cursor = '' })

    // Fit bounds
    const bounds = new maplibregl.LngLatBounds()
    features.forEach(f => bounds.extend(f.geometry.coordinates as [number, number]))
    map.fitBounds(bounds, { padding: 80, maxZoom: 13 })

    return () => {
      map.off('click', 'clusters', () => {})
      map.off('click', 'event-pin', onPinClick)
      map.off('click', 'event-label', onPinClick)
    }
  }, [events, ready])

  return (
    <div ref={mapContainer} className="w-full h-full rounded-xl overflow-hidden" />
  )
}
