import { useRef, useState, useCallback, useEffect } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/Button'

type Result = {
  status: 'VALID' | 'INVALID' | 'EXPIRED' | 'ALREADY_USED' | 'UNAUTHORIZED' | null
  ticket_id?: string
  event_title?: string
  user_name?: string
}

const CAMERA_ID = 'qr-scanner'

export function QrValidator() {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<Result>({ status: null })
  const [error, setError] = useState('')
  const lastResultRef = useRef('')
  const timeoutRef = useRef<number | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false } }, [])

  const clearTimeouts = () => {
    if (timeoutRef.current !== null) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
  }

  const resumeScanning = useCallback(async () => {
    if (!mountedRef.current) return
    setResult({ status: null })
    try {
      await scannerRef.current?.resume()
      if (mountedRef.current) setScanning(true)
    } catch { /* scanner not initialized yet */ }
  }, [])

  const stopScanning = useCallback(async () => {
    clearTimeouts()
    try {
      await scannerRef.current?.stop()
      scannerRef.current?.clear()
    } catch { /* scanner already stopped */ }
    scannerRef.current = null
    if (mountedRef.current) { setScanning(false); setResult({ status: null }) }
  }, [])

  const startScanning = useCallback(async () => {
    if (!mountedRef.current) return
    setError('')
    setResult({ status: null })
    clearTimeouts()

    try {
      if (scannerRef.current) { await stopScanning() }
    } catch {}

    try {
      const scanner = new Html5Qrcode(CAMERA_ID)
      scannerRef.current = scanner
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decodedText) => {
          try {
            if (decodedText === lastResultRef.current) return
            lastResultRef.current = decodedText
            scanner.pause()
            if (mountedRef.current) setScanning(false)

            const { data, error: rpcError } = await supabase.rpc('validate_ticket', {
              p_token: decodedText,
            })

            if (!mountedRef.current) return

            if (rpcError) {
              setResult({ status: 'INVALID' })
              timeoutRef.current = window.setTimeout(() => resumeScanning(), 2000)
              return
            }

            const row = data?.[0] ?? {}
            setResult({ status: row.status ?? 'INVALID', ticket_id: row.ticket_id, event_title: row.event_title, user_name: row.user_name })
            timeoutRef.current = window.setTimeout(() => resumeScanning(), 3000)
          } catch {
            if (mountedRef.current) {
              setResult({ status: 'INVALID' })
              timeoutRef.current = window.setTimeout(() => resumeScanning(), 2000)
            }
          }
        },
        () => {},
      )
      if (mountedRef.current) setScanning(true)
    } catch (err: any) {
      if (!mountedRef.current) return
      if (err.message?.includes('NotAllowedError') || err.message?.includes('Permission')) {
        setError('Permiso de cámara denegado. Concede acceso en la configuración del navegador.')
      } else {
        setError(err.message ?? 'Error al iniciar la cámara')
      }
    }
  }, [resumeScanning, stopScanning])

  const statusColor = (s: Result['status']) => {
    switch (s) {
      case 'VALID': return 'bg-[#34D399]/20 text-[#34D399] border-[#34D399]/30'
      case 'EXPIRED': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
      case 'ALREADY_USED': return 'bg-orange-500/20 text-orange-400 border-orange-500/30'
      default: return 'bg-red-500/20 text-[#FFD100] border-red-500/30'
    }
  }

  const statusIcon = (s: Result['status']) => {
    switch (s) {
      case 'VALID': return '✅'
      case 'EXPIRED': return '⏰'
      case 'ALREADY_USED': return '🔄'
      default: return '❌'
    }
  }

  const statusLabel = (s: Result['status']) => {
    switch (s) {
      case 'VALID': return 'Entrada válida'
      case 'EXPIRED': return 'Token expirado (pide al usuario que refresque el QR)'
      case 'ALREADY_USED': return 'Esta entrada ya fue validada'
      case 'UNAUTHORIZED': return 'No autorizado para validar este evento'
      default: return 'Entrada no válida'
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Validar código QR</h2>
        {!scanning ? (
          <Button onClick={startScanning} size="sm">
            📷 Escanear QR
          </Button>
        ) : (
          <Button onClick={stopScanning} variant="danger" size="sm">
            Detener
          </Button>
        )}
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-[#FFD100]">
          {error}
        </div>
      )}

      <div id={CAMERA_ID} className={`w-full rounded-xl overflow-hidden border ${scanning ? 'border-[#0077B6]/30' : 'border-white/10'} ${!scanning && !result.status ? 'bg-[#0D2137]' : ''}`}>
        {!scanning && !result.status && !error && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="text-5xl mb-4">📸</span>
            <p className="text-[#8BA4B8] text-sm">Pulsa "Escanear QR" y enfoca el código</p>
            <p className="text-[#8BA4B8] text-xs mt-1">de la entrada del usuario</p>
          </div>
        )}
      </div>

      {result.status && (
        <div className={`rounded-xl border p-4 text-sm ${statusColor(result.status)}`}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{statusIcon(result.status)}</span>
            <div>
              <p className="font-semibold">{statusLabel(result.status)}</p>
              {result.event_title && (
                <p className="text-xs opacity-75 mt-1">{result.event_title}</p>
              )}
              {result.user_name && (
                <p className="text-xs opacity-75">Usuario: {result.user_name}</p>
              )}
              {result.ticket_id && (
                <p className="text-[10px] opacity-50 font-mono mt-1">ID: {result.ticket_id.slice(0, 8)}...</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
