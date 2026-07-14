import { Link, useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/Button'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import logoLight from '@/img/Logo_fondo_blanco.png'
import logoDark from '@/img/Logo_fondo_negro.png'
import type { ThemeId } from '@/lib/themes'

function isDarkHex(hex: string): boolean {
  const c = hex.replace('#', '')
  if (c.length < 6) return false
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128
}

const NEXT_THEME: Record<string, ThemeId> = { light: 'dark', dark: 'light' }

function Hamburger({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="lg:hidden p-2 text-muted hover:text-text transition-colors" aria-label="Menú">
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        {open ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        )}
      </svg>
    </button>
  )
}

function MobileNavLink({ to, children, onClick }: { to: string; children: React.ReactNode; onClick?: () => void }) {
  return (
    <Link to={to} onClick={onClick} className="block px-4 py-2.5 text-sm text-muted hover:text-text hover:bg-primary/5 rounded-lg transition-colors">
      {children}
    </Link>
  )
}

function DesktopNavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="text-sm text-muted hover:text-text transition-colors">
      {children}
    </Link>
  )
}

export function Header() {
  const { user, roles, signOut } = useAuth()
  const { themeId, vars, setThemeId } = useTheme()
  const navigate = useNavigate()
  const isArtist = roles?.includes('artist')
  const isOrganizer = roles?.includes('organizer') || roles?.includes('admin')
  const isAdmin = roles?.includes('admin')
  const logo = isDarkHex(vars.base) ? logoDark : logoLight
  const [unreadMsg, setUnreadMsg] = useState(0)
  const [pendingFriends, setPendingFriends] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const [{ count: msgCount }, { count: friendCount }] = await Promise.all([
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('receiver_id', user.id).is('read_at', null),
        supabase.from('friendships').select('*', { count: 'exact', head: true }).eq('addressee_id', user.id).eq('status', 'pending'),
      ])
      setUnreadMsg(msgCount ?? 0)
      setPendingFriends(friendCount ?? 0)
    }
    load()
    const channel = supabase.channel('header-notifs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `receiver_id=eq.${user.id}` }, () => { load() })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships', filter: `addressee_id=eq.${user.id}` }, () => { load() })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  const closeMenu = () => setMenuOpen(false)

  const navLinks = user ? (
    <>
      <div className="relative">
        <DesktopNavLink to="/messages">Mensajes</DesktopNavLink>
        {unreadMsg > 0 && (
          <span className="absolute -top-1.5 -right-2 bg-secondary text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {unreadMsg > 9 ? '9+' : unreadMsg}
          </span>
        )}
      </div>
      <div className="relative">
        <DesktopNavLink to="/friends">
          {isArtist ? 'Amigos' : isOrganizer ? 'Artistas' : 'Siguiendo'}
        </DesktopNavLink>
        {(isArtist || isOrganizer) && pendingFriends > 0 && (
          <span className="absolute -top-1.5 -right-2 bg-secondary text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
            {pendingFriends > 9 ? '9+' : pendingFriends}
          </span>
        )}
      </div>
      <DesktopNavLink to="/events">Explorar</DesktopNavLink>
      <DesktopNavLink to="/tickets">Mis Entradas</DesktopNavLink>
      {isOrganizer && <DesktopNavLink to="/dashboard">Dashboard</DesktopNavLink>}
      {isOrganizer && <DesktopNavLink to="/events/new">Crear Evento</DesktopNavLink>}
      {isAdmin && <DesktopNavLink to="/admin">Admin</DesktopNavLink>}
    </>
  ) : null

  const mobileLinks = user ? (
    <>
      <div className="relative flex items-center justify-between px-4 py-2.5">
        <MobileNavLink to="/messages" onClick={closeMenu}>Mensajes</MobileNavLink>
        {unreadMsg > 0 && (
          <span className="bg-secondary text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 mr-4">
            {unreadMsg > 9 ? '9+' : unreadMsg}
          </span>
        )}
      </div>
      <div className="relative flex items-center justify-between px-4 py-2.5">
        <MobileNavLink to="/friends" onClick={closeMenu}>
          {isArtist ? 'Amigos' : isOrganizer ? 'Artistas' : 'Siguiendo'}
        </MobileNavLink>
        {(isArtist || isOrganizer) && pendingFriends > 0 && (
          <span className="bg-secondary text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1 mr-4">
            {pendingFriends > 9 ? '9+' : pendingFriends}
          </span>
        )}
      </div>
      <MobileNavLink to="/events" onClick={closeMenu}>Explorar</MobileNavLink>
      <MobileNavLink to="/tickets" onClick={closeMenu}>Mis Entradas</MobileNavLink>
      <hr className="mx-4 border-primary/10" />
      <MobileNavLink to="/profile" onClick={closeMenu}>Mi Perfil</MobileNavLink>
      {isOrganizer && <MobileNavLink to="/dashboard" onClick={closeMenu}>Dashboard</MobileNavLink>}
      {isOrganizer && <MobileNavLink to="/events/new" onClick={closeMenu}>Crear Evento</MobileNavLink>}
      {isAdmin && <MobileNavLink to="/admin" onClick={closeMenu}>Admin</MobileNavLink>}
    </>
  ) : null

  return (
    <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-md border-b border-primary/10">
      <div className="mx-auto max-w-7xl flex items-center justify-between px-4 h-14">
        <Link to="/" className="flex items-center gap-2">
          <img src={logo} alt="Eventos" className="h-8 w-auto" />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-3">
          {user ? (
            <>
              {navLinks}
              <button onClick={() => setThemeId(NEXT_THEME[themeId] ?? 'light')}
                className="text-muted hover:text-text transition-colors p-1.5 rounded-lg hover:bg-primary/10" title="Cambiar tema">
                {themeId === 'dark' ? (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
                )}
              </button>
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

        {/* Mobile controls */}
        <div className="flex lg:hidden items-center gap-1">
          <button onClick={() => setThemeId(NEXT_THEME[themeId] ?? 'light')}
            className="text-muted hover:text-text transition-colors p-1.5 rounded-lg hover:bg-primary/10" title="Cambiar tema">
            {themeId === 'dark' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
            )}
          </button>
          {user && (
            <Link to="/profile">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium shadow-lg"
                style={{ background: 'linear-gradient(135deg, var(--th-primary, #6366F1), var(--th-secondary, #EC4899))', color: '#fff' }}>
                {user.email?.charAt(0)?.toUpperCase() ?? '?'}
              </span>
            </Link>
          )}
          <Hamburger open={menuOpen} onClick={() => setMenuOpen(!menuOpen)} />
        </div>
      </div>

      {/* Mobile drawer via portal to body */}
      {menuOpen && createPortal(
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={closeMenu} />
          <div className="absolute top-0 right-0 w-72 h-full bg-surface shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between px-4 h-14 border-b border-primary/10">
              <span className="text-sm font-semibold text-text">Menú</span>
              <Hamburger open={true} onClick={closeMenu} />
            </div>
            <div className="py-2 space-y-1">
              {user ? (
                <>
                  {mobileLinks}
                  <hr className="mx-4 border-primary/10" />
                  <button onClick={async () => { closeMenu(); try { await signOut() } finally { navigate('/') } }}
                    className="w-full text-left px-4 py-2.5 text-sm text-error hover:bg-primary/5 rounded-lg transition-colors">
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <>
                  <MobileNavLink to="/login" onClick={closeMenu}>Entrar</MobileNavLink>
                  <MobileNavLink to="/register" onClick={closeMenu}>Registrarse</MobileNavLink>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  )
}
