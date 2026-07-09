import { useState, useEffect, type FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useGeolocation } from '@/hooks/useGeolocation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { LocationPicker } from '@/components/events/LocationPicker'

type EventRow = {
  id: string
  title: string
  status: string
  start_date: string
  remaining_capacity: number
  max_capacity: number
}

type Category = { id: string; name: string; slug: string }

export default function Dashboard() {
  const { user } = useAuth()
  const geo = useGeolocation()
  const [role, setRole] = useState<string | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [categoryId, setCategoryId] = useState('')
  const [formData, setFormData] = useState({ title: '', description: '', city: '', address: '', start_date: '', end_date: '', max_capacity: 100, is_free: true, price: 0 })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('user_roles').select('role').eq('user_id', user.id),
      supabase.from('organizers').select('id').eq('user_id', user.id).single(),
      supabase.from('categories').select('id, name, slug').order('name'),
    ]).then(([rolesRes, orgRes, catRes]) => {
      if (rolesRes.data) {
        const r = rolesRes.data.map(x => x.role)
        if (r.includes('organizer')) setRole('organizer')
        else if (r.includes('artist')) setRole('artist')
        else setRole('user')
      }
      if (orgRes.data) {
        supabase.from('events').select('id, title, status, start_date, remaining_capacity, max_capacity')
          .eq('organizer_id', orgRes.data.id).order('start_date', { ascending: false })
          .then(({ data }) => { if (data) setEvents(data) })
      }
      if (catRes.data) setCategories(catRes.data)
      setLoading(false)
    })
  }, [user])

  const handleCreateEvent = async (e: FormEvent) => {
    e.preventDefault()
    if (!location) return
    setSubmitting(true)
    const { data: org } = await supabase.from('organizers').select('id').eq('user_id', user!.id).single()
    if (!org) { setSubmitting(false); return }
    const { error } = await supabase.from('events').insert({
      organizer_id: org.id,
      category_id: categoryId || null,
      title: formData.title,
      description: formData.description,
      city: formData.city,
      address: formData.address,
      start_date: new Date(formData.start_date).toISOString(),
      end_date: new Date(formData.end_date).toISOString(),
      max_capacity: formData.max_capacity,
      is_free: formData.is_free,
      price: formData.is_free ? null : formData.price,
      status: 'draft',
      location: `POINT(${location.lng} ${location.lat})`,
    })
    if (!error) {
      setShowForm(false)
      setLocation(null)
      setCategoryId('')
      setFormData({ title: '', description: '', city: '', address: '', start_date: '', end_date: '', max_capacity: 100, is_free: true, price: 0 })
    }
    setSubmitting(false)
  }

  if (loading) return <LoadingSpinner />
  if (!user) return <p className="text-center text-gray-500 py-16">Inicia sesión para acceder al dashboard</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {role === 'organizer' && (
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancelar' : 'Nuevo evento'}
          </Button>
        )}
      </div>

      {role === 'user' && (
        <div className="bg-indigo-50 rounded-xl p-6 text-center">
          <p className="text-gray-700 mb-4">¿Quieres publicar eventos o gestionar tu perfil de artista?</p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={async () => {
              await supabase.from('user_roles').insert({ user_id: user.id, role: 'organizer' })
              setRole('organizer')
            }}>Ser organizador</Button>
            <Button variant="outline" onClick={async () => {
              await supabase.from('user_roles').insert({ user_id: user.id, role: 'artist' })
              setRole('artist')
            }}>Ser artista</Button>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreateEvent} className="bg-white border border-gray-200 rounded-xl p-6 mb-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Título del evento</label>
              <input type="text" required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
              <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} rows={3} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
              <input type="text" required value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
              <input type="text" required value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha inicio</label>
              <input type="datetime-local" required value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
              <input type="datetime-local" required value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aforo máximo</label>
              <input type="number" required min={1} value={formData.max_capacity} onChange={e => setFormData({...formData, max_capacity: Number(e.target.value)})} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={formData.is_free} onChange={e => setFormData({...formData, is_free: e.target.checked})} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                Gratuito
              </label>
              {!formData.is_free && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio (€)</label>
                  <input type="number" min={0} step={0.01} value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación en el mapa</label>
              <p className="text-xs text-gray-400 mb-2">Haz clic en el mapa o arrastra el marcador para situar el evento</p>
              {geo.position && (
                <LocationPicker center={geo.position} value={location} onChange={setLocation} />
              )}
            </div>
          </div>
          {!location && (
            <p className="text-xs text-red-500">Selecciona una ubicación en el mapa</p>
          )}
          <Button type="submit" loading={submitting} disabled={!location}>Crear evento (borrador)</Button>
        </form>
      )}

      {role === 'organizer' && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Mis eventos</h2>
          {events.length === 0 ? (
            <p className="text-gray-400 text-sm">Aún no has creado ningún evento</p>
          ) : (
            <div className="space-y-2">
              {events.map(e => (
                <div key={e.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-sm">{e.title}</h3>
                    <p className="text-xs text-gray-400">{new Date(e.start_date).toLocaleDateString('es-ES')} · {e.remaining_capacity}/{e.max_capacity} entradas</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                    e.status === 'published' ? 'bg-green-100 text-green-700' :
                    e.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>{e.status}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {role === 'artist' && (
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Mi perfil de artista</h2>
          <p className="text-sm text-gray-500">Completa tu perfil de artista para aparecer en los eventos.</p>
        </section>
      )}
    </div>
  )
}
