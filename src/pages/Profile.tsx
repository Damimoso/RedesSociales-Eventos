import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Link } from 'react-router-dom'
import { StreakBadge } from '@/components/gamification/StreakBadge'
import { AchievementGrid } from '@/components/gamification/AchievementGrid'

type Profile = {
  display_name: string | null
  avatar_url: string | null
  phone: string | null
}

export default function Profile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [roles, setRoles] = useState<string[]>([])
  const [friendCount, setFriendCount] = useState(0)

  useEffect(() => {
    if (!user) return
    let cancelled = false; (async () => {
      try {
        const [profileRes, rolesRes, friendRes] = await Promise.all([
          supabase.from('profiles').select('display_name, avatar_url, phone').eq('id', user.id).maybeSingle(),
          supabase.from('user_roles').select('role').eq('user_id', user.id),
          supabase.from('friendships').select('id', { count: 'exact', head: true })
            .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`).eq('status', 'accepted'),
        ])
        if (cancelled) return
        if (profileRes.data) setProfile(profileRes.data)
        if (rolesRes.data) setRoles(rolesRes.data.map(r => r.role))
        if (friendRes.count !== null) setFriendCount(friendRes.count)
      } catch (err) { console.error('Error loading profile:', err) }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [user])

  if (loading) return <LoadingSpinner />
  if (!user) return <p className="text-center text-muted py-16">No has iniciado sesión</p>

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg"
          style={{ background: 'linear-gradient(135deg, var(--th-primary, #6366F1), var(--th-secondary, #EC4899))', color: '#fff' }}>
          {profile?.display_name?.[0]?.toUpperCase() ?? user.email?.[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-text truncate">{profile?.display_name ?? 'Usuario'}</h1>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
        <StreakBadge />
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold text-text/80 text-sm uppercase tracking-wider">Información</h2>
        <div className="bg-surface rounded-xl p-4 space-y-2 text-sm border border-primary/10">
          <div className="flex justify-between">
            <span className="text-muted">Nombre</span>
            <span className="text-text">{profile?.display_name ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Email</span>
            <span className="text-text">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Teléfono</span>
            <span className="text-text">{profile?.phone ?? '—'}</span>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Link to="/tickets"
          className="flex items-center justify-between bg-gradient-to-r from-primary/20 to-transparent rounded-xl p-4 hover:from-primary/30 transition-all border border-primary/15"
        >
          <div>
            <h2 className="font-semibold text-text">Mis Entradas</h2>
            <p className="text-sm text-muted">Ver QR</p>
          </div>
          <svg className="w-5 h-5 text-primary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
        <Link to="/friends"
          className="flex items-center justify-between bg-gradient-to-r from-secondary/20 to-transparent rounded-xl p-4 hover:from-secondary/30 transition-all border border-secondary/15"
        >
          <div>
            <h2 className="font-semibold text-text">Amigos</h2>
            <p className="text-sm text-muted">{friendCount} amigo{friendCount !== 1 ? 's' : ''}</p>
          </div>
          <svg className="w-5 h-5 text-secondary flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold text-text/80 text-sm uppercase tracking-wider">Logros</h2>
        <AchievementGrid />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-text/80 text-sm uppercase tracking-wider">Roles</h2>
        <div className="flex flex-wrap gap-2">
          {roles.map(r => (
            <span key={r} className="text-xs font-medium px-3 py-1 rounded-full capitalize bg-primary/15 text-primary">
              {r}
            </span>
          ))}
        </div>
        {!roles.includes('organizer') && !roles.includes('artist') && (
          <p className="text-xs text-muted mt-2">
            ¿Quieres crear eventos? Solicita ser organizador o artista en el dashboard.
          </p>
        )}
      </section>
    </div>
  )
}
