import { useState, useEffect, type FormEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useGeolocation } from '@/hooks/useGeolocation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { LocationPicker } from '@/components/events/LocationPicker'

type Tab = 'eventos' | 'entradas' | 'pagos' | 'ventas'
type EventRow = { id: string; title: string; status: string; start_date: string; remaining_capacity: number; max_capacity: number }
type Category = { id: string; name: string; slug: string }
type TicketTier = { id: string; event_id: string; name: string; price_cents: number; quantity: number; remaining: number; created_at: string }
type EventOption = { id: string; title: string }
type OrganizerRow = { id: string; stripe_account_id: string | null; stripe_onboarding_complete: boolean; bank_holder: string | null; bank_iban: string | null; bank_swift: string | null }
type SalesRow = { event_id: string; event_title: string; total_tickets: number; gross_cents: number; fee_cents: number; net_cents: number; currency: string }

const tabs: { key: Tab; label: string }[] = [
  { key: 'eventos', label: 'Eventos' },
  { key: 'entradas', label: 'Entradas' },
  { key: 'pagos', label: 'Pagos' },
  { key: 'ventas', label: 'Ventas' },
]

const centsToEur = (c: number) => (c / 100).toFixed(2)

export default function Dashboard() {
  const { user } = useAuth()
  const geo = useGeolocation()
  const [activeTab, setActiveTab] = useState<Tab>('eventos')
  const [role, setRole] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)

  // ——— Eventos tab ———
  const [events, setEvents] = useState<EventRow[]>([])
  const [showEventForm, setShowEventForm] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [categoryId, setCategoryId] = useState('')
  const [formData, setFormData] = useState({ title: '', description: '', city: '', address: '', start_date: '', end_date: '', max_capacity: 100, is_free: true, price: 0 })
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  // ——— Entradas tab ———
  const [myEvents, setMyEvents] = useState<EventOption[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [tierName, setTierName] = useState('')
  const [tierPriceEur, setTierPriceEur] = useState('')
  const [tierQty, setTierQty] = useState('')
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([])
  const [creatingTier, setCreatingTier] = useState(false)

  // ——— Pagos tab ———
  const [organizer, setOrganizer] = useState<OrganizerRow | null>(null)
  const [stripeLoading, setStripeLoading] = useState(false)
  const [stripeError, setStripeError] = useState('')
  const [bankHolder, setBankHolder] = useState('')
  const [bankIban, setBankIban] = useState('')
  const [bankSwift, setBankSwift] = useState('')
  const [savingBank, setSavingBank] = useState(false)
  const [bankSaved, setBankSaved] = useState(false)
  const [ibanError, setIbanError] = useState('')

  // ——— Ventas tab ———
  const [sales, setSales] = useState<SalesRow[]>([])
  const [loadingSales, setLoadingSales] = useState(false)

  // ===== LOAD =====
  useEffect(() => {
    if (!user) return
    const load = async () => {
      const [rolesRes, orgRes, catRes] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', user.id),
        supabase.from('organizers').select('id').eq('user_id', user.id).maybeSingle(),
        supabase.from('categories').select('id, name, slug').order('name'),
      ])
      if (rolesRes.data) {
        const r = rolesRes.data.map(x => x.role)
        if (r.includes('organizer')) setRole('organizer')
        else if (r.includes('artist')) setRole('artist')
        else setRole('user')
      }
      if (orgRes.data) {
        setOrgId(orgRes.data.id)
        const { data: evts } = await supabase.from('events').select('id, title, status, start_date, remaining_capacity, max_capacity').eq('organizer_id', orgRes.data.id).order('start_date', { ascending: false })
        if (evts) setEvents(evts)
      }
      if (catRes.data) setCategories(catRes.data)
      setLoading(false)
    }
    load()
  }, [user])

  // ===== CREATE EVENT =====
  const handleCreateEvent = async (e: FormEvent) => {
    e.preventDefault()
    if (!location || !orgId) return
    setSubmitting(true)
    const { error } = await supabase.from('events').insert({
      organizer_id: orgId, category_id: categoryId || null, title: formData.title, description: formData.description,
      city: formData.city, address: formData.address, start_date: new Date(formData.start_date).toISOString(),
      end_date: new Date(formData.end_date).toISOString(), max_capacity: formData.max_capacity,
      is_free: formData.is_free, price: formData.is_free ? null : formData.price,
      status: 'draft', location: `POINT(${location.lng} ${location.lat})`,
    })
    if (!error) { setShowEventForm(false); setLocation(null); setCategoryId(''); setFormData({ title: '', description: '', city: '', address: '', start_date: '', end_date: '', max_capacity: 100, is_free: true, price: 0 }) }
    setSubmitting(false)
  }

  // ===== TIERS =====
  useEffect(() => {
    if (!orgId || activeTab !== 'entradas') return
    supabase.from('events').select('id, title').eq('organizer_id', orgId).eq('status', 'published').then(({ data }) => { if (data) setMyEvents(data) })
    supabase.from('ticket_tiers').select('*, events!inner(organizer_id)').eq('events.organizer_id', orgId).order('created_at', { ascending: false }).then(({ data }) => { if (data) setTicketTiers(data as unknown as TicketTier[]) })
  }, [orgId, activeTab])

  const handleCreateTier = async (e: FormEvent) => {
    e.preventDefault()
    if (!selectedEventId || !tierName || !tierPriceEur || !tierQty) return
    setCreatingTier(true)
    const priceCents = Math.round(parseFloat(tierPriceEur) * 100)
    const { error } = await supabase.from('ticket_tiers').insert({
      event_id: selectedEventId, name: tierName, price_cents: priceCents, quantity: parseInt(tierQty, 10),
    })
    if (!error) { setSelectedEventId(''); setTierName(''); setTierPriceEur(''); setTierQty('') }
    setCreatingTier(false)
  }

  // ===== STRIPE CONNECT ONBOARDING =====
  useEffect(() => {
    if (!user || activeTab !== 'pagos') return
    supabase.from('organizers').select('id, stripe_account_id, stripe_onboarding_complete, bank_holder, bank_iban, bank_swift').eq('user_id', user.id).single().then(({ data }) => { if (data) setOrganizer(data) })
  }, [user, activeTab])

  const handleStripeConnect = async () => {
    setStripeLoading(true); setStripeError('')
    try {
      const { data, error } = await supabase.functions.invoke('create-connect-account', {
        body: { organizer_id: orgId, email: user!.email, org_name: organizer?.bank_holder || user!.user_metadata?.full_name || 'Organizador' },
      })
      if (error) throw new Error(error.message || 'Error al conectar con Stripe')
      if (data?.url) window.location.href = data.url
      else throw new Error('No se recibió URL de onboarding')
    } catch (err: any) { setStripeError(err.message) }
    setStripeLoading(false)
  }

  // ===== IBAN validation =====
  const validateIban = (iban: string) => {
    if (!iban) return ''
    const clean = iban.replace(/\s/g, '').toUpperCase()
    if (clean.length < 15 || clean.length > 34) return 'El IBAN debe tener entre 15 y 34 caracteres'
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(clean)) return 'Formato de IBAN inválido'
    // Algoritmo de verificación: mover los primeros 4 caracteres al final y convertir a números
    const rearranged = clean.slice(4) + clean.slice(0, 4)
    let numeric = ''
    for (const ch of rearranged) {
      if (ch >= 'A' && ch <= 'Z') numeric += (ch.charCodeAt(0) - 55).toString()
      else numeric += ch
    }
    let remainder = 0
    for (let i = 0; i < numeric.length; i++) remainder = (remainder * 10 + parseInt(numeric[i])) % 97
    return remainder !== 1 ? 'IBAN inválido (checksum incorrecto)' : ''
  }

  // ===== SAVE BANK (fallback manual) =====
  const handleSaveBank = async (e: FormEvent) => {
    e.preventDefault()
    const ibanErr = validateIban(bankIban)
    setIbanError(ibanErr)
    if (ibanErr) return
    setSavingBank(true)
    const { error } = await supabase.from('organizers').update({
      bank_holder: bankHolder, bank_iban: bankIban.replace(/\s/g, '').toUpperCase(), bank_swift: bankSwift,
    }).eq('user_id', user!.id)
    if (!error) setBankSaved(true)
    setSavingBank(false)
  }

  // ===== SALES =====
  useEffect(() => {
    if (!orgId || activeTab !== 'ventas') return
    setLoadingSales(true)
    supabase.rpc('get_organizer_sales', { p_organizer_id: orgId }).then(({ data }) => { if (data) setSales(data); setLoadingSales(false) })
  }, [orgId, activeTab])

  // ===== GUARDS =====
  if (loading) return <LoadingSpinner />
  if (!user) return <p className="text-center text-gray-500 py-16">Inicia sesión para acceder al dashboard</p>

  if (role !== 'organizer') {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h1 className="text-2xl font-bold mb-4">Acceso restringido</h1>
        <p className="text-gray-500 mb-6">Solo los organizadores pueden gestionar entradas y cobros.</p>
        {role === 'user' && <Button onClick={async () => { await supabase.from('user_roles').insert({ user_id: user.id, role: 'organizer' }); setRole('organizer') }}>Solicitar ser organizador</Button>}
      </div>
    )
  }

  // ===== TAB NAV =====
  const renderTabNav = () => (
    <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
      {tabs.map(t => (
        <button key={t.key} onClick={() => setActiveTab(t.key)}
          className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >{t.label}</button>
      ))}
    </div>
  )

  // ===== TAB: EVENTOS =====
  const renderEventos = () => (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Mis eventos</h2>
        <Button onClick={() => setShowEventForm(!showEventForm)}>{showEventForm ? 'Cancelar' : 'Nuevo evento'}</Button>
      </div>
      {showEventForm && (
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
              <input type="datetime-local" required value={formData.start_date} onChange={e => setFormData({...formData, start_date: e.target.value})} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fecha fin</label>
              <input type="datetime-local" required value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aforo máximo</label>
              <input type="number" required min={1} value={formData.max_capacity} onChange={e => setFormData({...formData, max_capacity: Number(e.target.value)})} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={formData.is_free} onChange={e => setFormData({...formData, is_free: e.target.checked})} className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                Gratuito
              </label>
              {!formData.is_free && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Precio (€)</label>
                  <input type="number" min={0} step={0.01} value={formData.price} onChange={e => setFormData({...formData, price: Number(e.target.value)})} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
                </div>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación en el mapa</label>
              <p className="text-xs text-gray-400 mb-2">Haz clic en el mapa o arrastra el marcador</p>
              {geo.position && <LocationPicker center={geo.position} value={location} onChange={setLocation} />}
            </div>
          </div>
          {!location && <p className="text-xs text-red-500">Selecciona una ubicación en el mapa</p>}
          <Button type="submit" loading={submitting} disabled={!location}>Crear evento (borrador)</Button>
        </form>
      )}
      {events.length === 0 ? <p className="text-gray-400 text-sm">Aún no has creado ningún evento</p> : (
        <div className="space-y-2">
          {events.map(e => (
            <div key={e.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
              <div>
                <h3 className="font-medium text-sm">{e.title}</h3>
                <p className="text-xs text-gray-400">{new Date(e.start_date).toLocaleDateString('es-ES')} · {e.remaining_capacity}/{e.max_capacity} entradas</p>
              </div>
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${e.status === 'published' ? 'bg-green-100 text-green-700' : e.status === 'draft' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>{e.status}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )

  // ===== TAB: ENTRADAS (precios en céntimos) =====
  const renderEntradas = () => (
    <>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Crear tipo de entrada</h2>
      <form onSubmit={handleCreateTier} className="bg-white border border-gray-200 rounded-xl p-6 mb-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Evento</label>
            <select required value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm">
              <option value="">Seleccionar evento...</option>
              {myEvents.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
            </select>
            {myEvents.length === 0 && <p className="text-xs text-gray-400 mt-1">No tienes eventos publicados.</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la entrada</label>
            <input type="text" required placeholder="Ej: General, VIP, Early Bird" value={tierName} onChange={e => setTierName(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Precio (€)</label>
            <input type="number" required min={0} step={0.01} placeholder="0.00" value={tierPriceEur} onChange={e => setTierPriceEur(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <p className="text-xs text-gray-400 mt-1">Se guardará como {Math.round(parseFloat(tierPriceEur || '0') * 100)} céntimos</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad disponible</label>
            <input type="number" required min={1} placeholder="100" value={tierQty} onChange={e => setTierQty(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          </div>
        </div>
        <Button type="submit" loading={creatingTier} disabled={!selectedEventId || !tierName || !tierPriceEur || !tierQty}>Crear entrada</Button>
      </form>

      <h3 className="text-md font-semibold text-gray-900 mb-3">Entradas creadas</h3>
      {ticketTiers.length === 0 ? <p className="text-gray-400 text-sm">Aún no has creado tipos de entrada</p> : (
        <div className="space-y-2">
          {ticketTiers.map(t => (
            <div key={t.id} className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between">
              <div>
                <h4 className="font-medium text-sm">{t.name}</h4>
                <p className="text-xs text-gray-400">{centsToEur(t.price_cents)} € · {t.remaining}/{t.quantity} disponibles</p>
              </div>
              <span className="text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString('es-ES')}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )

  // ===== TAB: PAGOS (Stripe Connect + fallback IBAN) =====
  const renderPagos = () => (
    <>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuración de pagos</h2>
      <p className="text-sm text-gray-500 mb-6">
        Conecta con Stripe para recibir los pagos de tus entradas de forma automática.
        Stripe dividirá el importe: <strong>7% para la plataforma</strong>, <strong>93% para tu cuenta</strong>.
      </p>

      {/* Stripe Connect */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        {organizer?.stripe_account_id && organizer?.stripe_onboarding_complete ? (
          <div className="flex items-center gap-3 text-green-700">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <div>
              <p className="font-medium">Stripe Connect conectado</p>
              <p className="text-xs text-gray-500">ID: {organizer.stripe_account_id}</p>
            </div>
          </div>
        ) : organizer?.stripe_account_id ? (
          <div>
            <div className="flex items-center gap-3 text-yellow-600 mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              <p className="text-sm">Onboarding pendiente. Completa el registro en Stripe.</p>
            </div>
            <Button onClick={handleStripeConnect} loading={stripeLoading}>Continuar onboarding en Stripe</Button>
          </div>
        ) : (
          <div>
            {stripeError && <p className="text-red-500 text-sm mb-3">{stripeError}</p>}
            <Button onClick={handleStripeConnect} loading={stripeLoading}>Conectar con Stripe</Button>
            <p className="text-xs text-gray-400 mt-2">Serás redirigido a Stripe para completar el registro.</p>
          </div>
        )}
      </div>

      {/* Fallback: Datos bancarios manuales (hasta que Stripe Connect esté operativo) */}
      <details className="mt-6">
        <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">O introducir datos bancarios manualmente</summary>
        {bankSaved && <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg p-4 mt-4 mb-4">Datos bancarios guardados.</div>}
        <form onSubmit={handleSaveBank} className="bg-white border border-gray-200 rounded-xl p-6 mt-4 space-y-4 max-w-lg">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titular de la cuenta</label>
            <input type="text" required value={bankHolder} onChange={e => setBankHolder(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Nombre / Razón social" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
            <input type="text" required value={bankIban} onChange={e => { setBankIban(e.target.value); setIbanError('') }} className={`w-full rounded-lg border px-3 py-2 text-sm ${ibanError ? 'border-red-400' : 'border-gray-300'}`} placeholder="ES00 0000 0000 0000 0000 0000" />
            {ibanError && <p className="text-xs text-red-500 mt-1">{ibanError}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">BIC / SWIFT</label>
            <input type="text" required value={bankSwift} onChange={e => setBankSwift(e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="BICXXXYY" />
          </div>
          <Button type="submit" loading={savingBank}>Guardar datos bancarios</Button>
        </form>
      </details>
    </>
  )

  // ===== TAB: VENTAS (céntimos → EUR) =====
  const renderVentas = () => (
    <>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Historial de ventas</h2>
      {loadingSales ? <LoadingSpinner /> : sales.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-2">Aún no tienes ventas</p>
          <p className="text-xs text-gray-400">Las ventas aparecerán aquí cuando los usuarios compren entradas.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-2 font-medium text-gray-500">Evento</th>
                <th className="text-right py-3 px-2 font-medium text-gray-500">Entradas</th>
                <th className="text-right py-3 px-2 font-medium text-gray-500">Bruto</th>
                <th className="text-right py-3 px-2 font-medium text-gray-500">Comisión (7%)</th>
                <th className="text-right py-3 px-2 font-medium text-gray-500">Neto</th>
              </tr>
            </thead>
            <tbody>
              {sales.map(s => (
                <tr key={s.event_id} className="border-b border-gray-100">
                  <td className="py-3 px-2 font-medium">{s.event_title}</td>
                  <td className="py-3 px-2 text-right">{s.total_tickets}</td>
                  <td className="py-3 px-2 text-right">{centsToEur(s.gross_cents)} {s.currency}</td>
                  <td className="py-3 px-2 text-right text-red-500">-{centsToEur(s.fee_cents)} {s.currency}</td>
                  <td className="py-3 px-2 text-right font-semibold text-green-600">{centsToEur(s.net_cents)} {s.currency}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold text-sm border-t-2 border-gray-300">
                <td className="py-3 px-2">Total</td>
                <td className="py-3 px-2 text-right">{sales.reduce((a, s) => a + s.total_tickets, 0)}</td>
                <td className="py-3 px-2 text-right">{centsToEur(sales.reduce((a, s) => a + Number(s.gross_cents), 0))} EUR</td>
                <td className="py-3 px-2 text-right text-red-500">-{centsToEur(sales.reduce((a, s) => a + Number(s.fee_cents), 0))} EUR</td>
                <td className="py-3 px-2 text-right text-green-600">{centsToEur(sales.reduce((a, s) => a + Number(s.net_cents), 0))} EUR</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-500">
          Todos los importes se calculan en céntimos (unidad mínima del euro) para evitar errores de redondeo.
          La comisión del 7% se aplica sobre el bruto. El neto (93%) se transfiere automáticamente vía Stripe Connect.
        </p>
      </div>
    </>
  )

  // ===== MAIN =====
  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
      {renderTabNav()}
      {activeTab === 'eventos' && renderEventos()}
      {activeTab === 'entradas' && renderEntradas()}
      {activeTab === 'pagos' && renderPagos()}
      {activeTab === 'ventas' && renderVentas()}
    </div>
  )
}
