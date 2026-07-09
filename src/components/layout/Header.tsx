import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'

export function Header() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-40 bg-[#0F0F1A]/80 backdrop-blur-md border-b border-[rgba(124,92,252,0.1)]">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-4 h-14">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg text-[#7C5CFC]">
          <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 3c1.93 0 3.5 1.57 3.5 3.5S13.93 13 12 13s-3.5-1.57-3.5-3.5S10.07 6 12 6zm7 13H5v-.23c0-.62.28-1.2.76-1.58C7.47 15.82 9.64 15 12 15s4.53.82 6.24 2.19c.48.38.76.97.76 1.58V19z"/></svg>
          Eventos
        </Link>

        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <Link to="/events" className="text-sm text-[#8B8BA7] hover:text-white transition-colors">Explorar</Link>
              <Link to="/dashboard" className="text-sm text-[#8B8BA7] hover:text-white transition-colors">Dashboard</Link>
              <Link to="/profile" className="flex items-center gap-2 text-sm text-white hover:text-[#7C5CFC] transition-colors">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #7C5CFC, #FF6B9D)', color: '#fff' }}>
                  {user.email?.[0].toUpperCase()}
                </span>
              </Link>
              <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate('/') }}>
                Salir
              </Button>
            </>
          ) : (
            <>
              <Link to="/login"><Button variant="ghost" size="sm">Entrar</Button></Link>
              <Link to="/register"><Button size="sm">Registrarse</Button></Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
