import { useEffect, useState, useCallback } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Link } from 'react-router-dom'

type Profile = {
  id: string
  display_name: string | null
  avatar_url: string | null
}

type FriendRow = {
  id: string
  requester_id: string
  addressee_id: string
  status: string
  created_at: string
}

type FriendWithProfile = FriendRow & { other: Profile; direction: 'sent' | 'received' }

export default function Friends() {
  const { user } = useAuth()
  const [friends, setFriends] = useState<FriendWithProfile[]>([])
  const [pending, setPending] = useState<FriendWithProfile[]>([])
  const [sent, setSent] = useState<FriendWithProfile[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Profile[]>([])
  const [searching, setSearching] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'friends' | 'pending' | 'search'>('friends')

  const loadFriendships = useCallback(async () => {
    if (!user) return
    const { data } = await supabase
      .from('friendships')
      .select('id, requester_id, addressee_id, status, created_at')
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
    if (!data) return

    const userIds = new Set<string>()
    data.forEach(f => { userIds.add(f.requester_id); userIds.add(f.addressee_id) })
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', [...userIds])
    const profileMap = new Map<string, Profile>((profiles ?? []).map(p => [p.id, p]))

    const enriched: FriendWithProfile[] = data.map(f => ({
      ...f,
      other: f.requester_id === user.id ? (profileMap.get(f.addressee_id) ?? { id: f.addressee_id, display_name: 'Usuario', avatar_url: null }) : (profileMap.get(f.requester_id) ?? { id: f.requester_id, display_name: 'Usuario', avatar_url: null }),
      direction: f.requester_id === user.id ? 'sent' : 'received',
    }))

    setFriends(enriched.filter(f => f.status === 'accepted'))
    const pendingList = enriched.filter(f => f.status === 'pending')
    setPending(pendingList.filter(f => f.direction === 'received'))
    setSent(pendingList.filter(f => f.direction === 'sent'))
    setLoading(false)
  }, [user])

  useEffect(() => { loadFriendships() }, [loadFriendships])

  const searchUsers = async (q: string) => {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .ilike('display_name', `%${q}%`)
      .limit(10)
    setSearchResults(data?.filter(p => p.id !== user?.id) ?? [])
    setSearching(false)
  }

  const sendRequest = async (targetId: string) => {
    await supabase.from('friendships').insert({ requester_id: user!.id, addressee_id: targetId })
    loadFriendships()
    setSearchResults(prev => prev.filter(p => p.id !== targetId))
  }

  const respondRequest = async (friendshipId: string, accept: boolean) => {
    await supabase.from('friendships').update({ status: accept ? 'accepted' : 'rejected' }).eq('id', friendshipId)
    loadFriendships()
  }

  const cancelRequest = async (friendshipId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId)
    loadFriendships()
  }

  const removeFriend = async (friendshipId: string) => {
    await supabase.from('friendships').delete().eq('id', friendshipId)
    loadFriendships()
  }

  if (loading) return <LoadingSpinner />
  if (!user) return <p className="text-center text-muted py-16">Inicia sesión para ver tus amigos</p>

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-text">Amigos</h1>

      <div className="flex gap-1 bg-elevated rounded-lg p-1 text-sm">
        {(['friends', 'pending', 'search'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-md font-medium transition-colors ${tab === t ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-text'}`}>
            {t === 'friends' ? `Amigos (${friends.length})` : t === 'pending' ? `Solicitudes (${pending.length})` : 'Buscar'}
          </button>
        ))}
      </div>

      {tab === 'friends' && (
        <div className="space-y-2">
          {friends.length === 0 && <p className="text-center text-muted py-8">Aún no tienes amigos</p>}
          {friends.map(f => (
            <div key={f.id} className="flex items-center gap-3 bg-surface rounded-xl p-3 border border-primary/10">
              <Link to={`/profile`} className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, var(--th-primary), var(--th-secondary))', color: '#fff' }}>
                {f.other.display_name?.[0]?.toUpperCase() ?? '?'}
              </Link>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{f.other.display_name ?? 'Usuario'}</p>
              </div>
              <div className="flex gap-1">
                <Link to={`/messages?user=${f.other.id}`}>
                  <Button variant="secondary" size="sm">Chat</Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => removeFriend(f.id)}>Eliminar</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'pending' && (
        <div className="space-y-4">
          {pending.length > 0 && (
            <div>
              <h2 className="font-semibold text-sm text-muted mb-2">Recibidas</h2>
              <div className="space-y-2">
                {pending.map(f => (
                  <div key={f.id} className="flex items-center gap-3 bg-surface rounded-xl p-3 border border-primary/10">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, var(--th-primary), var(--th-secondary))', color: '#fff' }}>
                      {f.other.display_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{f.other.display_name ?? 'Usuario'}</p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" onClick={() => respondRequest(f.id, true)}>Aceptar</Button>
                      <Button variant="secondary" size="sm" onClick={() => respondRequest(f.id, false)}>Rechazar</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sent.length > 0 && (
            <div>
              <h2 className="font-semibold text-sm text-muted mb-2">Enviadas</h2>
              <div className="space-y-2">
                {sent.map(f => (
                  <div key={f.id} className="flex items-center gap-3 bg-surface rounded-xl p-3 border border-primary/10">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, var(--th-primary), var(--th-secondary))', color: '#fff' }}>
                      {f.other.display_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{f.other.display_name ?? 'Usuario'}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => cancelRequest(f.id)}>Cancelar</Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pending.length === 0 && sent.length === 0 && (
            <p className="text-center text-muted py-8">No hay solicitudes pendientes</p>
          )}
        </div>
      )}

      {tab === 'search' && (
        <div className="space-y-3">
          <input
            type="text" placeholder="Buscar usuarios por nombre..."
            value={searchQuery} onChange={e => searchUsers(e.target.value)}
            className="w-full bg-surface border border-primary/20 rounded-lg px-4 py-2.5 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {searching && <LoadingSpinner size="sm" />}
          <div className="space-y-2">
            {searchResults.map(p => (
              <div key={p.id} className="flex items-center gap-3 bg-surface rounded-xl p-3 border border-primary/10">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--th-primary), var(--th-secondary))', color: '#fff' }}>
                  {p.display_name?.[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{p.display_name ?? 'Usuario'}</p>
                </div>
                <Button size="sm" onClick={() => sendRequest(p.id)}>Agregar</Button>
              </div>
            ))}
            {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
              <p className="text-center text-muted py-4">No se encontraron usuarios</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
