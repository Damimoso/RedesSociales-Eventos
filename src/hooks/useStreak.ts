import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

type Streak = {
  current_streak: number
  longest_streak: number
}

// The RPC function returns out_current / out_longest as column names
type StreakRow = {
  out_current: number
  out_longest: number
}

export function useStreak() {
  const { user } = useAuth()
  const [streak, setStreak] = useState<Streak>({ current_streak: 0, longest_streak: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const refreshRef = useRef<number>(0)

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  const refresh = useCallback(async () => {
    if (!user) {
      if (mountedRef.current) setLoading(false)
      return
    }

    if (mountedRef.current) setLoading(true)
    const gen = ++refreshRef.current

    try {
      const { data, error: rpcError } = await supabase.rpc('check_streak')
      if (!mountedRef.current || gen !== refreshRef.current) return

      if (rpcError) {
        console.warn('[useStreak] RPC error:', JSON.stringify({ message: rpcError.message, code: rpcError.code, details: rpcError.details, status: (rpcError as any).status }))
        // Fallback: fetch directly bypassing Supabase client
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        const url = import.meta.env.VITE_SUPABASE_URL
        const key = import.meta.env.VITE_SUPABASE_ANON_KEY
        if (url && key) {
          try {
            const res = await fetch(`${url}/rest/v1/rpc/check_streak`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${token ?? key}` },
              body: '{}',
            })
            const text = await res.text()
            console.warn(`[useStreak] Direct fetch: status=${res.status} body=${text}`)
            if (res.ok) {
              const parsed = JSON.parse(text) as StreakRow[]
              if (parsed && parsed.length > 0) {
                setStreak({ current_streak: parsed[0].out_current, longest_streak: parsed[0].out_longest })
                setError(null)
                setLoading(false)
                return
              }
            }
          } catch (fetchErr: any) {
            console.warn('[useStreak] Direct fetch also failed:', fetchErr.message)
          }
        }
        setStreak({ current_streak: 0, longest_streak: 0 })
      } else if (data && data.length > 0) {
        const row = data[0] as StreakRow
        setStreak({ current_streak: row.out_current, longest_streak: row.out_longest })
      } else {
        setStreak({ current_streak: 0, longest_streak: 0 })
      }
      setError(null)
    } catch (e: any) {
      console.warn('[useStreak] catch block:', e.message)
      if (mountedRef.current && gen === refreshRef.current) { setStreak({ current_streak: 0, longest_streak: 0 }); setError(null) }
    } finally {
      if (mountedRef.current && gen === refreshRef.current) setLoading(false)
    }
  }, [user?.id])

  useEffect(() => { refresh() }, [refresh])

  return { ...streak, loading, error, refresh }
}
