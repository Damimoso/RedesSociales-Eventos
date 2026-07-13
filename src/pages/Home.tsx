import { useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useEventsNearby, useFeed } from '@/hooks/useEvents'
import { useAuth } from '@/contexts/AuthContext'
import { EventCard } from '@/components/events/EventCard'
import { EventMap } from '@/components/events/EventMap'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Button } from '@/components/ui/Button'
import { StreakBadge } from '@/components/gamification/StreakBadge'
import { OnboardingMockup } from '@/components/gamification/OnboardingMockup'

export default function Home() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const geo = useGeolocation()

  const { events, loading } = useEventsNearby(geo.position?.lat, geo.position?.lng)
  const { events: feed } = useFeed()
  const handleEventClick = useCallback((id: string) => navigate(`/events/${id}`), [navigate])

  if (!user) return <OnboardingMockup />

  if (geo.loading) {
    return (
      <div className="text-center py-20">
        <LoadingSpinner size="lg" />
        <p className="text-muted mt-4">Buscando eventos cerca de ti...</p>
      </div>
    )
  }

  const free = events.filter(e => e.is_free)

  return (
    <div className="space-y-10">
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-text">Eventos cercanos</h2>
            <StreakBadge />
          </div>
          <span className="text-xs text-muted">Radio 25 km</span>
        </div>

        {geo.position && (
          <div className="h-[300px] mb-6 rounded-xl overflow-hidden border border-primary/10">
            <EventMap events={events} center={geo.position} onEventClick={handleEventClick} />
          </div>
        )}

        {loading ? (
          <LoadingSpinner />
        ) : events.length === 0 ? (
          <p className="text-muted text-sm text-center">No hay eventos cerca. <Link to="/events" className="text-primary underline">Explorar todos</Link></p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.slice(0, 6).map(e => <EventCard key={e.id} event={e} />)}
          </div>
        )}
      </section>

      {free.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-text mb-4">Gratis hoy</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {free.slice(0, 3).map(e => <EventCard key={e.id} event={e} />)}
          </div>
        </section>
      )}

      {feed.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-text">Siguiendo</h2>
            <span className="text-xs text-muted">Eventos de tus artistas y organizadores</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {feed.slice(0, 6).map(e => <EventCard key={e.id} event={{...e, short_description: e.short_description ?? '', province: null, distance_km: 0, lat: 0, lng: 0, category_name: null, max_capacity: 0, remaining_capacity: 0, currency: 'EUR', end_date: e.end_date}} />)}
          </div>
        </section>
      )}

      {events.length > 6 && (
        <div className="text-center">
          <Link to="/events"><Button variant="outline">Ver todos los eventos</Button></Link>
        </div>
      )}
    </div>
  )
}
