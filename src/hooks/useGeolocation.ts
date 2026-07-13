import { useState, useEffect, useRef } from 'react'

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

async function checkPermission(): Promise<'granted' | 'denied' | 'prompt'> {
  try {
    const result = await navigator.permissions.query({ name: 'geolocation' })
    return result.state
  } catch {
    return 'prompt'
  }
}

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({
    position: null,
    error: null,
    loading: true,
  })

  const fallbackTimer = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!navigator.geolocation) {
      setState({ position: DEFAULT_LOCATION, error: 'Geolocalización no soportada — usando ubicación por defecto', loading: false })
      return
    }

    ;(async () => {
      const perm = await checkPermission()
      if (cancelled) return

      if (perm === 'denied') {
        setState({
          position: DEFAULT_LOCATION,
          error: 'Permiso de ubicación denegado — usando ubicación por defecto',
          loading: false,
        })
        return
      }

      fallbackTimer.current = window.setTimeout(() => {
        if (cancelled) return
        setState({ position: DEFAULT_LOCATION, error: null, loading: false })
      }, 5000)

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (cancelled) return
          if (fallbackTimer.current !== null) clearTimeout(fallbackTimer.current)
          setState({
            position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            error: null,
            loading: false,
          })
        },
        () => {
          if (cancelled) return
          if (fallbackTimer.current !== null) clearTimeout(fallbackTimer.current)
          setState({ position: DEFAULT_LOCATION, error: null, loading: false })
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 }
      )
    })()

    return () => { cancelled = true; if (fallbackTimer.current !== null) clearTimeout(fallbackTimer.current) }
  }, [])

  return state
}
