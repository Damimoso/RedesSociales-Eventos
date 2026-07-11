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

  useEffect(() => {
    if (!user) return
    let cancelled = false; (async () => {
      try {
        const [profileRes, rolesRes] = await Promise.all([
          supabase.from('profiles').select('display_name, avatar_url, phone').eq('id', user.id).single(),
          supabase.from('user_roles').select('role').eq('user_id', user.id),
        ])
        if (cancelled) return
        if (profileRes.data) setProfile(profileRes.data)
        if (rolesRes.data) setRoles(rolesRes.data.map(r => r.role))
      } catch (err) { console.error('Error loading profile:', err) }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [user])

  if (loading) return <LoadingSpinner />
  if (!user) return <p className="text-center text-[#8BA4B8] py-16">No has iniciado sesión</p>

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold shadow-lg"
          style={{ background: 'linear-gradient(135deg, #0077B6, #FFD100)', color: '#fff' }}>
          {profile?.display_name?.[0]?.toUpperCase() ?? user.email?.[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-white truncate">{profile?.display_name ?? 'Usuario'}</h1>
          <p className="text-sm text-[#8BA4B8]">{user.email}</p>
        </div>
        <StreakBadge />
      </div>

      <section className="space-y-3">
        <h2 className="font-semibold text-white/80 text-sm uppercase tracking-wider">Información</h2>
        <div className="bg-[#0D2137] rounded-xl p-4 space-y-2 text-sm border border-[rgba(0,119,182,0.1)]">
          <div className="flex justify-between">
            <span className="text-[#8BA4B8]">Nombre</span>
            <span className="text-white">{profile?.display_name ?? '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8BA4B8]">Email</span>
            <span className="text-white">{user.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#8BA4B8]">Teléfono</span>
            <span className="text-white">{profile?.phone ?? '—'}</span>
          </div>
        </div>
      </section>

      <section>
        <Link
          to="/tickets"
          className="flex items-center justify-between bg-gradient-to-r from-[#0077B6]/20 to-transparent rounded-xl p-4 hover:from-[#0077B6]/30 transition-all border border-[rgba(0,119,182,0.15)]"
        >
          <div>
            <h2 className="font-semibold text-white">Mis Entradas</h2>
            <p className="text-sm text-[#8BA4B8]">Ver códigos QR de tus compras</p>
          </div>
          <svg className="w-5 h-5 text-[#0077B6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-white/80 text-sm uppercase tracking-wider">Logros</h2>
        <AchievementGrid />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-white/80 text-sm uppercase tracking-wider">Roles</h2>
        <div className="flex flex-wrap gap-2">
          {roles.map(r => (
            <span key={r} className="text-xs font-medium px-3 py-1 rounded-full capitalize"
              style={{ background: 'rgba(0,119,182,0.15)', color: '#0077B6' }}>
              {r}
            </span>
          ))}
        </div>
        {!roles.includes('organizer') && !roles.includes('artist') && (
          <p className="text-xs text-[#8BA4B8] mt-2">
            ¿Quieres crear eventos? Solicita ser organizador o artista en el dashboard.
          </p>
        )}
      </section>
    </div>
  )
}
