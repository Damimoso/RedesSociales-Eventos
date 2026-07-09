import { useStreak } from '@/hooks/useStreak'

const TIERS = [
  { min: 0, label: 'Explorador', color: 'text-gray-500', icon: '🌱' },
  { min: 4, label: 'Paseante', color: 'text-amber-400', icon: '🚶' },
  { min: 8, label: 'Festivalero', color: 'text-sky-400', icon: '🎪' },
  { min: 15, label: 'Leyenda', color: 'text-yellow-300', icon: '👑' },
]

export function StreakBadge() {
  const { current_streak, loading } = useStreak()

  if (loading || current_streak === 0) return null

  const tier = [...TIERS].reverse().find(t => current_streak >= t.min) ?? TIERS[0]

  return (
    <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full px-3 py-1.5 text-sm">
      <span className="text-lg drop-shadow-[0_0_6px_rgba(255,107,157,0.5)] animate-streak-pulse">🔥</span>
      <span className="font-bold text-white">{current_streak}</span>
      <span className={`text-xs font-medium ${tier.color}`}>{tier.icon} {tier.label}</span>
    </div>
  )
}
