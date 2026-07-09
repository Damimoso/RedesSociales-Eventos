import { useState, useEffect } from 'react'

type GeoPosition = {
  lat: number
  lng: number
}

type GeoState = {
  position: GeoPosition | null
  error: string | null
  loading: boolean
}

const DEFAULT_LOCATION = { lat: 28.1236, lng: -15.4366 } // Las Palmas de Gran Canaria

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    position: null,
    error: null,
    loading: true,
  })

  useEffect(() => {
    let cancelled = false
    if (!navigator.geolocation) {
      setState({ position: DEFAULT_LOCATION, error: 'Geolocalización no soportada — usando ubicación por defecto', loading: false })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return
        setState({
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          error: null,
          loading: false,
        })
      },
      () => {
        if (cancelled) return
        setState({ position: DEFAULT_LOCATION, error: null, loading: false })
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
    )
    return () => { cancelled = true }
  }, [])

  return state
}
