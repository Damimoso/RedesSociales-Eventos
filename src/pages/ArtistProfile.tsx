import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { FollowButton } from '@/components/events/FollowButton'

type ArtistData = {
  id: string
  user_id: string
  stage_name: string
  bio: string | null
  genre: string[] | null
  social_links: Record<string, string> | null
  website: string | null
  is_verified: boolean
}

type ScheduleItem = {
  event_id: string
  title: string
  cover_image_url: string | null
  city: string
  start_date: string
  end_date: string
  stage_time: string | null
  status: string
  organizer_name: string
}

export default function ArtistProfile() {
  const { id } = useParams<{ id: string }>()
  const { user, roles } = useAuth()
  const [artist, setArtist] = useState<ArtistData | null>(null)
  const [schedule, setSchedule] = useState<ScheduleItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [friendshipStatus, setFriendshipStatus] = useState<'none' | 'pending_sent' | 'pending_received' | 'accepted'>('none')
  const [friendshipId, setFriendshipId] = useState<string | null>(null)

  const [form, setForm] = useState({ stage_name: '', bio: '', website: '', genre: '', spotify: '', youtube: '', instagram: '' })

  const [isOwnerState, setIsOwnerState] = useState(false)
  const viewerRoles = roles ?? []
  const isViewerArtist = viewerRoles.includes('artist')
  const isViewerOrganizer = viewerRoles.includes('organizer')
  const isViewerRegular = !isViewerArtist && !isViewerOrganizer && !viewerRoles.includes('admin')

  useEffect(() => {
    if (!id) return
    let cancelled = false; (async () => {
      try {
        const { data: artistData } = await supabase.from('artists').select('*').eq('id', id).single()
        if (cancelled) return
        if (!artistData) { setLoading(false); return }
        setArtist(artistData as ArtistData)
        setForm({
          stage_name: artistData.stage_name ?? '',
          bio: artistData.bio ?? '',
          website: artistData.website ?? '',
          genre: (artistData.genre ?? []).join(', '),
          spotify: artistData.social_links?.spotify ?? '',
          youtube: artistData.social_links?.youtube ?? '',
          instagram: artistData.social_links?.instagram ?? '',
        })

        if (user && artistData.user_id === user.id) setIsOwnerState(true)

        if (user && artistData.user_id !== user.id && (isViewerArtist || isViewerOrganizer)) {
          const { data: friendshipData } = await supabase.from('friendships')
            .select('id, requester_id, addressee_id, status')
            .in('requester_id', [user.id, artistData.user_id])
            .in('addressee_id', [user.id, artistData.user_id])
            .maybeSingle()
          if (friendshipData) {
            setFriendshipId(friendshipData.id)
            if (friendshipData.status === 'accepted') {
              setFriendshipStatus('accepted')
            } else if (friendshipData.requester_id === user.id) {
              setFriendshipStatus('pending_sent')
            } else {
              setFriendshipStatus('pending_received')
            }
          }
        }

        const { data: schedData } = await supabase.rpc('get_artist_schedule', { p_artist_id: id })
        if (!cancelled && schedData) setSchedule(schedData as ScheduleItem[])
      } catch (err) { console.error('Error loading artist:', err) }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [id, user, isViewerArtist, isViewerOrganizer])

  const handleSave = useCallback(async () => {
    if (!id) return
    setSaving(true)
    const social_links: Record<string, string> = {}
    if (form.spotify) social_links.spotify = form.spotify
    if (form.youtube) social_links.youtube = form.youtube
    if (form.instagram) social_links.instagram = form.instagram

    const { error } = await supabase.from('artists').update({
      stage_name: form.stage_name,
      bio: form.bio || null,
      website: form.website || null,
      genre: form.genre ? form.genre.split(',').map(g => g.trim()).filter(Boolean) : [],
      social_links: Object.keys(social_links).length > 0 ? social_links : null,
    }).eq('id', id)

    if (!error) {
      setArtist(prev => prev ? { ...prev, stage_name: form.stage_name, bio: form.bio || null, website: form.website || null, genre: form.genre ? form.genre.split(',').map(g => g.trim()) : [], social_links: Object.keys(social_links).length > 0 ? social_links : null } : prev)
      setEditing(false)
    }
    setSaving(false)
  }, [id, form])

  const sendFriendshipRequest = async () => {
    if (!user || !artist) return
    const { data } = await supabase.from('friendships').insert({
      requester_id: user.id,
      addressee_id: artist.user_id,
    }).select('id').single()
    if (data) { setFriendshipId(data.id); setFriendshipStatus('pending_sent') }
  }

  const cancelFriendshipRequest = async () => {
    if (!friendshipId) return
    await supabase.from('friendships').delete().eq('id', friendshipId)
    setFriendshipId(null); setFriendshipStatus('none')
  }

  const respondToFriendshipRequest = async (accept: boolean) => {
    if (!friendshipId) return
    await supabase.from('friendships').update({ status: accept ? 'accepted' : 'rejected' }).eq('id', friendshipId)
    setFriendshipStatus(accept ? 'accepted' : 'none')
    if (!accept) setFriendshipId(null)
  }

  if (loading) return <LoadingSpinner />
  if (!artist) return <p className="text-center text-muted py-16">Artista no encontrado</p>

  const socialLinks = artist.social_links ?? {}
  const futureEvents = schedule.filter(e => new Date(e.start_date) >= new Date())
  const pastEvents = schedule.filter(e => new Date(e.start_date) < new Date())

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-gradient-to-br from-surface to-elevated rounded-2xl p-8 border border-primary/20 mb-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold shadow-lg"
              style={{ background: 'linear-gradient(135deg, var(--th-primary, #6366F1), var(--th-secondary, #EC4899))', color: '#fff' }}>
              {artist.stage_name[0].toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-text">{artist.stage_name}</h1>
                {artist.is_verified && <span title="Verificado" className="text-green-500">✓</span>}
              </div>
              {artist.genre && artist.genre.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {artist.genre.map(g => (
                    <span key={g} className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/20 text-primary">{g}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isOwnerState && (
              <Button size="sm" variant="outline" onClick={() => setEditing(!editing)}>
                {editing ? 'Cancelar' : 'Editar perfil'}
              </Button>
            )}
            {!isOwnerState && user && artist.id && (
              isViewerRegular ? (
                <FollowButton followingId={artist.id} followingType="artist" />
              ) : isViewerArtist ? (
                friendshipStatus === 'none' ? (
                  <Button size="sm" onClick={sendFriendshipRequest}>Enviar solicitud</Button>
                ) : friendshipStatus === 'pending_sent' ? (
                  <Button size="sm" variant="secondary" onClick={cancelFriendshipRequest}>Cancelar solicitud</Button>
                ) : friendshipStatus === 'pending_received' ? (
                  <>
                    <Button size="sm" onClick={() => respondToFriendshipRequest(true)}>Aceptar</Button>
                    <Button size="sm" variant="secondary" onClick={() => respondToFriendshipRequest(false)}>Rechazar</Button>
                  </>
                ) : (
                  <Button size="sm" variant="secondary" onClick={cancelFriendshipRequest}>Eliminar amigo</Button>
                )
              ) : (
                // Organizer
                friendshipStatus === 'none' ? (
                  <Button size="sm" onClick={sendFriendshipRequest}>Agregar artista</Button>
                ) : friendshipStatus === 'pending_sent' ? (
                  <Button size="sm" variant="secondary" onClick={cancelFriendshipRequest}>Cancelar solicitud</Button>
                ) : friendshipStatus === 'pending_received' ? (
                  <>
                    <Button size="sm" onClick={() => respondToFriendshipRequest(true)}>Aceptar</Button>
                    <Button size="sm" variant="secondary" onClick={() => respondToFriendshipRequest(false)}>Rechazar</Button>
                  </>
                ) : (
                  <Button size="sm" variant="secondary" onClick={cancelFriendshipRequest}>Quitar artista</Button>
                )
              )
            )}
          </div>
        </div>

        {editing ? (
          <div className="mt-6 space-y-3 border-t border-primary/10 pt-6">
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Nombre artístico</label>
              <input type="text" value={form.stage_name} onChange={e => setForm(f => ({ ...f, stage_name: e.target.value }))}
                className="w-full bg-base border border-primary/10 rounded-lg px-4 py-2 text-text text-sm focus:outline-none focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-muted mb-1">Biografía</label>
              <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                rows={4} className="w-full bg-base border border-primary/10 rounded-lg px-4 py-2 text-text text-sm focus:outline-none focus:border-primary resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Géneros (separados por coma)</label>
                <input type="text" value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}
                  placeholder="pop, rock, jazz"
                  className="w-full bg-base border border-primary/10 rounded-lg px-4 py-2 text-text text-sm focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Web</label>
                <input type="url" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))}
                  placeholder="https://..."
                  className="w-full bg-base border border-primary/10 rounded-lg px-4 py-2 text-text text-sm focus:outline-none focus:border-primary" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Spotify</label>
                <input type="url" value={form.spotify} onChange={e => setForm(f => ({ ...f, spotify: e.target.value }))}
                  placeholder="https://open.spotify.com/..."
                  className="w-full bg-base border border-primary/10 rounded-lg px-4 py-2 text-text text-sm focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">YouTube</label>
                <input type="url" value={form.youtube} onChange={e => setForm(f => ({ ...f, youtube: e.target.value }))}
                  placeholder="https://youtube.com/@..."
                  className="w-full bg-base border border-primary/10 rounded-lg px-4 py-2 text-text text-sm focus:outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted mb-1">Instagram</label>
                <input type="url" value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))}
                  placeholder="https://instagram.com/..."
                  className="w-full bg-base border border-primary/10 rounded-lg px-4 py-2 text-text text-sm focus:outline-none focus:border-primary" />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} loading={saving}>Guardar cambios</Button>
            </div>
          </div>
        ) : (
          <>
            {artist.bio && <p className="text-muted mt-4 text-sm leading-relaxed">{artist.bio}</p>}

            {(artist.website || Object.keys(socialLinks).length > 0) && (
              <div className="flex flex-wrap gap-3 mt-4">
                {artist.website && (
                  <a href={artist.website} target="_blank" rel="noopener noreferrer"
                    className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-muted hover:bg-primary/20 hover:text-text transition-colors">
                    🌐 Web
                  </a>
                )}
                {socialLinks.spotify && (
                  <a href={socialLinks.spotify} target="_blank" rel="noopener noreferrer"
                    className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#1DB954]/20 text-[#1DB954] hover:bg-[#1DB954]/30 transition-colors">
                    Spotify
                  </a>
                )}
                {socialLinks.youtube && (
                  <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer"
                    className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#FF0000]/20 text-[#FF4444] hover:bg-[#FF0000]/30 transition-colors">
                    YouTube
                  </a>
                )}
                {socialLinks.instagram && (
                  <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer"
                    className="text-xs flex items-center gap-1 px-3 py-1.5 rounded-full bg-[#E4405F]/20 text-[#E4405F] hover:bg-[#E4405F]/30 transition-colors">
                    Instagram
                  </a>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Próximos eventos */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text">Próximos eventos</h2>
          <Link to={`/artist/${id}/calendar`}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            Calendario
          </Link>
        </div>
        {futureEvents.length === 0 ? (
          <p className="text-muted text-sm">No hay eventos próximos</p>
        ) : (
          <div className="space-y-2">
            {futureEvents.map(e => (
              <Link key={e.event_id} to={`/events/${e.event_id}`}
                className="block bg-surface border border-primary/10 rounded-lg p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-3">
                  {e.cover_image_url && <img src={e.cover_image_url} alt="" className="w-12 h-12 rounded-lg object-cover" />}
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm text-text truncate">{e.title}</h3>
                    <p className="text-xs text-muted">{new Date(e.start_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} · {e.city}</p>
                    {e.stage_time && <p className="text-xs text-primary">Actuación: {new Date(e.stage_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>}
                  </div>
                  <span className="text-xs text-muted">{e.organizer_name}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Eventos pasados */}
      {pastEvents.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-text mb-4">Eventos anteriores</h2>
          <div className="space-y-2 opacity-60">
            {pastEvents.slice(0, 5).map(e => (
              <Link key={e.event_id} to={`/events/${e.event_id}`}
                className="block bg-surface border border-primary/10 rounded-lg p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm text-text truncate">{e.title}</h3>
                    <p className="text-xs text-muted">{new Date(e.start_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} · {e.city}</p>
                  </div>
                  <span className="text-xs text-muted">{e.organizer_name}</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
