import { useParams, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

type EventDetail = {
  id: string
  title: string
  description: string | null
  short_description: string | null
  cover_image_url: string | null
  address: string
  city: string
  province: string | null
  country: string
  start_date: string
  end_date: string
  is_free: boolean
  price: number | null
  currency: string
  max_capacity: number
  remaining_capacity: number
  tags: string[] | null
  organizer_name: string
  category_name: string | null
}

export default function EventDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    supabase.from('events').select(`
      id, title, description, short_description, cover_image_url,
      address, city, province, country,
      start_date, end_date, is_free, price, currency,
      max_capacity, remaining_capacity, tags,
      organizer:organizer_id(org_name),
      category:category_id(name)
    `).eq('id', id).single().then(({ data, error }) => {
      if (!error && data) {
        const d = data as any
        setEvent({
          id: d.id,
          title: d.title,
          description: d.description,
          short_description: d.short_description,
          cover_image_url: d.cover_image_url,
          address: d.address,
          city: d.city,
          province: d.province,
          country: d.country,
          start_date: d.start_date,
          end_date: d.end_date,
          is_free: d.is_free,
          price: d.price,
          currency: d.currency,
          max_capacity: d.max_capacity,
          remaining_capacity: d.remaining_capacity,
          tags: d.tags,
          organizer_name: d.organizer?.org_name ?? 'Desconocido',
          category_name: d.category?.name ?? null,
        })
      }
      setLoading(false)
    })
  }, [id])

  if (loading) return <LoadingSpinner size="lg" />
  if (!event) return <p className="text-center text-gray-500 py-16">Evento no encontrado</p>

  const startDate = new Date(event.start_date)
  const endDate = new Date(event.end_date)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="aspect-[2/1] rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 overflow-hidden mb-6">
        {event.cover_image_url ? (
          <img src={event.cover_image_url} alt={event.title} className="w-full h-full object-cover" />
        ) : (
          <div className="flex items-center justify-center h-full text-indigo-300 text-6xl font-bold">
            {event.title[0]}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{event.title}</h1>
              {event.category_name && (
                <span className="inline-block mt-1 text-xs font-medium bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full">
                  {event.category_name}
                </span>
              )}
            </div>
            <div className="text-right">
              {event.is_free ? (
                <span className="text-lg font-bold text-green-600">GRATIS</span>
              ) : (
                <span className="text-2xl font-bold text-indigo-600">{event.price?.toFixed(2)} {event.currency}</span>
              )}
            </div>
          </div>
          <p className="text-gray-500 text-sm mt-1">Organizado por {event.organizer_name}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-400 text-xs">Fecha</p>
            <p className="font-medium">{startDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
            <p className="text-gray-500">{startDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}{endDate > startDate ? ` — ${endDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}` : ''}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-gray-400 text-xs">Ubicación</p>
            <p className="font-medium">{event.address}</p>
            <p className="text-gray-500">{event.city}{event.province ? `, ${event.province}` : ''}</p>
          </div>
        </div>

        {event.description && (
          <div>
            <h2 className="font-semibold text-gray-900 mb-2">Descripción</h2>
            <p className="text-gray-600 whitespace-pre-line text-sm">{event.description}</p>
          </div>
        )}

        {event.tags && event.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {event.tags.map(t => (
              <span key={t} className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">#{t}</span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 text-sm text-gray-500 border-t border-gray-100 pt-4">
          <span>Aforo: {event.remaining_capacity}/{event.max_capacity}</span>
        </div>

        {user ? (
          event.remaining_capacity > 0 ? (
            <Button size="lg" className="w-full">Comprar entradas</Button>
          ) : (
            <Button size="lg" className="w-full" disabled>Completado</Button>
          )
        ) : (
          <Link to="/login">
            <Button size="lg" className="w-full">Inicia sesión para comprar</Button>
          </Link>
        )}
      </div>
    </div>
  )
}
