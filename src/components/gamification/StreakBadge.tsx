import { useStreak } from '@/hooks/useStreak'
import { useTheme } from '@/contexts/ThemeContext'

const TIERS = [
  { min: 0, label: 'Explorador', icon: '🌱' },
  { min: 4, label: 'Paseante', icon: '🚶' },
  { min: 8, label: 'Festivalero', icon: '🎪' },
  { min: 15, label: 'Leyenda', icon: '👑' },
]

function isDarkHex(hex: string): boolean {
  const c = hex.replace('#', '')
  if (c.length < 6) return false
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128
}

export function StreakBadge() {
  const { current_streak, loading } = useStreak()
  const { vars } = useTheme()

  if (loading || current_streak === 0) return null

  const tier = [...TIERS].reverse().find(t => current_streak >= t.min) ?? TIERS[0]
  const dark = isDarkHex(vars.base)

  return (
    <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${dark ? 'bg-white/5 border border-white/10' : 'bg-primary/10 border border-primary/20'}`}>
      <span className="text-lg drop-shadow-[0_0_6px_rgba(255,107,157,0.5)] animate-streak-pulse">🔥</span>
      <span className={`font-bold ${dark ? 'text-white' : 'text-text'}`}>{current_streak}</span>
      <span className="text-xs font-medium text-muted">{tier.icon} {tier.label}</span>
    </div>
  )
}
