import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { Button } from '@/components/ui/Button'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import logoLight from '@/img/Logo_fondo_blanco.png'
import logoDark from '@/img/Logo_fondo_negro.png'
import type { ThemeId } from '@/lib/themes'

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

const NEXT_THEME: Record<string, ThemeId> = { light: 'dark', dark: 'light' }

export function Header() {
  const { user, roles, signOut } = useAuth()
  const { themeId, vars, setThemeId } = useTheme()
  const navigate = useNavigate()
  const isOrganizer = roles?.includes('organizer') || roles?.includes('admin')
  const isAdmin = roles?.includes('admin')
  const logo = isDarkHex(vars.base) ? logoDark : logoLight
  const [unreadMsg, setUnreadMsg] = useState(0)
  const [pendingFriends, setPendingFriends] = useState(0)

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
              <div className="relative">
                <NavLink to="/messages">Mensajes</NavLink>
                {unreadMsg > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-secondary text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {unreadMsg > 9 ? '9+' : unreadMsg}
                  </span>
                )}
              </div>
              <div className="relative">
                <NavLink to="/friends">Amigos</NavLink>
                {pendingFriends > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-secondary text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {pendingFriends > 9 ? '9+' : pendingFriends}
                  </span>
                )}
              </div>
              {isOrganizer && <NavLink to="/dashboard">Dashboard</NavLink>}
              {isOrganizer && <NavLink to="/events/new">Crear Evento</NavLink>}
              {isAdmin && <NavLink to="/admin">Admin</NavLink>}
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
      </div>
    </header>
  )
}
