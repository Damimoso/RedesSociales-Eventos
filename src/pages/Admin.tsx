import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Button } from '@/components/ui/Button'

type UserRow = {
  user_id: string
  email: string
  display_name: string | null
  roles: string[]
  created_at: string
}

export default function Admin() {
  const { user } = useAuth()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    let cancelled = false; (async () => {
      await loadUsers(cancelled)
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [user])

  const loadUsers = async (cancelled: boolean = false) => {
    try {
      const { data } = await supabase.rpc('admin_list_users')
      if (!cancelled && data) setUsers(data as UserRow[])
    } catch (err) { console.error('Error loading users:', err) }
  }

  const toggleRole = async (userId: string, role: string, add: boolean) => {
    if (add) {
      await supabase.from('user_roles').insert({ user_id: userId, role })
    } else {
      await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role)
    }
    loadUsers()
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Panel de Administración</h1>

      <div className="bg-[#0D2137] border border-[rgba(0,119,182,0.1)] rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Usuarios y Roles</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[rgba(0,119,182,0.1)]">
                <th className="text-left py-3 px-2 font-medium text-[#8BA4B8]">Email</th>
                <th className="text-left py-3 px-2 font-medium text-[#8BA4B8]">Nombre</th>
                <th className="text-left py-3 px-2 font-medium text-[#8BA4B8]">Roles</th>
                <th className="text-right py-3 px-2 font-medium text-[#8BA4B8]">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id} className="border-b border-[rgba(0,119,182,0.05)]">
                  <td className="py-3 px-2 text-white">{u.email}</td>
                  <td className="py-3 px-2 text-[#8BA4B8]">{u.display_name ?? '—'}</td>
                  <td className="py-3 px-2">
                    <div className="flex flex-wrap gap-1">
                      {['user', 'artist', 'organizer', 'admin'].map(role => (
                        <span key={role}
                          className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                            u.roles.includes(role)
                              ? 'bg-[#0077B6]/20 text-[#0077B6]'
                              : 'bg-white/5 text-[#8BA4B8]'
                          }`}>
                          {role}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-2 text-right">
                    <div className="flex justify-end gap-1 flex-wrap">
                      {['artist', 'organizer', 'admin'].map(role => {
                        const hasRole = u.roles.includes(role)
                        return (
                          <Button key={role} size="sm"
                            variant={hasRole ? 'danger' : 'outline'}
                            onClick={() => toggleRole(u.user_id, role, !hasRole)}>
                            {hasRole ? `Quitar ${role}` : `Dar ${role}`}
                          </Button>
                        )
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
