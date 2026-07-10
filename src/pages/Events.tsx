import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useEventsNearby, type EventFilters } from '@/hooks/useEvents'
import { EventCard } from '@/components/events/EventCard'
import { EventMap } from '@/components/events/EventMap'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Button } from '@/components/ui/Button'

type QuickDate = 'today' | 'weekend' | 'week' | 'month' | ''

export default function Events() {
  const navigate = useNavigate()
  const geo = useGeolocation()
  const [radius, setRadius] = useState(50)
  const [category, setCategory] = useState('')
  const [city, setCity] = useState('')
  const [quickDate, setQuickDate] = useState<QuickDate>('')
  const [customDateFrom, setCustomDateFrom] = useState('')
  const [customDateTo, setCustomDateTo] = useState('')

  const buildFilters = (): EventFilters | undefined => {
    const filters: EventFilters = {}
    if (category) filters.category = category
    if (city) filters.city = city

    if (quickDate === 'today') {
      const d = new Date(); filters.dateFrom = d.toISOString(); d.setHours(23, 59, 59); filters.dateTo = d.toISOString()
    } else if (quickDate === 'weekend') {
      const d = new Date(); filters.dateFrom = d.toISOString()
      d.setDate(d.getDate() + (7 - d.getDay())); d.setHours(23, 59, 59); filters.dateTo = d.toISOString()
    } else if (quickDate === 'week') {
      const d = new Date(); filters.dateFrom = d.toISOString()
      d.setDate(d.getDate() + 7); filters.dateTo = d.toISOString()
    } else if (quickDate === 'month') {
      const d = new Date(); filters.dateFrom = d.toISOString()
      d.setMonth(d.getMonth() + 1); filters.dateTo = d.toISOString()
    } else {
      if (customDateFrom) filters.dateFrom = new Date(customDateFrom).toISOString()
      if (customDateTo) filters.dateTo = new Date(customDateTo).toISOString()
    }

    return Object.keys(filters).length > 0 ? filters : undefined
  }

  const { events, loading } = useEventsNearby(geo.position?.lat, geo.position?.lng, radius, buildFilters())

  const handleEventClick = useCallback((id: string) => navigate(`/events/${id}`), [navigate])

  const categories = [...new Set(events.map(e => e.category_slug).filter((s): s is string => !!s))]

  const cities = [...new Set(events.map(e => e.city))]

  const clearFilters = () => {
    setCategory(''); setCity(''); setQuickDate(''); setCustomDateFrom(''); setCustomDateTo('')
  }

  const hasFilters = category || city || quickDate || customDateFrom || customDateTo

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

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-1">
            {(['today', 'weekend', 'week', 'month'] as const).map(d => (
              <button key={d} onClick={() => setQuickDate(quickDate === d ? '' : d)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                  quickDate === d
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {d === 'today' ? 'Hoy' : d === 'weekend' ? 'Este finde' : d === 'week' ? 'Esta semana' : 'Este mes'}
              </button>
            ))}
          </div>

          <select value={category} onChange={e => setCategory(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todas las categorías</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <select value={city} onChange={e => setCity(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">Todas las ciudades</option>
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={customDateFrom} onChange={e => { setCustomDateFrom(e.target.value); setQuickDate('') }}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <span className="text-gray-400">→</span>
            <input type="date" value={customDateTo} onChange={e => { setCustomDateTo(e.target.value); setQuickDate('') }}
              className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>

          {hasFilters && (
            <button onClick={clearFilters} className="text-xs text-red-500 hover:underline">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {geo.position && (
        <div className="h-[400px] mb-6 rounded-xl overflow-hidden border border-gray-200 relative">
          <EventMap events={events} center={geo.position} onEventClick={handleEventClick} />

          {/* Filtros flotantes sobre el mapa */}
          <div className="absolute top-3 left-3 right-3 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
            <div className="pointer-events-auto flex flex-wrap gap-1 bg-white/90 backdrop-blur-sm rounded-lg p-1.5 shadow-lg border border-white/50">
              {(['today', 'weekend', 'week', 'month'] as const).map(d => (
                <button key={d} onClick={() => setQuickDate(quickDate === d ? '' : d)}
                  className={`text-xs font-medium px-2.5 py-1.5 rounded-md transition-colors ${
                    quickDate === d
                      ? 'bg-[#7C5CFC] text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {d === 'today' ? 'Hoy' : d === 'weekend' ? 'Finde' : d === 'week' ? 'Semana' : 'Mes'}
                </button>
              ))}
            </div>

            <div className="pointer-events-auto bg-white/90 backdrop-blur-sm rounded-lg p-1.5 shadow-lg border border-white/50 flex items-center gap-1">
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="text-xs bg-transparent border-none px-2 py-1.5 rounded focus:outline-none text-gray-600"
              >
                <option value="">Categoría</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="text-gray-300">|</span>
              <select value={city} onChange={e => setCity(e.target.value)}
                className="text-xs bg-transparent border-none px-2 py-1.5 rounded focus:outline-none text-gray-600"
              >
                <option value="">Ciudad</option>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="pointer-events-auto bg-white/90 backdrop-blur-sm rounded-lg p-1.5 shadow-lg border border-white/50 flex items-center gap-1 text-xs">
              <input type="date" value={customDateFrom} onChange={e => { setCustomDateFrom(e.target.value); setQuickDate('') }}
                className="w-28 bg-transparent border-none px-1 py-1.5 rounded focus:outline-none text-gray-600 text-xs" />
              <span className="text-gray-400">→</span>
              <input type="date" value={customDateTo} onChange={e => { setCustomDateTo(e.target.value); setQuickDate('') }}
                className="w-28 bg-transparent border-none px-1 py-1.5 rounded focus:outline-none text-gray-600 text-xs" />
            </div>

            {hasFilters && (
              <button onClick={clearFilters}
                className="pointer-events-auto text-[10px] font-medium bg-red-50 text-red-500 px-2 py-1 rounded-lg hover:bg-red-100 transition-colors border border-red-200">
                Limpiar
              </button>
            )}
          </div>

          {/* Contador de eventos */}
          <div className="absolute bottom-3 right-3 z-10 bg-[#1A1A2E]/80 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
            {events.length} {events.length === 1 ? 'evento' : 'eventos'}
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSpinner />
      ) : events.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400 mb-4">No se encontraron eventos con esos filtros</p>
          {hasFilters && <Button variant="outline" onClick={clearFilters}>Limpiar filtros</Button>}
          {!hasFilters && radius < 200 && (
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
