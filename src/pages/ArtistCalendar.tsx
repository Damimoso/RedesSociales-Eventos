import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

type Performance = {
  id: string
  artist_id: string
  title: string
  description: string | null
  venue: string | null
  city: string | null
  performance_date: string
  performance_time: string | null
  is_public: boolean
}

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

function useCalendarMonth(base: Date) {
  const y = base.getFullYear()
  const m = base.getMonth()
  const first = new Date(y, m, 1)
  const last = new Date(y, m + 1, 0)
  const startOffset = (first.getDay() + 6) % 7
  const daysInMonth = last.getDate()
  const cells: (number | null)[] = []
  for (let i = 0; i < startOffset; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)
  return { year: y, month: m, cells, daysInMonth }
}

export default function ArtistCalendar() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [artist, setArtist] = useState<{ stage_name: string; user_id: string } | null>(null)
  const [performances, setPerformances] = useState<Performance[]>([])
  const [loading, setLoading] = useState(true)
  const [baseDate, setBaseDate] = useState(() => new Date())
  const [selDay, setSelDay] = useState<number | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', venue: '', city: '', time: '', public: true })

  const isOwner = user && artist ? artist.user_id === user.id : false

  const { year, month, cells } = useCalendarMonth(baseDate)

  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const monthEnd = new Date(year, month + 1, 0).toISOString().slice(0, 10)

  const load = useCallback(async () => {
    if (!id) return
    try {
      const [artistRes, perfRes] = await Promise.all([
        supabase.from('artists').select('stage_name, user_id').eq('id', id).single(),
        supabase.from('artist_performances')
          .select('*')
          .eq('artist_id', id)
          .gte('performance_date', monthStart)
          .lte('performance_date', monthEnd)
          .order('performance_date', { ascending: true })
          .order('performance_time', { ascending: true }),
      ])
      if (artistRes.data) setArtist(artistRes.data)
      if (perfRes.data) setPerformances(perfRes.data)
    } catch (err) { console.error('Error loading calendar:', err) }
    setLoading(false)
  }, [id, monthStart, monthEnd])

  useEffect(() => { load() }, [load])

  const perfsByDay = new Map<number, Performance[]>()
  for (const p of performances) {
    const d = new Date(p.performance_date).getDate()
    if (!perfsByDay.has(d)) perfsByDay.set(d, [])
    perfsByDay.get(d)!.push(p)
  }

  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month
  const todayDate = today.getDate()

  const selPerfs = selDay !== null ? perfsByDay.get(selDay) ?? [] : []

  const handleSave = async () => {
    if (!id || !form.title.trim()) return
    setSaving(true)
    const day = selDay ?? 1
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const { data, error } = await supabase.from('artist_performances').insert({
      artist_id: id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      venue: form.venue.trim() || null,
      city: form.city.trim() || null,
      performance_date: dateStr,
      performance_time: form.time || null,
      is_public: form.public,
    }).select().single()
    if (!error && data) {
      setPerformances(prev => [...prev, data as Performance])
      setForm({ title: '', description: '', venue: '', city: '', time: '', public: true })
      setShowForm(false)
    }
    setSaving(false)
  }

  const handleDelete = async (perfId: string) => {
    await supabase.from('artist_performances').delete().eq('id', perfId)
    setPerformances(prev => prev.filter(p => p.id !== perfId))
  }

  if (loading) return <LoadingSpinner />
  if (!artist) return <p className="text-center text-muted py-16">Artista no encontrado</p>

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/artist/${id}`} className="text-muted hover:text-text transition-colors">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-text">{artist.stage_name}</h1>
          <p className="text-sm text-muted">Calendario de actuaciones</p>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between bg-surface rounded-xl p-3 border border-primary/10">
        <button onClick={() => setBaseDate(new Date(year, month - 1, 1))}
          className="p-1.5 text-muted hover:text-text transition-colors rounded-lg hover:bg-primary/10">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="font-semibold text-text">{MONTHS[month]} {year}</span>
        <button onClick={() => setBaseDate(new Date(year, month + 1, 1))}
          className="p-1.5 text-muted hover:text-text transition-colors rounded-lg hover:bg-primary/10">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      {/* Calendar grid */}
      <div className="bg-surface rounded-xl border border-primary/10 overflow-hidden">
        <div className="grid grid-cols-7 bg-elevated">
          {DAYS.map(d => (
            <div key={d} className="text-center text-[11px] font-semibold text-muted py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const hasPerf = day !== null && perfsByDay.has(day)
            const isToday = isCurrentMonth && day === todayDate
            const isSelected = day === selDay
            return (
              <button key={i} disabled={day === null}
                onClick={() => { setSelDay(day); setShowForm(false) }}
                className={`relative aspect-square flex flex-col items-center justify-center text-sm transition-colors
                  ${day === null ? 'cursor-default' : 'hover:bg-primary/10 cursor-pointer'}
                  ${isSelected ? 'bg-primary/15 text-primary font-semibold' : isToday ? 'text-primary font-semibold' : 'text-text'}
                  ${i % 7 === 0 ? 'border-l-0' : ''} border-t border-primary/5`}>
                {day !== null && (
                  <>
                    <span>{day}</span>
                    {hasPerf && <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-secondary" />}
                  </>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day performances */}
      {selDay !== null && (
        <div className="bg-surface rounded-xl p-4 border border-primary/10 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-text">
              {selDay} de {MONTHS[month]} de {year}
            </h3>
            {isOwner && !showForm && (
              <Button size="sm" onClick={() => setShowForm(true)}>Añadir</Button>
            )}
          </div>

          {showForm && isOwner && (
            <div className="space-y-2 p-3 bg-elevated rounded-lg">
              <input type="text" placeholder="Título de la actuación" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-surface border border-primary/20 rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:border-primary" />
              <input type="text" placeholder="Descripción (opcional)" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                className="w-full bg-surface border border-primary/20 rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:border-primary" />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="Lugar" value={form.venue}
                  onChange={e => setForm(f => ({ ...f, venue: e.target.value }))}
                  className="w-full bg-surface border border-primary/20 rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:border-primary" />
                <input type="text" placeholder="Ciudad" value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  className="w-full bg-surface border border-primary/20 rounded-lg px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:border-primary" />
              </div>
              <input type="time" value={form.time}
                onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                className="w-full bg-surface border border-primary/20 rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-primary" />
              <label className="flex items-center gap-2 text-sm text-muted">
                <input type="checkbox" checked={form.public}
                  onChange={e => setForm(f => ({ ...f, public: e.target.checked }))}
                  className="rounded border-primary/30 text-primary focus:ring-primary" />
                Público (visible para todos)
              </label>
              <div className="flex gap-2 pt-1">
                <Button size="sm" onClick={handleSave} loading={saving} disabled={!form.title.trim()}>Guardar</Button>
                <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setForm({ title: '', description: '', venue: '', city: '', time: '', public: true }) }}>Cancelar</Button>
              </div>
            </div>
          )}

          {selPerfs.length === 0 && !showForm && (
            <p className="text-sm text-muted">No hay actuaciones este día</p>
          )}
          {selPerfs.map(p => (
            <div key={p.id} className="flex items-start gap-3 p-3 bg-elevated rounded-lg group">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm text-text">{p.title}</p>
                {(p.venue || p.city) && (
                  <p className="text-xs text-muted">{[p.venue, p.city].filter(Boolean).join(', ')}</p>
                )}
                {p.description && <p className="text-xs text-muted mt-0.5">{p.description}</p>}
                {p.performance_time && (
                  <p className="text-xs text-primary mt-0.5">
                    {new Date(`2000-01-01T${p.performance_time}`).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                <p className="text-[10px] text-muted mt-1">{p.is_public ? 'Público' : 'Privado'}</p>
              </div>
              {isOwner && (
                <button onClick={() => handleDelete(p.id)}
                  className="text-muted hover:text-error transition-colors opacity-0 group-hover:opacity-100 p-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-secondary" /> Con actuación</span>
        {isOwner && <span className="text-muted">Toca un día para añadir</span>}
      </div>
    </div>
  )
}
