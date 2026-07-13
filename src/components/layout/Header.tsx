import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/Button'
import logoLight from '@/img/Logo_fondo_blanco.png'
import logoDark from '@/img/Logo_fondo_negro.png'

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="text-sm text-muted hover:text-text transition-colors">
      {children}
    </Link>
  )
}

function isDarkHex(hex: string): boolean {
  const c = hex.replace('#', '')
  if (c.length < 6) return false
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128
}

export function Header() {
  const { user, roles, signOut } = useAuth()
  const { vars } = useTheme()
  const navigate = useNavigate()
  const isOrganizer = roles?.includes('organizer') || roles?.includes('admin')
  const isAdmin = roles?.includes('admin')
  const logo = isDarkHex(vars.base) ? logoDark : logoLight

  return (
    <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-primary/10">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-4 h-14">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="Eventos" className="h-8 w-auto" />
        </Link>

        <nav className="flex items-center gap-3">
          {user ? (
            <>
              <NavLink to="/events">Explorar</NavLink>
              <NavLink to="/tickets">Mis Entradas</NavLink>
              {isOrganizer && <NavLink to="/dashboard">Dashboard</NavLink>}
              {isOrganizer && <NavLink to="/events/new">Crear Evento</NavLink>}
              {isAdmin && <NavLink to="/admin">Admin</NavLink>}
              <Link to="/profile" className="flex items-center gap-2 text-sm text-text hover:text-primary transition-colors">
                <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shadow-lg"
                  style={{ background: 'linear-gradient(135deg, var(--th-primary, #6366F1), var(--th-secondary, #EC4899))', color: '#fff' }}>
                  {user.email?.charAt(0)?.toUpperCase() ?? '?'}
                </span>
              </Link>
              <Button variant="ghost" size="sm" onClick={async () => { try { await signOut() } finally { navigate('/') } }}>
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
