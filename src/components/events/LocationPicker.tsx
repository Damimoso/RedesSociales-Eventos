import { useRef, useEffect, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

type Props = {
  center: { lat: number; lng: number }
  value: { lat: number; lng: number } | null
  onChange: (pos: { lat: number; lng: number }) => void
}

export function LocationPicker({ center, value, onChange }: Props) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const markerRef = useRef<maplibregl.Marker | null>(null)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [center.lng, center.lat],
      zoom: 12,
      attributionControl: false,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')

    map.on('load', () => map.resize())

    const marker = new maplibregl.Marker({ draggable: true, color: '#6366f1' })
      .setLngLat([center.lng, center.lat])
      .addTo(map)

    marker.on('dragstart', () => setDragging(true))
    marker.on('dragend', () => {
      setDragging(false)
      const lngLat = marker.getLngLat()
      onChange({ lat: lngLat.lat, lng: lngLat.lng })
    })

    map.on('click', (e) => {
      marker.setLngLat(e.lngLat)
      onChange({ lat: e.lngLat.lat, lng: e.lngLat.lng })
    })

    markerRef.current = marker
    mapRef.current = map
    return () => { map.remove(); mapRef.current = null; markerRef.current = null }
  }, [])

  useEffect(() => {
    if (!value || dragging || !mapRef.current) return
    markerRef.current?.setLngLat([value.lng, value.lat])
    mapRef.current.flyTo({ center: [value.lng, value.lat], zoom: 12 })
  }, [value?.lat, value?.lng])

  return (
    <div>
      <div ref={mapContainer} className="w-full h-[250px] rounded-lg overflow-hidden border border-gray-300" />
      {value && (
        <p className="text-xs text-gray-400 mt-1">
          {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
          {dragging ? ' — Arrastra el marcador para ajustar' : ''}
        </p>
      )}
    </div>
  )
}
