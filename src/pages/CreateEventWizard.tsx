import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useGeolocation } from '@/hooks/useGeolocation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { LocationPicker } from '@/components/events/LocationPicker'

type Category = { id: string; name: string; slug: string }
type Step = 1 | 2 | 3

type FormData = {
  title: string
  description: string
  category_id: string
  tags: string
  cover_image_url: string
  start_date: string
  end_date: string
  city: string
  address: string
}

let tierIdCounter = 0
const newTierId = () => ++tierIdCounter
type TierForm = { _key: number; name: string; price_eur: string; quantity: string }

const STEPS: { step: Step; label: string }[] = [
  { step: 1, label: 'Información' },
  { step: 2, label: 'Fecha y lugar' },
  { step: 3, label: 'Entradas' },
]

export default function CreateEventWizard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const geo = useGeolocation()
  const [orgId, setOrgId] = useState<string | null>(null)
  const [step, setStep] = useState<Step>(1)
  const [categories, setCategories] = useState<Category[]>([])
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Form data
  const [form, setForm] = useState<FormData>({
    title: '', description: '', category_id: '', tags: '', cover_image_url: '',
    start_date: '', end_date: '', city: '', address: '',
  })

  // Tiers
  const [tiers, setTiers] = useState<TierForm[]>([{ _key: newTierId(), name: 'General', price_eur: '', quantity: '100' }])

  // Artists
  const [artistSearch, setArtistSearch] = useState('')
  const [artistResults, setArtistResults] = useState<{ id: string; stage_name: string }[]>([])
  const [selectedArtists, setSelectedArtists] = useState<{ id: string; stage_name: string }[]>([])
  const [searchingArtist, setSearchingArtist] = useState(false)

  // Publish mode
  const [publishMode, setPublishMode] = useState<'draft' | 'published'>('draft')

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([
      supabase.from('organizers').select('id').eq('user_id', user.id).maybeSingle(),
      supabase.from('categories').select('id, name, slug').order('name'),
    ]).then(([orgRes, catRes]) => {
      if (cancelled) return
      if (orgRes.data) setOrgId(orgRes.data.id)
      if (catRes.data) setCategories(catRes.data)
    }).catch((err) => { console.error('Error loading organizer/categories:', err) })
    return () => { cancelled = true }
  }, [user])

  const update = useCallback((patch: Partial<FormData>) => setForm(f => ({ ...f, ...patch })), [])

  const canNext = useCallback(() => {
    if (step === 1) return form.title.trim().length >= 3
    if (step === 2) return form.start_date && form.end_date && form.city && form.address && location
    return true
  }, [step, form, location])

  const handleSubmit = async () => {
    if (!orgId || !location) return
    setSubmitting(true); setError('')

    // 1. Crear evento
    const { data: event, error: evtErr } = await supabase.from('events').insert({
      organizer_id: orgId,
      category_id: form.category_id || null,
      title: form.title,
      description: form.description || null,
      short_description: form.description ? form.description.slice(0, 150) : null,
      cover_image_url: form.cover_image_url || null,
      city: form.city,
      address: form.address,
      start_date: new Date(form.start_date).toISOString(),
      end_date: new Date(form.end_date).toISOString(),
      max_capacity: tiers.reduce((a, t) => a + parseInt(t.quantity || '0'), 0),
      is_free: tiers.every(t => !t.price_eur || parseFloat(t.price_eur) === 0),
      price: null,
      status: publishMode,
      location: `POINT(${location.lng} ${location.lat})`,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    }).select('id').single()

    if (evtErr || !event) { setError(evtErr?.message ?? 'Error al crear el evento'); setSubmitting(false); return }

    // 2. Crear ticket tiers
    const validTiers = tiers.filter(t => t.name && t.quantity && parseInt(t.quantity) > 0)
    if (validTiers.length > 0) {
      const { error: tierErr } = await supabase.from('ticket_tiers').insert(
        validTiers.map(t => ({
          event_id: event.id,
          name: t.name,
          price_cents: Math.round(parseFloat(t.price_eur || '0') * 100),
          quantity: parseInt(t.quantity, 10),
        }))
      )
      if (tierErr) { setError(tierErr.message); setSubmitting(false); return }
    }

    // 3. Vincular artistas
    if (selectedArtists.length > 0) {
      const { error: artistErr } = await supabase.from('event_artists').insert(
        selectedArtists.map(a => ({ event_id: event.id, artist_id: a.id }))
      )
      if (artistErr) { console.error('Error linking artists:', artistErr) }
    }

    setSubmitting(false)
    navigate(`/events/${event.id}?creado=ok`)
  }

  if (!user) return <p className="text-center text-[#8BA4B8] py-16">Inicia sesión para crear eventos</p>
  if (!orgId && categories.length === 0) return <LoadingSpinner />
  if (!orgId) return <p className="text-center text-[#8BA4B8] py-16">No tienes perfil de organizador. Solicítalo desde el dashboard.</p>

  return (
    <div className="max-w-2xl mx-auto">
      {/* Stepper */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.step} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              step === s.step
                ? 'bg-[#0077B6]/20 text-[#0077B6] border border-[#0077B6]/30'
                : step > s.step
                  ? 'bg-[#34D399]/20 text-[#34D399]'
                  : 'bg-white/5 text-[#8BA4B8]'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                step === s.step ? 'bg-[#0077B6] text-white' :
                step > s.step ? 'bg-[#34D399] text-white' : 'bg-white/10 text-[#8BA4B8]'
              }`}>
                {step > s.step ? '✓' : s.step}
              </span>
              {s.label}
            </div>
            {i < STEPS.length - 1 && <div className="w-8 h-px bg-white/10" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-[#FFD100] mb-6">{error}</div>
      )}

      {/* ===== STEP 1: INFO BÁSICA ===== */}
      {step === 1 && (
        <div className="bg-[#0D2137] border border-[rgba(0,119,182,0.1)] rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Información del evento</h2>

          <div>
            <label className="block text-sm font-medium text-[#8BA4B8] mb-1">Título del evento *</label>
            <input type="text" required value={form.title} onChange={e => update({ title: e.target.value })}
              placeholder="Ej: Concierto de Laura Music en Santa Catalina"
              className="w-full bg-[#071521] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-[#8BA4B8]/50 focus:outline-none focus:border-[#0077B6] transition-colors" />
          </div>

          <div>
            <label className="block text-sm font-medium text-[#8BA4B8] mb-1">Descripción</label>
            <textarea value={form.description} onChange={e => update({ description: e.target.value })}
              rows={4} placeholder="Cuéntale a la gente de qué va..."
              className="w-full bg-[#071521] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-[#8BA4B8]/50 focus:outline-none focus:border-[#0077B6] transition-colors resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#8BA4B8] mb-1">Categoría</label>
              <select value={form.category_id} onChange={e => update({ category_id: e.target.value })}
                className="w-full bg-[#071521] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0077B6]">
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8BA4B8] mb-1">Etiquetas</label>
              <input type="text" value={form.tags} onChange={e => update({ tags: e.target.value })}
                placeholder="música, benéfico, familia"
                className="w-full bg-[#071521] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-[#8BA4B8]/50 focus:outline-none focus:border-[#0077B6]" />
              <p className="text-[10px] text-[#8BA4B8] mt-1">Separadas por comas</p>
            </div>
          </div>

            <div>
              <label className="block text-sm font-medium text-[#8BA4B8] mb-1">URL de imagen de portada</label>
              <input type="url" value={form.cover_image_url} onChange={e => update({ cover_image_url: e.target.value })}
                placeholder="https://ejemplo.com/imagen.jpg"
                className="w-full bg-[#071521] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-[#8BA4B8]/50 focus:outline-none focus:border-[#0077B6]" />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#8BA4B8] mb-2">Artistas participantes</label>
              <div className="flex gap-2 mb-2">
                <input type="text" value={artistSearch} onChange={async e => {
                  setArtistSearch(e.target.value)
                  if (e.target.value.length < 2) { setArtistResults([]); return }
                  setSearchingArtist(true)
                  const { data } = await supabase.from('artists').select('id, stage_name').ilike('stage_name', `%${e.target.value}%`).limit(10)
                  setArtistResults(data ?? [])
                  setSearchingArtist(false)
                }}
                  placeholder="Buscar artista por nombre..."
                  className="flex-1 bg-[#071521] border border-white/10 rounded-lg px-4 py-2 text-white text-sm placeholder:text-[#8BA4B8]/50 focus:outline-none focus:border-[#0077B6]" />
              </div>
              {searchingArtist && <p className="text-xs text-[#8BA4B8] mb-1">Buscando...</p>}
              {artistResults.length > 0 && (
                <div className="bg-[#071521] border border-white/10 rounded-lg mb-2 overflow-hidden">
                  {artistResults.filter(a => !selectedArtists.find(s => s.id === a.id)).map(a => (
                    <button key={a.id} type="button" onClick={() => { setSelectedArtists([...selectedArtists, a]); setArtistSearch(''); setArtistResults([]) }}
                      className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/5 transition-colors">
                      + {a.stage_name}
                    </button>
                  ))}
                </div>
              )}
              {selectedArtists.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedArtists.map(a => (
                    <span key={a.id} className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-[#0077B6]/20 text-[#0077B6]">
                      {a.stage_name}
                      <button type="button" onClick={() => setSelectedArtists(selectedArtists.filter(s => s.id !== a.id))}
                        className="hover:text-white transition-colors">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
      )}

      {/* ===== STEP 2: FECHA Y UBICACIÓN ===== */}
      {step === 2 && (
        <div className="bg-[#0D2137] border border-[rgba(0,119,182,0.1)] rounded-xl p-6 space-y-4">
          <h2 className="text-lg font-bold text-white">Fecha y ubicación</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#8BA4B8] mb-1">Fecha y hora de inicio *</label>
              <input type="datetime-local" required value={form.start_date} onChange={e => update({ start_date: e.target.value })}
                className="w-full bg-[#071521] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0077B6] [color-scheme:dark]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8BA4B8] mb-1">Fecha y hora de fin *</label>
              <input type="datetime-local" required value={form.end_date} onChange={e => update({ end_date: e.target.value })}
                className="w-full bg-[#071521] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-[#0077B6] [color-scheme:dark]" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#8BA4B8] mb-1">Ciudad *</label>
              <input type="text" required value={form.city} onChange={e => update({ city: e.target.value })}
                placeholder="Las Palmas de Gran Canaria"
                className="w-full bg-[#071521] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-[#8BA4B8]/50 focus:outline-none focus:border-[#0077B6]" />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#8BA4B8] mb-1">Dirección *</label>
              <input type="text" required value={form.address} onChange={e => update({ address: e.target.value })}
                placeholder="Calle Mayor, 123"
                className="w-full bg-[#071521] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder:text-[#8BA4B8]/50 focus:outline-none focus:border-[#0077B6]" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#8BA4B8] mb-2">Selecciona la ubicación en el mapa *</label>
            {geo.position && (
              <LocationPicker center={geo.position} value={location} onChange={setLocation} />
            )}
            {!location && <p className="text-xs text-[#8BA4B8] mt-1">Haz clic en el mapa para colocar el marcador</p>}
          </div>
        </div>
      )}

      {/* ===== STEP 3: ENTRADAS ===== */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="bg-[#0D2137] border border-[rgba(0,119,182,0.1)] rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Tipos de entrada</h2>

              {tiers.map((tier, i) => (
              <div key={tier._key} className="flex items-end gap-3 bg-[#071521] rounded-lg p-4 border border-white/5">
                <div className="flex-1">
                  <label className="block text-[11px] font-medium text-[#8BA4B8] mb-1">Nombre</label>
                  <input type="text" value={tier.name} onChange={e => {
                    const next = [...tiers]; next[i] = { ...next[i], name: e.target.value }; setTiers(next)
                  }} placeholder="General"
                  className="w-full bg-[#0D2137] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#0077B6]" />
                </div>
                <div className="w-24">
                  <label className="block text-[11px] font-medium text-[#8BA4B8] mb-1">Precio (€)</label>
                  <input type="number" min={0} step={0.01} value={tier.price_eur} onChange={e => {
                    const next = [...tiers]; next[i] = { ...next[i], price_eur: e.target.value }; setTiers(next)
                  }} placeholder="0.00"
                  className="w-full bg-[#0D2137] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#0077B6]" />
                </div>
                <div className="w-24">
                  <label className="block text-[11px] font-medium text-[#8BA4B8] mb-1">Cantidad</label>
                  <input type="number" min={1} value={tier.quantity} onChange={e => {
                    const next = [...tiers]; next[i] = { ...next[i], quantity: e.target.value }; setTiers(next)
                  }} placeholder="100"
                  className="w-full bg-[#0D2137] border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#0077B6]" />
                </div>
                {tiers.length > 1 && (
                  <button type="button" onClick={() => setTiers(tiers.filter((_, j) => j !== i))}
                    className="text-[#FFD100] hover:text-white transition-colors p-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={() => setTiers([...tiers, { _key: newTierId(), name: '', price_eur: '', quantity: '50' }])}>
              + Añadir otro tipo de entrada
            </Button>
          </div>

          <div className="bg-[#0D2137] border border-[rgba(0,119,182,0.1)] rounded-xl p-6 space-y-4">
            <h2 className="text-lg font-bold text-white">Publicar</h2>

            <div className="flex gap-3">
              <button type="button" onClick={() => setPublishMode('draft')}
                className={`flex-1 rounded-lg border p-4 text-center transition-all ${
                  publishMode === 'draft'
                    ? 'border-[#0077B6]/50 bg-[#0077B6]/10 text-white'
                    : 'border-white/10 text-[#8BA4B8] hover:border-white/20'
                }`}>
                <span className="text-2xl block mb-1">📝</span>
                <span className="text-sm font-medium">Guardar borrador</span>
                <p className="text-[11px] text-[#8BA4B8] mt-1">Nadie lo verá hasta que lo publiques</p>
              </button>
              <button type="button" onClick={() => setPublishMode('published')}
                className={`flex-1 rounded-lg border p-4 text-center transition-all ${
                  publishMode === 'published'
                    ? 'border-[#34D399]/50 bg-[#34D399]/10 text-white'
                    : 'border-white/10 text-[#8BA4B8] hover:border-white/20'
                }`}>
                <span className="text-2xl block mb-1">🌍</span>
                <span className="text-sm font-medium">Publicar ahora</span>
                <p className="text-[11px] text-[#8BA4B8] mt-1">Visible para todos al instante</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== NAVEGACIÓN ===== */}
      <div className="flex items-center justify-between mt-6">
        <div>
          {step > 1 ? (
            <Button variant="ghost" onClick={() => setStep((step - 1) as Step)}>
              ← Atrás
            </Button>
          ) : (
            <Link to="/dashboard"><Button variant="ghost">Cancelar</Button></Link>
          )}
        </div>
        <div>
          {step < 3 ? (
            <Button onClick={() => setStep((step + 1) as Step)} disabled={!canNext()}>
              Siguiente →
            </Button>
          ) : (
            <Button onClick={handleSubmit} loading={submitting} size="lg"
              style={{ background: publishMode === 'published' ? 'linear-gradient(135deg, #0077B6, #FFD100)' : undefined }}>
              {publishMode === 'published' ? '🚀 Publicar evento' : '💾 Guardar borrador'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
