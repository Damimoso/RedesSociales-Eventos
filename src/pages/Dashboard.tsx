import { useState, useEffect, useCallback, useRef, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { QrValidator } from '@/components/organizer/QrValidator'
import { centsToEur } from '@/lib/format'
import { ArtistDashboardSection } from '@/components/artist/ArtistDashboardSection'

type Tab = 'eventos' | 'entradas' | 'pagos' | 'ventas' | 'validar'
type EventRow = { id: string; title: string; status: string; start_date: string; remaining_capacity: number; max_capacity: number }
type TicketTier = { id: string; event_id: string; name: string; price_cents: number; quantity: number; remaining: number; created_at: string }
type EventOption = { id: string; title: string }
type OrganizerRow = { id: string; stripe_account_id: string | null; stripe_onboarding_complete: boolean; bank_holder: string | null; bank_iban: string | null; bank_swift: string | null }
type SalesRow = { event_id: string; event_title: string; total_tickets: number; gross_cents: number; fee_cents: number; net_cents: number; currency: string }

const tabs: { key: Tab; label: string }[] = [
  { key: 'eventos', label: 'Eventos' },
  { key: 'entradas', label: 'Entradas' },
  { key: 'validar', label: 'Validar QR' },
  { key: 'pagos', label: 'Pagos' },
  { key: 'ventas', label: 'Ventas' },
]

export default function Dashboard() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('eventos')
  const [role, setRole] = useState<string | null>(null)
  const [orgId, setOrgId] = useState<string | null>(null)

  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)

  const [myEvents, setMyEvents] = useState<EventOption[]>([])
  const [selectedEventId, setSelectedEventId] = useState('')
  const [tierName, setTierName] = useState('')
  const [tierPriceEur, setTierPriceEur] = useState('')
  const [tierQty, setTierQty] = useState('')
  const [ticketTiers, setTicketTiers] = useState<TicketTier[]>([])
  const [creatingTier, setCreatingTier] = useState(false)
  const [tierError, setTierError] = useState('')

  const [organizer, setOrganizer] = useState<OrganizerRow | null>(null)
  const [stripeLoading, setStripeLoading] = useState(false)
  const [stripeError, setStripeError] = useState('')
  const [bankHolder, setBankHolder] = useState('')
  const [bankIban, setBankIban] = useState('')
  const [bankSwift, setBankSwift] = useState('')
  const [savingBank, setSavingBank] = useState(false)
  const [bankSaved, setBankSaved] = useState(false)
  const [ibanError, setIbanError] = useState('')

  const [sales, setSales] = useState<SalesRow[]>([])
  const [loadingSales, setLoadingSales] = useState(false)
  const [salesError, setSalesError] = useState('')

  const mountedRef = useRef(true)
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  useEffect(() => {
    if (!user) return
    let cancelled = false
    const load = async () => {
      try {
        const [rolesRes, orgRes] = await Promise.all([
          supabase.from('user_roles').select('role').eq('user_id', user.id),
          supabase.from('organizers').select('id').eq('user_id', user.id).maybeSingle(),
        ])
        if (cancelled) return
        if (rolesRes.data) {
          const r = rolesRes.data.map(x => x.role)
          if (r.includes('organizer')) setRole('organizer')
          else if (r.includes('artist')) setRole('artist')
          else setRole('user')
        }
        if (orgRes.data) {
          setOrgId(orgRes.data.id)
          const { data: evts } = await supabase.from('events').select('id, title, status, start_date, remaining_capacity, max_capacity').eq('organizer_id', orgRes.data.id).order('start_date', { ascending: false })
          if (!cancelled && evts) setEvents(evts)
        }
      } catch (err) { console.error('Dashboard load error:', err) }
      if (!cancelled) setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [user])

  useEffect(() => {
    if (!orgId || activeTab !== 'entradas') return
    let cancelled = false
    Promise.all([
      supabase.from('events').select('id, title').eq('organizer_id', orgId).eq('status', 'published'),
      supabase.from('ticket_tiers').select('*, events!inner(organizer_id)').eq('events.organizer_id', orgId).order('created_at', { ascending: false }),
    ]).then(([evtRes, tierRes]) => {
      if (cancelled) return
      if (evtRes.data) setMyEvents(evtRes.data)
      if (tierRes.data) setTicketTiers(tierRes.data as unknown as TicketTier[])
    }).catch(err => console.error('Tiers load error:', err))
    return () => { cancelled = true }
  }, [orgId, activeTab])

  const handleCreateTier = async (e: FormEvent) => {
    e.preventDefault()
    setTierError('')
    if (!selectedEventId || !tierName || !tierPriceEur || !tierQty) return
    const qty = parseInt(tierQty, 10)
    if (isNaN(qty) || qty < 1) { setTierError('La cantidad debe ser un número positivo'); return }
    const priceEur = parseFloat(tierPriceEur)
    if (isNaN(priceEur) || priceEur < 0) { setTierError('El precio debe ser un número válido'); return }
    setCreatingTier(true)
    const priceCents = Math.round(priceEur * 100)
    const { error } = await supabase.from('ticket_tiers').insert({
      event_id: selectedEventId, name: tierName, price_cents: priceCents, quantity: qty,
    })
    if (error) { setTierError(error.message); setCreatingTier(false); return }
    setSelectedEventId(''); setTierName(''); setTierPriceEur(''); setTierQty('')
    setCreatingTier(false)
  }

  useEffect(() => {
    if (!user || activeTab !== 'pagos') return
    let cancelled = false; (async () => {
      try {
        const { data } = await supabase.from('organizers').select('id, stripe_account_id, stripe_onboarding_complete, bank_holder, bank_iban, bank_swift').eq('user_id', user.id).single()
        if (!cancelled && data) setOrganizer(data)
      } catch (err) { console.error('Organizer load error:', err) }
    })()
    return () => { cancelled = true }
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

  const validateIban = (iban: string) => {
    if (!iban) return ''
    const clean = iban.replace(/\s/g, '').toUpperCase()
    if (clean.length < 15 || clean.length > 34) return 'El IBAN debe tener entre 15 y 34 caracteres'
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(clean)) return 'Formato de IBAN inválido'
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

  useEffect(() => {
    if (!orgId || activeTab !== 'ventas') return
    let cancelled = false; setLoadingSales(true); setSalesError(''); (async () => {
      try {
        const { data, error } = await supabase.rpc('get_organizer_sales', { p_organizer_id: orgId })
        if (!cancelled) {
          if (error) setSalesError(error.message)
          else if (data) setSales(data)
        }
      } catch (err: any) { if (!cancelled) setSalesError(err?.message ?? 'Error loading sales') }
      if (!cancelled) setLoadingSales(false)
    })()
    return () => { cancelled = true }
  }, [orgId, activeTab])

  if (loading) return <LoadingSpinner />
  if (!user) return <p className="text-center text-[#8B8BA7] py-16">Inicia sesión para acceder al dashboard</p>

  if (role === 'artist') {
    return <ArtistDashboardSection userId={user.id} />
  }

  if (role !== 'organizer') {
    return (
      <div className="max-w-lg mx-auto text-center py-16">
        <h1 className="text-2xl font-bold text-white mb-4">Dashboard</h1>
        <p className="text-[#8B8BA7] mb-6">¿Quieres crear eventos? Solicita ser organizador.</p>
        {role === 'user' && <Button onClick={async () => {
          try {
            const { error: roleErr } = await supabase.from('user_roles').insert({ user_id: user.id, role: 'organizer' })
            if (roleErr) return
            const { error: orgErr } = await supabase.from('organizers').insert({
              user_id: user.id, org_name: user.user_metadata?.full_name || 'Organizador', org_type: 'individual',
            })
            if (orgErr) return
            const { data } = await supabase.from('organizers').select('id').eq('user_id', user.id).maybeSingle()
            if (data) setOrgId(data.id)
            setRole('organizer')
          } catch (err) { console.error('Error al solicitar ser organizador:', err) }
        }}>Solicitar ser organizador</Button>}
      </div>
    )
  }

  const renderTabNav = () => (
    <div className="flex border-b border-[rgba(124,92,252,0.1)] mb-6 overflow-x-auto">
      {tabs.map(t => (
        <button key={t.key} onClick={() => setActiveTab(t.key)}
          className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === t.key ? 'border-[#7C5CFC] text-[#7C5CFC]' : 'border-transparent text-[#8B8BA7] hover:text-white'}`}
        >{t.label}</button>
      ))}
    </div>
  )

  const renderEventos = () => (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Mis eventos</h2>
        <Link to="/events/new"><Button>+ Nuevo evento</Button></Link>
      </div>
      {events.length === 0 ? <p className="text-[#8B8BA7] text-sm">Aún no has creado ningún evento</p> : (
        <div className="space-y-2">
          {events.map(e => {
            const pct = e.max_capacity > 0 ? Math.round((e.max_capacity - e.remaining_capacity) / e.max_capacity * 100) : 0
            return (
            <div key={e.id} className="bg-[#1A1A2E] border border-[rgba(124,92,252,0.1)] rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h3 className="font-medium text-sm text-white">{e.title}</h3>
                  <p className="text-xs text-[#8B8BA7]">{new Date(e.start_date).toLocaleDateString('es-ES')} · {e.remaining_capacity}/{e.max_capacity} entradas</p>
                </div>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${e.status === 'published' ? 'bg-[#34D399]/20 text-[#34D399]' : e.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 text-[#8B8BA7]'}`}>{e.status}</span>
              </div>
              <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${pct}%`, background: pct >= 90 ? '#FF6B9D' : pct >= 50 ? '#7C5CFC' : '#34D399' }} />
              </div>
              <p className="text-[10px] text-[#8B8BA7] mt-1">{pct}% vendido</p>
            </div>
            )
          })}
        </div>
      )}
    </>
  )

  const renderEntradas = () => (
    <>
      <h2 className="text-lg font-semibold text-white mb-4">Crear tipo de entrada</h2>
      {tierError && <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-[#FF6B9D] mb-4">{tierError}</div>}
      <form onSubmit={handleCreateTier} className="bg-[#1A1A2E] border border-[rgba(124,92,252,0.1)] rounded-xl p-6 mb-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-[#8B8BA7] mb-1">Evento</label>
            <select required value={selectedEventId} onChange={e => setSelectedEventId(e.target.value)} className="w-full bg-[#0F0F1A] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#7C5CFC]">
              <option value="">Seleccionar evento...</option>
              {myEvents.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
            </select>
            {myEvents.length === 0 && <p className="text-xs text-[#8B8BA7] mt-1">No tienes eventos publicados.</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-[#8B8BA7] mb-1">Nombre de la entrada</label>
            <input type="text" required placeholder="Ej: General, VIP, Early Bird" value={tierName} onChange={e => setTierName(e.target.value)} className="w-full bg-[#0F0F1A] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#7C5CFC]" />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#8B8BA7] mb-1">Precio (€)</label>
            <input type="number" required min={0} step={0.01} placeholder="0.00" value={tierPriceEur} onChange={e => setTierPriceEur(e.target.value)} className="w-full bg-[#0F0F1A] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#7C5CFC]" />
            <p className="text-xs text-[#8B8BA7] mt-1">Se guardará como {Math.round(parseFloat(tierPriceEur || '0') * 100)} céntimos</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#8B8BA7] mb-1">Cantidad disponible</label>
            <input type="number" required min={1} placeholder="100" value={tierQty} onChange={e => setTierQty(e.target.value)} className="w-full bg-[#0F0F1A] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#7C5CFC]" />
          </div>
        </div>
        <Button type="submit" loading={creatingTier} disabled={!selectedEventId || !tierName || !tierPriceEur || !tierQty}>Crear entrada</Button>
      </form>

      <h3 className="text-md font-semibold text-white mb-3">Entradas creadas</h3>
      {ticketTiers.length === 0 ? <p className="text-[#8B8BA7] text-sm">Aún no has creado tipos de entrada</p> : (
        <div className="space-y-2">
          {ticketTiers.map(t => (
            <div key={t.id} className="bg-[#1A1A2E] border border-[rgba(124,92,252,0.1)] rounded-lg p-4 flex items-center justify-between">
              <div>
                <h4 className="font-medium text-sm text-white">{t.name}</h4>
                <p className="text-xs text-[#8B8BA7]">{centsToEur(t.price_cents)} € · {t.remaining}/{t.quantity} disponibles</p>
              </div>
              <span className="text-xs text-[#8B8BA7]">{new Date(t.created_at).toLocaleDateString('es-ES')}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )

  const renderValidar = () => <QrValidator />

  const renderPagos = () => (
    <>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Configuración de pagos</h2>
      <p className="text-sm text-gray-500 mb-6">
        Conecta con Stripe para recibir los pagos de tus entradas de forma automática.
        Stripe aplica su propia comisión de procesamiento; el resto se transfiere a tu cuenta.
      </p>

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

  const renderVentas = () => (
    <>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Historial de ventas</h2>
      {salesError && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4 mb-4">{salesError}</div>}
      {loadingSales ? <LoadingSpinner /> : sales.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-2">Aún no tienes ventas</p>
          <p className="text-xs text-gray-400">Las ventas aparecerán aquí cuando los usuarios compren entradas.</p>
        </div>
      ) : (<>
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
                  <td className="py-3 px-2 text-right text-red-500">-{centsToEur(s.fee_cents)}</td>
                  <td className="py-3 px-2 text-right font-semibold text-green-600">{centsToEur(s.net_cents)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold text-sm border-t-2 border-gray-300">
                <td className="py-3 px-2">Total</td>
                <td className="py-3 px-2 text-right">{sales.reduce((a, s) => a + s.total_tickets, 0)}</td>
                <td className="py-3 px-2 text-right">{centsToEur(sales.reduce((a, s) => a + Number(s.gross_cents), 0))} EUR</td>
                <td className="py-3 px-2 text-right text-red-500">-{centsToEur(sales.reduce((a, s) => a + Number(s.fee_cents), 0))}</td>
                <td className="py-3 px-2 text-right font-semibold text-green-600">{centsToEur(sales.reduce((a, s) => a + Number(s.net_cents), 0))} EUR</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">La comisión del 7% cubre el mantenimiento de la plataforma. Stripe aplica su propia comisión de procesamiento aparte.</p>
        </div>
      </>)}
    </>
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-white mb-2">Dashboard</h1>
      {renderTabNav()}
      {activeTab === 'eventos' && renderEventos()}
      {activeTab === 'entradas' && renderEntradas()}
      {activeTab === 'validar' && renderValidar()}
      {activeTab === 'pagos' && renderPagos()}
      {activeTab === 'ventas' && renderVentas()}
    </div>
  )
}
