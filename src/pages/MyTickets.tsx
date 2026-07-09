import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import QRCode from 'qrcode'

type TicketDetail = {
  ticket_id: string
  event_id: string
  user_id: string
  quantity: number
  unit_price: number
  total_amount: number
  status: string
  qr_code: string
  purchased_at: string
  event_title: string
  cover_image_url: string | null
  event_city: string
  event_address: string
  start_date: string
  end_date: string
  organizer_name: string
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function MyTickets() {
  const [tickets, setTickets] = useState<TicketDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [qrUrls, setQrUrls] = useState<Record<string, string>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let cancelled = false; (async () => {
      try {
        const { data, error } = await supabase.from('ticket_details').select('*').order('purchased_at', { ascending: false })
        if (!cancelled && !error && data) setTickets(data as TicketDetail[])
      } catch (err) { console.error('Error loading tickets:', err) }
      if (!cancelled) setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const generateQr = useCallback(async (ticketId: string, qrCode: string) => {
    if (qrUrls[ticketId]) return
    const url = await QRCode.toDataURL(qrCode, {
      width: 300, margin: 2,
      color: { dark: '#1e1e2f', light: '#ffffff' },
    })
    setQrUrls(prev => ({ ...prev, [ticketId]: url }))
  }, [qrUrls])

  const toggle = (id: string, qrCode: string) => {
    const next = !expanded[id]
    setExpanded(prev => ({ ...prev, [id]: next }))
    if (next) generateQr(id, qrCode)
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-6">Mis Entradas</h1>

      {tickets.length === 0 && (
        <p className="text-gray-500 text-center py-12">Todavía no tienes entradas compradas.</p>
      )}

      <div className="space-y-4">
        {tickets.map(t => (
          <div key={t.ticket_id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="flex gap-3 p-4">
              {t.cover_image_url && (
                <img src={t.cover_image_url} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-gray-900 truncate">{t.event_title}</h2>
                <p className="text-sm text-gray-500">{formatDate(t.start_date)}</p>
                <p className="text-sm text-gray-500">{t.event_city}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                    t.status === 'confirmed' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'
                  }`}>
                    {t.status === 'confirmed' ? 'Confirmada' : t.status}
                  </span>
                  <span className="text-xs text-gray-400">{t.quantity} entrada{t.quantity > 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => toggle(t.ticket_id, t.qr_code)}
              className="w-full flex items-center justify-between px-4 py-2.5 border-t border-gray-100 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors font-medium"
            >
              {expanded[t.ticket_id] ? 'Ocultar QR' : 'Mostrar código QR'}
              <svg className={`w-4 h-4 transition-transform ${expanded[t.ticket_id] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>

            {expanded[t.ticket_id] && (
              <div className="px-4 pb-4 flex flex-col items-center gap-2">
                {qrUrls[t.ticket_id] ? (
                  <>
                    <img src={qrUrls[t.ticket_id]} alt="QR de entrada" className="w-48 h-48" />
                    <p className="text-[10px] text-gray-400 font-mono tracking-wider">{t.qr_code}</p>
                    <span className="text-[11px] text-gray-400">
                      Presenta este código en la puerta del evento
                    </span>
                  </>
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center">
                    <LoadingSpinner />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
