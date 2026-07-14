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

type FollowRow = {
  id: string
  follower_id: string
  following_id: string
  following_type: string
  created_at: string
}

type FriendshipRow = {
  id: string
  requester_id: string
  addressee_id: string
  status: string
  created_at: string
}

type FriendshipWithProfile = FriendshipRow & {
  other: Profile
  otherStageName?: string
  direction: 'sent' | 'received'
}

type Tab = 'amigos' | 'artistas' | 'solicitudes' | 'siguiendo' | 'seguidores'

function Avatar({ name }: { name: string | null }) {
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
      style={{ background: 'linear-gradient(135deg, var(--th-primary), var(--th-secondary))', color: '#fff' }}>
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

function enrichProfiles<T extends { requester_id: string; addressee_id: string }>(
  rows: T[],
  userId: string,
  profiles: Map<string, Profile>,
  stageNames?: Map<string, string>,
): (T & { other: Profile; otherStageName?: string; direction: 'sent' | 'received' })[] {
  return rows.map(r => {
    const isRequester = r.requester_id === userId
    const otherId = isRequester ? r.addressee_id : r.requester_id
    const profile = profiles.get(otherId) ?? { id: otherId, display_name: 'Usuario', avatar_url: null }
    return { ...r, other: profile, otherStageName: stageNames?.get(otherId), direction: isRequester ? 'sent' as const : 'received' as const }
  })
}

export default function Friends() {
  const { user, roles } = useAuth()
  const isArtist = roles.includes('artist')
  const isOrganizer = roles.includes('organizer')
  const isRegular = !isArtist && !isOrganizer && !roles.includes('admin')

  const [friends, setFriends] = useState<FriendshipWithProfile[]>([])
  const [pendingIn, setPendingIn] = useState<FriendshipWithProfile[]>([])
  const [pendingOut, setPendingOut] = useState<FriendshipWithProfile[]>([])
  const [following, setFollowing] = useState<{ id: string; profile: Profile; type: string }[]>([])
  const [followers, setFollowers] = useState<{ id: string; profile: Profile }[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>()

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; stageName: string; displayName: string; alreadyRequested: boolean; alreadyConnected: boolean }[]>([])
  const [searching, setSearching] = useState(false)

  const isArtistOrOrg = isArtist || isOrganizer

  const tabs: { key: Tab; label: string; count?: number }[] = []
  if (isArtist) tabs.push({ key: 'amigos', label: 'Amigos', count: friends.length })
  if (isOrganizer) tabs.push({ key: 'artistas', label: 'Artistas', count: friends.length })
  if (isArtistOrOrg) tabs.push({ key: 'solicitudes', label: 'Solicitudes', count: pendingIn.length + pendingOut.length })
  tabs.push({ key: 'siguiendo', label: 'Siguiendo', count: following.length })
  tabs.push({ key: 'seguidores', label: 'Seguidores', count: followers.length })

  useEffect(() => {
    if (tab) return
    if (isArtist) setTab('amigos')
    else if (isOrganizer) setTab('artistas')
    else setTab('siguiendo')
  }, [tab, isArtist, isOrganizer])

  const loadData = useCallback(async () => {
    if (!user) return
    try {
      const [friendshipRes, followsRes, followersRes] = await Promise.all([
        // Load friendships
        isArtistOrOrg ? supabase.from('friendships')
          .select('id, requester_id, addressee_id, status, created_at')
          .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`)
          .order('created_at', { ascending: false }) : Promise.resolve({ data: null }),
        // Load who I follow
        supabase.from('follows')
          .select('id, follower_id, following_id, following_type, created_at')
          .eq('follower_id', user.id)
          .order('created_at', { ascending: false }),
        // Load my followers
        supabase.from('follows')
          .select('id, follower_id, following_id, following_type, created_at')
          .eq('following_id', user.id)
          .order('created_at', { ascending: false }),
      ])

      const allProfileIds = new Set<string>()

      // Collect IDs from friendships
      if (friendshipRes?.data) {
        for (const f of friendshipRes.data) {
          allProfileIds.add(f.requester_id)
          allProfileIds.add(f.addressee_id)
        }
      }

      // Collect IDs from follows (who I follow)
      if (followsRes.data) {
        for (const f of followsRes.data) allProfileIds.add(f.following_id)
      }

      // Collect IDs from followers
      if (followersRes.data) {
        for (const f of followersRes.data) allProfileIds.add(f.follower_id)
      }

      // Fetch profiles
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', [...allProfileIds])
      const profileMap = new Map<string, Profile>((profileData ?? []).map(p => [p.id, p]))

      // Fetch stage names for artists
      const artistIds = new Set<string>()
      if (friendshipRes?.data) {
        for (const f of friendshipRes.data) {
          artistIds.add(f.requester_id)
          artistIds.add(f.addressee_id)
        }
      }
      const { data: artistData } = artistIds.size > 0
        ? await supabase.from('artists').select('user_id, stage_name').in('user_id', [...artistIds])
        : { data: null }
      const stageNameMap = new Map<string, string>((artistData ?? []).map(a => [a.user_id, a.stage_name]))

      // Process friendships
      if (friendshipRes?.data) {
        const enriched = enrichProfiles(friendshipRes.data, user.id, profileMap, stageNameMap)
        setFriends(enriched.filter(f => f.status === 'accepted'))
        const pending = enriched.filter(f => f.status === 'pending')
        setPendingIn(pending.filter(f => f.direction === 'received'))
        setPendingOut(pending.filter(f => f.direction === 'sent'))
      } else {
        setFriends([])
        setPendingIn([])
        setPendingOut([])
      }

      // Process follows (who I follow)
      if (followsRes.data) {
        setFollowing(followsRes.data.map(f => ({
          id: f.id,
          profile: profileMap.get(f.following_id) ?? { id: f.following_id, display_name: 'Usuario', avatar_url: null },
          type: f.following_type,
        })))
      }

      // Process followers
      if (followersRes.data) {
        setFollowers(followersRes.data.map(f => ({
          id: f.id,
          profile: profileMap.get(f.follower_id) ?? { id: f.follower_id, display_name: 'Usuario', avatar_url: null },
        })))
      }
    } catch (err) { console.error('Error loading social data:', err) }
    setLoading(false)
  }, [user, isArtistOrOrg])

  useEffect(() => { loadData() }, [loadData])

  // --- Friendship actions ---
  const removeFriend = async (id: string) => {
    await supabase.from('friendships').delete().eq('id', id)
    loadData()
  }

  const respondRequest = async (id: string, accept: boolean) => {
    await supabase.from('friendships').update({ status: accept ? 'accepted' : 'rejected' }).eq('id', id)
    loadData()
  }

  const cancelRequest = async (id: string) => {
    await supabase.from('friendships').delete().eq('id', id)
    loadData()
  }

  // --- Follow actions ---
  const unfollow = async (id: string) => {
    await supabase.from('follows').delete().eq('id', id)
    loadData()
  }

  // --- Search for artists (organizers / artists) ---
  const searchArtists = async (q: string) => {
    setSearchQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    const { data } = await supabase
      .from('artists')
      .select('id, user_id, stage_name')
      .or(`stage_name.ilike.%${q}%,user_id.ilike.%${q}%`)
      .limit(10)

    if (!data) { setSearchResults([]); setSearching(false); return }

    const existingFriendships = [...friends, ...pendingIn, ...pendingOut]
    const results = data
      .filter(a => a.user_id !== user?.id)
      .map(a => {
        const alreadyConnected = friends.some(f => f.other.id === a.user_id)
        const alreadyRequested = pendingOut.some(f => f.other.id === a.user_id) || pendingIn.some(f => f.other.id === a.user_id)
        return {
          id: a.user_id,
          stageName: a.stage_name,
          displayName: profileMap?.get(a.user_id)?.display_name ?? 'Usuario',
          alreadyRequested,
          alreadyConnected,
        }
      })
    setSearchResults(results)
    setSearching(false)
  }

  const sendArtistRequest = async (targetUserId: string) => {
    await supabase.from('friendships').insert({ requester_id: user!.id, addressee_id: targetUserId })
    loadData()
    setSearchResults(prev => prev.filter(p => p.id !== targetUserId))
  }

  // Profile map for search (load from existing data)
  const [profileMap, setProfileMap] = useState<Map<string, Profile>>(new Map())
  useEffect(() => {
    if (!user) return
    const loadProfiles = async () => {
      const { data } = await supabase.from('profiles').select('id, display_name, avatar_url').limit(500)
      if (data) setProfileMap(new Map(data.map(p => [p.id, p])))
    }
    loadProfiles()
  }, [user])

  if (loading) return <LoadingSpinner />
  if (!user) return <p className="text-center text-muted py-16">Inicia sesión</p>

  const title = isArtist ? 'Amigos' : isOrganizer ? 'Artistas' : 'Siguiendo'

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-text">{title}</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-elevated rounded-lg p-1 text-sm overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-md font-medium transition-colors whitespace-nowrap ${tab === t.key ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-text'}`}>
            {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {/* Amigos (artist→artist accepted) */}
      {tab === 'amigos' && (
        <div className="space-y-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted">Artistas que son tus amigos</p>
          </div>
          {friends.length === 0 && (
            <p className="text-center text-muted py-8">Busca artistas para agregar como amigos</p>
          )}
          {friends.map(f => (
            <div key={f.id} className="flex items-center gap-3 bg-surface rounded-xl p-3 border border-primary/10">
              <Avatar name={f.otherStageName ?? f.other.display_name} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{f.otherStageName ?? f.other.display_name ?? 'Usuario'}</p>
              </div>
              <div className="flex gap-1">
                <Link to={`/messages?user=${f.other.id}`}>
                  <Button variant="secondary" size="sm">Chat</Button>
                </Link>
                <Button variant="ghost" size="sm" onClick={() => removeFriend(f.id)}>Eliminar</Button>
              </div>
            </div>
          ))}

          {/* Search artists */}
          <div className="mt-6 pt-4 border-t border-primary/10">
            <p className="text-sm font-medium text-text mb-2">Buscar artistas</p>
            <input type="text" placeholder="Nombre del artista..."
              value={searchQuery} onChange={e => searchArtists(e.target.value)}
              className="w-full bg-surface border border-primary/20 rounded-lg px-4 py-2.5 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary" />
            {searching && <LoadingSpinner size="sm" />}
            <div className="space-y-2 mt-2">
              {searchResults.filter(r => !r.alreadyConnected).map(r => (
                <div key={r.id} className="flex items-center gap-3 bg-surface rounded-xl p-3 border border-primary/10">
                  <Avatar name={r.stageName} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{r.stageName}</p>
                  </div>
                  <Button size="sm" onClick={() => sendArtistRequest(r.id)}
                    disabled={r.alreadyRequested}>
                    {r.alreadyRequested ? 'Pendiente' : 'Agregar amigo'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Artistas (organizer→artist accepted) */}
      {tab === 'artistas' && (
        <div className="space-y-2">
          <p className="text-sm text-muted mb-2">Artistas agregados a tu organización</p>
          {friends.length === 0 && (
            <p className="text-center text-muted py-8">Busca artistas para agregar a tu organización</p>
          )}
          {friends.map(f => (
            <div key={f.id} className="flex items-center gap-3 bg-surface rounded-xl p-3 border border-primary/10">
              <Avatar name={f.otherStageName ?? f.other.display_name} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{f.otherStageName ?? f.other.display_name ?? 'Usuario'}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => removeFriend(f.id)}>Quitar</Button>
            </div>
          ))}

          {/* Search artists to add */}
          <div className="mt-6 pt-4 border-t border-primary/10">
            <p className="text-sm font-medium text-text mb-2">Buscar artistas para agregar</p>
            <input type="text" placeholder="Nombre del artista..."
              value={searchQuery} onChange={e => searchArtists(e.target.value)}
              className="w-full bg-surface border border-primary/20 rounded-lg px-4 py-2.5 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary" />
            {searching && <LoadingSpinner size="sm" />}
            <div className="space-y-2 mt-2">
              {searchResults.filter(r => !r.alreadyConnected).map(r => (
                <div key={r.id} className="flex items-center gap-3 bg-surface rounded-xl p-3 border border-primary/10">
                  <Avatar name={r.stageName} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{r.stageName}</p>
                  </div>
                  <Button size="sm" onClick={() => sendArtistRequest(r.id)}
                    disabled={r.alreadyRequested}>
                    {r.alreadyRequested ? 'Pendiente' : 'Agregar'}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Solicitudes */}
      {tab === 'solicitudes' && (
        <div className="space-y-4">
          {pendingIn.length > 0 && (
            <div>
              <h2 className="font-semibold text-sm text-muted mb-2">Recibidas</h2>
              <div className="space-y-2">
                {pendingIn.map(f => (
                  <div key={f.id} className="flex items-center gap-3 bg-surface rounded-xl p-3 border border-primary/10">
                    <Avatar name={f.otherStageName ?? f.other.display_name} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{f.otherStageName ?? f.other.display_name ?? 'Usuario'}</p>
                      <p className="text-xs text-muted">{f.direction === 'received' ? (isOrganizer ? 'Quiere agregarte como artista' : 'Te envió solicitud de amistad') : ''}</p>
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

          {pendingOut.length > 0 && (
            <div>
              <h2 className="font-semibold text-sm text-muted mb-2">Enviadas</h2>
              <div className="space-y-2">
                {pendingOut.map(f => (
                  <div key={f.id} className="flex items-center gap-3 bg-surface rounded-xl p-3 border border-primary/10">
                    <Avatar name={f.otherStageName ?? f.other.display_name} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{f.otherStageName ?? f.other.display_name ?? 'Usuario'}</p>
                      <p className="text-xs text-muted">Esperando respuesta</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => cancelRequest(f.id)}>Cancelar</Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {pendingIn.length === 0 && pendingOut.length === 0 && (
            <p className="text-center text-muted py-8">No hay solicitudes pendientes</p>
          )}
        </div>
      )}

      {/* Siguiendo */}
      {tab === 'siguiendo' && (
        <div className="space-y-2">
          {following.length === 0 && (
            <p className="text-center text-muted py-8">No sigues a nadie todavía</p>
          )}
          {following.map(f => (
            <div key={f.id} className="flex items-center gap-3 bg-surface rounded-xl p-3 border border-primary/10">
              <Avatar name={f.profile.display_name} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{f.profile.display_name ?? 'Usuario'}</p>
                <p className="text-xs text-muted capitalize">{f.type === 'artist' ? 'Artista' : f.type === 'organizer' ? 'Organizador' : 'Usuario'}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => unfollow(f.id)}>Dejar de seguir</Button>
            </div>
          ))}
        </div>
      )}

      {/* Seguidores */}
      {tab === 'seguidores' && (
        <div className="space-y-2">
          {followers.length === 0 && (
            <p className="text-center text-muted py-8">No tienes seguidores todavía</p>
          )}
          {followers.map(f => (
            <div key={f.id} className="flex items-center gap-3 bg-surface rounded-xl p-3 border border-primary/10">
              <Avatar name={f.profile.display_name} />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{f.profile.display_name ?? 'Usuario'}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
