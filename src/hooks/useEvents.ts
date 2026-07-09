import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export type NearbyEvent = {
  id: string
  title: string
  short_description: string | null
  cover_image_url: string | null
  city: string
  province: string | null
  start_date: string
  end_date: string
  is_free: boolean
  price: number | null
  currency: string
  max_capacity: number
  remaining_capacity: number
  distance_km: number
  lat: number
  lng: number
  organizer_name: string
  category_name: string | null
  category_slug: string | null
  tags: string[] | null
}

type UseEventsResult = {
  events: NearbyEvent[]
  loading: boolean
  error: string | null
  refresh: () => void
}

export function useEventsNearby(lat?: number, lng?: number, radiusKm = 25): UseEventsResult {
  const [events, setEvents] = useState<NearbyEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const fetchRef = useRef<number>(0)

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  const fetch = useCallback(async () => {
    if (lat === undefined || lng === undefined) {
      if (mountedRef.current) setLoading(false)
      return
    }

    if (mountedRef.current) { setLoading(true); setError(null) }

    const gen = ++fetchRef.current

    try {
      const { data, error: rpcError } = await supabase
        .rpc('find_events_nearby', { lat, lng, radius_km: radiusKm })

      if (!mountedRef.current || gen !== fetchRef.current) return

      if (rpcError) {
        setError(rpcError.message)
        setEvents([])
      } else {
        setEvents(data ?? [])
      }
    } catch (err: any) {
      if (mountedRef.current && gen === fetchRef.current) setError(err?.message ?? 'Error fetching events')
    } finally {
      if (mountedRef.current && gen === fetchRef.current) setLoading(false)
    }
  }, [lat, lng, radiusKm])

  useEffect(() => { fetch() }, [fetch])

  return { events, loading, error, refresh: fetch }
}

export type FollowedEvent = {
  id: string
  title: string
  short_description: string | null
  cover_image_url: string | null
  city: string
  start_date: string
  end_date: string
  is_free: boolean
  price: number | null
  organizer_name: string
  organizer_id: string
  category_slug: string | null
  tags: string[] | null
}

export function useFeed(userId?: string) {
  const [events, setEvents] = useState<FollowedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const feedRef = useRef<number>(0)

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  useEffect(() => {
    if (!userId) { setLoading(false); return }

    setLoading(true); setError(null)
    const gen = ++feedRef.current; (async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('get_feed', { p_user_id: userId })
        if (!mountedRef.current || gen !== feedRef.current) return
        if (rpcError) setError(rpcError.message)
        else setEvents(data ?? [])
      } catch (err: any) { if (mountedRef.current && gen === feedRef.current) setError(err?.message ?? 'Error fetching feed') }
      if (mountedRef.current && gen === feedRef.current) setLoading(false)
    })()
  }, [userId])

  return { events, loading, error }
}
