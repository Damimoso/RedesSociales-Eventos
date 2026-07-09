import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

type Streak = {
  current_streak: number
  longest_streak: number
}

export function useStreak() {
  const { user } = useAuth()
  const [streak, setStreak] = useState<Streak>({ current_streak: 0, longest_streak: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  const refresh = useCallback(async () => {
    if (!user) {
      if (mountedRef.current) setLoading(false)
      return
    }

    if (mountedRef.current) setLoading(true)

    try {
      const { data, error: rpcError } = await supabase.rpc('check_streak')
      if (!mountedRef.current) return

      if (rpcError) {
        setError(rpcError.message)
      } else if (data && data.length > 0) {
        setStreak({ current_streak: data[0].current_streak, longest_streak: data[0].longest_streak })
        setError(null)
      } else {
        setStreak({ current_streak: 0, longest_streak: 0 })
        setError(null)
      }
    } catch (err: any) {
      if (mountedRef.current) setError(err?.message ?? 'Error checking streak')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { refresh() }, [refresh])

  return { ...streak, loading, error, refresh }
}
