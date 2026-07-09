import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { FollowButton } from '@/components/events/FollowButton'
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY ?? '')

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
  organizer_id: string
  category_name: string | null
}

type TicketTier = {
  id: string
  name: string
  price_cents: number
  quantity: number
  remaining: number
}

const centsToEur = (c: number) => (c / 100).toFixed(2)

export default function EventDetail() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [tiers, setTiers] = useState<TicketTier[]>([])
  const [selectedTierId, setSelectedTierId] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [buyError, setBuyError] = useState('')

  const pagoOk = searchParams.get('pago') === 'ok'

  useEffect(() => {
    if (!id) return
    Promise.all([
      supabase.from('events').select(`
        id, title, description, short_description, cover_image_url,
        address, city, province, country,
        start_date, end_date, is_free, price, currency,
        max_capacity, remaining_capacity, tags,
        organizer:organizer_id(org_name),
        category:category_id(name)
      `).eq('id', id).single(),
      supabase.from('ticket_tiers').select('id, name, price_cents, quantity, remaining')
        .eq('event_id', id).order('price_cents', { ascending: true }),
    ]).then(([eventRes, tiersRes]) => {
      if (!eventRes.error && eventRes.data) {
        const d = eventRes.data as any
        setEvent({
          id: d.id, title: d.title, description: d.description, short_description: d.short_description,
          cover_image_url: d.cover_image_url, address: d.address, city: d.city, province: d.province,
          country: d.country, start_date: d.start_date, end_date: d.end_date, is_free: d.is_free,
          price: d.price, currency: d.currency, max_capacity: d.max_capacity, remaining_capacity: d.remaining_capacity,
          tags: d.tags, organizer_name: d.organizer?.org_name ?? 'Desconocido', organizer_id: d.organizer_id, category_name: d.category?.name ?? null,
        })
      }
      if (!tiersRes.error && tiersRes.data) {
        setTiers(tiersRes.data)
        if (tiersRes.data.length > 0) setSelectedTierId(tiersRes.data[0].id)
      }
      setLoading(false)
    })
  }, [id])

  const selectedTier = tiers.find(t => t.id === selectedTierId)
  const totalCents = selectedTier ? selectedTier.price_cents * quantity : 0

  const handleBuy = async () => {
    if (!selectedTierId || !user || !event) return
    setBuyError('')
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { tier_id: selectedTierId, quantity, user_id: user.id },
      })
      if (error) throw new Error(error.message || 'Error al crear el pago')
      if (data?.client_secret) setClientSecret(data.client_secret)
      else throw new Error('No se recibió client_secret')
    } catch (err: any) { setBuyError(err.message) }
  }

  if (loading) return <LoadingSpinner size="lg" />
  if (!event) return <p className="text-center text-gray-500 py-16">Evento no encontrado</p>

  const startDate = new Date(event.start_date)
  const endDate = new Date(event.end_date)

  return (
    <div className="max-w-3xl mx-auto">
      {pagoOk && (
        <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-4 mb-6 flex items-center justify-between">
          <span>¡Pago realizado con éxito!</span>
          <Link to="/tickets" className="font-medium underline hover:text-green-800">Ver mi entrada</Link>
        </div>
      )}

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
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-500 text-sm">Organizado por {event.organizer_name}</p>
            <FollowButton followingId={event.organizer_id} followingType="organizer" />
          </div>
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

        {/* Ticket tiers */}
        {tiers.length > 0 && user && !clientSecret && (
          <div className="border-t border-gray-100 pt-6">
            <h2 className="font-semibold text-gray-900 mb-3">Selecciona tus entradas</h2>
            <div className="space-y-2 mb-4">
              {tiers.map(tier => {
                const soldOut = tier.remaining === 0
                return (
                  <label key={tier.id}
                    className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedTierId === tier.id
                        ? 'border-indigo-400 bg-indigo-50'
                        : soldOut ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed' : 'border-gray-200 hover:border-indigo-200'
                    }`}
                  >
                    <input type="radio" name="tier" value={tier.id} checked={selectedTierId === tier.id}
                      onChange={() => { setSelectedTierId(tier.id); setQuantity(1) }}
                      disabled={soldOut} className="accent-indigo-600" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{tier.name}</p>
                      <p className="text-xs text-gray-400">{tier.remaining}/{tier.quantity} disponibles</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-indigo-600">{centsToEur(tier.price_cents)} €</p>
                      {soldOut && <p className="text-xs text-red-500">Agotado</p>}
                    </div>
                  </label>
                )
              })}
            </div>

            {selectedTier && selectedTier.remaining > 0 && (
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center border border-gray-300 rounded-lg">
                  <button type="button" onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 text-sm leading-none">−</button>
                  <span className="px-4 py-1.5 text-sm font-medium border-x border-gray-300">{quantity}</span>
                  <button type="button" onClick={() => setQuantity(Math.min(selectedTier.remaining, quantity + 1))}
                    className="px-3 py-1.5 text-gray-600 hover:bg-gray-100 text-sm leading-none">+</button>
                </div>
                <p className="text-sm text-gray-500">Total: <span className="font-bold text-indigo-600">{centsToEur(totalCents)} €</span></p>
              </div>
            )}

            {buyError && <p className="text-red-500 text-sm mb-2">{buyError}</p>}
            <Button onClick={handleBuy} size="lg" className="w-full"
              disabled={!selectedTier || selectedTier.remaining === 0 || quantity < 1}>
              Comprar {quantity > 1 ? `${quantity} entradas` : 'entrada'} — {centsToEur(totalCents)} €
            </Button>
          </div>
        )}

        {clientSecret && (
          <div className="border-t border-gray-100 pt-6">
            <h2 className="font-semibold text-gray-900 mb-3">Finalizar pago</h2>
            <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        )}

        {!user && (
          <Link to={`/login?redirect=/events/${event.id}`}>
            <Button size="lg" className="w-full">Inicia sesión para comprar entradas</Button>
          </Link>
        )}

        {tiers.length === 0 && user && (
          <div className="border-t border-gray-100 pt-6">
            <p className="text-sm text-gray-400">Este evento aún no tiene entradas a la venta.</p>
          </div>
        )}

        <div className="flex items-center gap-4 text-sm text-gray-500 border-t border-gray-100 pt-4">
          <span>Aforo: {event.remaining_capacity}/{event.max_capacity}</span>
        </div>
      </div>
    </div>
  )
}
