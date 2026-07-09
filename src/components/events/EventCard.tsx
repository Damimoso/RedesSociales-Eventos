import { Link } from 'react-router-dom'
import type { NearbyEvent } from '@/hooks/useEvents'

type Props = {
  event: NearbyEvent
}

export function EventCard({ event }: Props) {
  const date = new Date(event.start_date)
  const day = date.getDate()
  const month = date.toLocaleDateString('es-ES', { month: 'short' })

  return (
    <Link
      to={`/events/${event.id}`}
      className="block bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg hover:border-indigo-200 transition-all"
    >
      <div className="aspect-[16/9] bg-gradient-to-br from-indigo-100 to-purple-100 relative">
        {event.cover_image_url ? (
          <img src={event.cover_image_url} alt={event.title} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-indigo-300 text-4xl font-bold">
            {event.title[0]}
          </div>
        )}
        <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm rounded-lg px-2.5 py-1 text-center leading-tight">
          <span className="block text-lg font-bold text-indigo-600">{day}</span>
          <span className="block text-[10px] uppercase text-gray-500">{month}</span>
        </div>
        {event.is_free && (
          <span className="absolute top-2 right-2 bg-green-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            GRATIS
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{event.title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{event.city}{event.province ? `, ${event.province}` : ''}</p>
          </div>
          {!event.is_free && event.price && (
            <span className="text-sm font-bold text-indigo-600 whitespace-nowrap">{event.price.toFixed(2)} €</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
          <span>{event.organizer_name}</span>
          {event.distance_km && (
            <>
              <span>·</span>
              <span>{event.distance_km.toFixed(1)} km</span>
            </>
          )}
        </div>
      </div>
    </Link>
  )
}
