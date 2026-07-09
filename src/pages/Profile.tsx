import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Button } from '@/components/ui/Button'
import { Link } from 'react-router-dom'

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
    Promise.all([
      supabase.from('profiles').select('display_name, avatar_url, phone').eq('id', user.id).single(),
      supabase.from('user_roles').select('role').eq('user_id', user.id),
    ]).then(([profileRes, rolesRes]) => {
      if (profileRes.data) setProfile(profileRes.data)
      if (rolesRes.data) setRoles(rolesRes.data.map(r => r.role))
      setLoading(false)
    })
  }, [user])

  if (loading) return <LoadingSpinner />
  if (!user) return <p className="text-center text-gray-500 py-16">No has iniciado sesión</p>

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center text-2xl font-bold text-indigo-700">
          {profile?.display_name?.[0]?.toUpperCase() ?? user.email?.[0].toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold">{profile?.display_name ?? 'Usuario'}</h1>
          <p className="text-sm text-gray-500">{user.email}</p>
        </div>
      </div>

      <section className="space-y-3 mb-8">
        <h2 className="font-semibold text-gray-900">Información</h2>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Nombre</span><span>{profile?.display_name ?? '—'}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Email</span><span>{user.email}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Teléfono</span><span>{profile?.phone ?? '—'}</span></div>
        </div>
      </section>

      <section className="mb-6">
        <Link
          to="/tickets"
          className="flex items-center justify-between bg-indigo-50 rounded-xl p-4 hover:bg-indigo-100 transition-colors"
        >
          <div>
            <h2 className="font-semibold text-gray-900">Mis Entradas</h2>
            <p className="text-sm text-gray-500">Ver códigos QR de tus compras</p>
          </div>
          <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-gray-900">Roles</h2>
        <div className="flex flex-wrap gap-2">
          {roles.map(r => (
            <span key={r} className="bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1 rounded-full capitalize">{r}</span>
          ))}
        </div>
        {!roles.includes('organizer') && !roles.includes('artist') && (
          <p className="text-xs text-gray-400 mt-2">
            ¿Quieres crear eventos? Solicita ser organizador o artista en el dashboard.
          </p>
        )}
      </section>
    </div>
  )
}
