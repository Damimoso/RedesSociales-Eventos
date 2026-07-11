import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'

const STEPS = [
  {
    icon: '🎵',
    title: '¿Eres más de conciertos, teatro o improvisar?',
    desc: 'Descubre planes hechos a tu medida. Desde festivales hasta exposiciones.',
    gradient: 'from-primary/30 to-transparent',
  },
  {
    icon: '📍',
    title: 'A 3 km de ti hay algo que no te puedes perder.',
    desc: 'Usa el mapa interactivo para encontrar eventos cerca de ti. O explora por isla.',
    gradient: 'from-secondary/30 to-transparent',
  },
  {
    icon: '🎟️',
    title: 'Entrada comprada. QR listo. Tú solo disfruta.',
    desc: 'Compra segura con Stripe. QR dinámico antifraude. Sin reventa.',
    gradient: 'from-[#34D399]/30 to-transparent',
  },
]

export function OnboardingMockup() {
  const [step, setStep] = useState(0)
  const navigate = useNavigate()
  const current = STEPS[step]

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
      <div className={`w-full max-w-sm rounded-2xl p-8 bg-surface border border-primary/10 bg-gradient-to-b ${current.gradient}`}>
        <span className="text-6xl block mb-6">{current.icon}</span>
        <h2 className="text-xl font-bold text-text mb-3 leading-snug">{current.title}</h2>
        <p className="text-muted text-sm leading-relaxed">{current.desc}</p>
      </div>

      <div className="flex items-center gap-2 mt-8 mb-8">
        {STEPS.map((_, i) => (
          <div key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? 'w-8 bg-primary' : 'w-1.5 bg-primary/20'
            }`}
          />
        ))}
      </div>

      <div className="flex gap-3">
        {step < STEPS.length - 1 ? (
          <>
            <Button variant="ghost" onClick={() => navigate('/login')} className="text-muted">
              Saltar
            </Button>
            <Button onClick={() => setStep(s => s + 1)}>
              Siguiente
            </Button>
          </>
        ) : (
          <Button size="lg" onClick={() => navigate('/register')}
            style={{ background: 'linear-gradient(135deg, var(--th-primary, #6366F1), var(--th-secondary, #EC4899))' }}>
            ¡Quiero mi primer plan!
          </Button>
        )}
      </div>
    </div>
  )
}
