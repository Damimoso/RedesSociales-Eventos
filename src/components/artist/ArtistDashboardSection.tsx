import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

type Invitation = {
  id: string
  event_id: string
  event_title: string
  event_city: string
  start_date: string
  stage_time: string | null
  status: string
  organizer_name: string
  created_at: string
}

type Props = { userId: string }

export function ArtistDashboardSection({ userId }: Props) {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const { data: artist } = await supabase.from('artists').select('id').eq('user_id', userId).single()
      if (!artist) { setLoading(false); return }
      const { data, error: rpcErr } = await supabase.rpc('get_artist_invitations', { p_artist_id: artist.id })
      if (rpcErr) {
        if (rpcErr.message.includes('Could not find the function')) {
          setError('El sistema de invitaciones no está disponible. Ejecuta migration-artist.sql en Supabase Dashboard.')
        } else {
          setError(rpcErr.message)
        }
        setLoading(false)
        return
      }
      if (data) setInvitations(data as Invitation[])
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('Could not find the function')) {
        setError('El sistema de invitaciones no está disponible. Ejecuta migration-artist.sql en Supabase Dashboard.')
      } else {
        setError(msg)
      }
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  const respond = async (invitationId: string, accept: boolean) => {
    try {
      const { error: rpcErr } = await supabase.rpc('respond_artist_invitation', { p_invitation_id: invitationId, p_accept: accept })
      if (rpcErr) {
        if (rpcErr.message.includes('Could not find the function')) {
          setError('El sistema de invitaciones no está disponible. Ejecuta migration-artist.sql en Supabase Dashboard.')
        } else {
          alert(rpcErr.message)
        }
        return
      }
      setInvitations(prev => prev.map(i => i.id === invitationId ? { ...i, status: accept ? 'accepted' : 'rejected' } : i))
    } catch (err) { alert('Error al responder: ' + (err instanceof Error ? err.message : String(err))) }
  }

  if (loading) return <LoadingSpinner />

  if (error) return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-surface border border-red-500/30 rounded-lg p-6 text-center">
        <p className="text-red-400 text-sm mb-3">{error}</p>
        <Button size="sm" onClick={() => { setLoading(true); load() }}>Reintentar</Button>
      </div>
    </div>
  )

  const pending = invitations.filter(i => i.status === 'pending')
  const accepted = invitations.filter(i => i.status === 'accepted')
  const rejected = invitations.filter(i => i.status === 'rejected')

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text">Panel del Artista</h1>
        <Link to="/profile"><Button variant="outline" size="sm">Mi perfil</Button></Link>
      </div>

      {/* Invitaciones pendientes */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-text mb-4">
          Invitaciones {pending.length > 0 && <span className="text-secondary text-sm">({pending.length} pendientes)</span>}
        </h2>
        {pending.length === 0 ? (
          <p className="text-muted text-sm">No tienes invitaciones pendientes</p>
        ) : (
          <div className="space-y-2">
            {pending.map(inv => (
              <div key={inv.id} className="bg-surface border border-secondary/30 rounded-lg p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-sm text-text">{inv.event_title}</h3>
                    <p className="text-xs text-muted">{new Date(inv.start_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} · {inv.event_city}</p>
                    <p className="text-xs text-muted">Organiza: {inv.organizer_name}</p>
                    {inv.stage_time && <p className="text-xs text-primary">Actuación: {new Date(inv.stage_time).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</p>}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" onClick={() => respond(inv.id, true)}>Aceptar</Button>
                    <Button size="sm" variant="danger" onClick={() => respond(inv.id, false)}>Rechazar</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Próximos eventos confirmados */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold text-text mb-4">Tus próximos eventos</h2>
        {accepted.length === 0 ? (
          <p className="text-muted text-sm">No tienes eventos confirmados</p>
        ) : (
          <div className="space-y-2">
            {accepted.map(inv => (
              <Link key={inv.id} to={`/events/${inv.event_id}`}
                className="block bg-surface border border-primary/10 rounded-lg p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm text-text truncate">{inv.event_title}</h3>
                    <p className="text-xs text-muted">{new Date(inv.start_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} · {inv.event_city}</p>
                  </div>
                  <span className="text-xs text-green-500">✓ Confirmado</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Rechazados */}
      {rejected.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-text mb-4">Rechazados</h2>
          <div className="space-y-2 opacity-50">
            {rejected.map(inv => (
              <div key={inv.id} className="bg-surface border border-primary/10 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-medium text-sm text-text truncate">{inv.event_title}</h3>
                    <p className="text-xs text-muted">{new Date(inv.start_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} · {inv.event_city}</p>
                  </div>
                  <span className="text-xs text-secondary">Rechazado</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
