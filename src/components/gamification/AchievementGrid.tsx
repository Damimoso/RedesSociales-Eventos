import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

const ALL_ACHIEVEMENTS = [
  { key: 'first_plan', icon: '🎟️', title: 'Primer Plan', desc: 'Compra tu primera entrada' },
  { key: 'veteran', icon: '🏅', title: 'Veteranía', desc: 'Asiste a 10 eventos' },
  { key: 'three_islands', icon: '🌴', title: 'Canario de verdad', desc: 'Eventos en 3 islas' },
  { key: 'early_bird', icon: '⚡', title: 'Madrugador', desc: 'Entre los 50 primeros en comprar' },
  { key: 'influencer', icon: '📣', title: 'Influencer cultural', desc: 'Comparte 5 eventos con amigos' },
  { key: 'completo', icon: '🏆', title: 'Completo', desc: 'Asiste a 5 categorías distintas' },
]

export function AchievementGrid() {
  const { user } = useAuth()
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.rpc('get_achievements').then(({ data, error }) => {
      if (!error && data) setUnlocked(new Set(data.map((a: any) => a.achievement_key)))
      setLoading(false)
    })
  }, [user])

  if (loading) return <LoadingSpinner />

  return (
    <div className="grid grid-cols-3 gap-3">
      {ALL_ACHIEVEMENTS.map(a => {
        const has = unlocked.has(a.key)
        return (
          <div key={a.key}
            className={`relative flex flex-col items-center gap-1 rounded-xl p-3 text-center transition-all ${
              has
                ? 'bg-gradient-to-b from-[#7C5CFC]/20 to-transparent border border-[#7C5CFC]/30'
                : 'bg-white/5 border border-white/10 opacity-40 grayscale'
            }`}
          >
            <span className="text-2xl">{a.icon}</span>
            <span className="text-[11px] font-medium leading-tight text-white">{a.title}</span>
            {has && (
              <span className="absolute -top-1 -right-1 text-xs">✅</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
