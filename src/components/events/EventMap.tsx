import { useRef, useEffect, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import type { NearbyEvent } from '@/hooks/useEvents'

type Props = {
  events: NearbyEvent[]
  center: { lat: number; lng: number }
  onEventClick?: (id: string) => void
}

export function EventMap({ events, center, onEventClick }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const styleLoaded = useRef(false)
  const [ready, setReady] = useState(false)

  // Inicializar mapa una vez
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [center.lng, center.lat],
      zoom: 11,
      attributionControl: false,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

    map.on('load', () => {
      map.resize()
      styleLoaded.current = true
      setReady(true)
    })

    map.on('error', (e) => {
      console.warn('MapLibre error:', e.error?.message)
    })

    mapRef.current = map
  }, [])

  // Actualizar marcadores cuando cambien los events o cuando el estilo cargue
  useEffect(() => {
    const map = mapRef.current
    if (!map || !styleLoaded.current) return

    // Limpiar capas/source anteriores
    if (map.getLayer('events-label')) map.removeLayer('events-label')
    if (map.getLayer('events-circle')) map.removeLayer('events-circle')
    if (map.getSource('events')) map.removeSource('events')

    const validEvents = events.filter(e => typeof e.lat === 'number' && typeof e.lng === 'number')
    if (validEvents.length === 0) return

    const markers = validEvents.map(e => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [e.lng, e.lat] },
      properties: {
        id: e.id,
        title: e.title,
        price: e.price ?? 0,
        is_free: e.is_free === true ? 'true' : 'false',
      },
    }))

    map.addSource('events', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: markers },
    })

    map.addLayer({
      id: 'events-circle',
      type: 'circle',
      source: 'events',
      paint: {
        'circle-radius': 8,
        'circle-color': ['case', ['==', ['get', 'is_free'], 'true'], '#22c55e', '#6366f1'],
        'circle-stroke-width': 2,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9,
      },
    })

    map.addLayer({
      id: 'events-label',
      type: 'symbol',
      source: 'events',
      layout: {
        'text-field': '{title}',
        'text-offset': [0, 1.5],
        'text-anchor': 'top',
        'text-size': 11,
        'text-max-width': 8,
      },
      paint: {
        'text-color': '#374151',
        'text-halo-color': '#ffffff',
        'text-halo-width': 1,
      },
    })

    if (onEventClick) {
      const onClick = (e: any) => {
        const id = e.features?.[0]?.properties?.id
        if (id) onEventClick(id)
      }
      map.on('click', 'events-circle', onClick)
      map.on('click', 'events-label', onClick)
      map.on('mouseenter', 'events-circle', () => { map.getCanvas().style.cursor = 'pointer' })
      map.on('mouseleave', 'events-circle', () => { map.getCanvas().style.cursor = '' })
    }

    const bounds = new maplibregl.LngLatBounds()
    markers.forEach(m => bounds.extend(m.geometry.coordinates as [number, number]))
    map.fitBounds(bounds, { padding: 60, maxZoom: 13 })
  }, [events, onEventClick, ready])

  return (
    <div ref={mapContainer} className="w-full h-full rounded-xl overflow-hidden" />
  )
}
