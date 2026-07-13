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
      className="block bg-surface rounded-xl border border-primary/10 overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all"
    >
      <div className="aspect-[16/9] bg-primary/10 relative">
        {event.cover_image_url ? (
          <img src={event.cover_image_url} alt={event.title} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-primary/40 text-4xl font-bold">
            {event.title[0]}
          </div>
        )}
        <div className="absolute top-2 left-2 bg-surface/90 backdrop-blur-sm rounded-lg px-2.5 py-1 text-center leading-tight">
          <span className="block text-lg font-bold text-primary">{day}</span>
          <span className="block text-[10px] uppercase text-muted">{month}</span>
        </div>
        {event.is_free && (
          <span className="absolute top-2 right-2 bg-success text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            GRATIS
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-text truncate">{event.title}</h3>
            <p className="text-xs text-muted mt-0.5">{event.city}{event.province ? `, ${event.province}` : ''}</p>
          </div>
          {!event.is_free && event.price && (
            <span className="text-sm font-bold text-primary whitespace-nowrap">{event.price.toFixed(2)} €</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted">
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
