import { useEffect, useState, useCallback } from 'react'
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

  const refresh = useCallback(async () => {
    if (!user) return
    const { data, error } = await supabase.rpc('check_streak')
    if (!error && data?.[0]) {
      setStreak({ current_streak: data[0].current_streak, longest_streak: data[0].longest_streak })
    }
    setLoading(false)
  }, [user])

  useEffect(() => { refresh() }, [refresh])

  return { ...streak, loading, refresh }
}
