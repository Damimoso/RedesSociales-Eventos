import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useEventsNearby } from '@/hooks/useEvents'
import { EventCard } from '@/components/events/EventCard'
import { EventMap } from '@/components/events/EventMap'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Button } from '@/components/ui/Button'

export default function Events() {
  const navigate = useNavigate()
  const geo = useGeolocation()
  const [radius, setRadius] = useState(50)
  const { events, loading } = useEventsNearby(geo.position?.lat, geo.position?.lng, radius)

  const handleEventClick = useCallback((id: string) => navigate(`/events/${id}`), [navigate])

  const categories = [...new Set(events.map(e => e.category_name).filter(Boolean))]

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold">Explorar eventos</h1>
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">Radio:</label>
          <select
            value={radius}
            onChange={e => setRadius(Number(e.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value={10}>10 km</option>
            <option value={25}>25 km</option>
            <option value={50}>50 km</option>
            <option value={100}>100 km</option>
            <option value={200}>200 km</option>
          </select>
        </div>
      </div>

      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {categories.map(c => (
            <span key={c} className="bg-indigo-50 text-indigo-700 text-xs font-medium px-3 py-1 rounded-full">
              {c}
            </span>
          ))}
        </div>
      )}

      {geo.position && (
        <div className="h-[300px] mb-6 rounded-xl overflow-hidden border border-gray-200">
          <EventMap events={events} center={geo.position} onEventClick={handleEventClick} />
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : events.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-4">No se encontraron eventos en este radio</p>
          {radius < 200 && (
            <Button variant="outline" onClick={() => setRadius(200)}>Ampliar radio a 200 km</Button>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-400 mb-4">{events.length} eventos encontrados</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map(e => <EventCard key={e.id} event={e} />)}
          </div>
        </>
      )}
    </div>
  )
}
