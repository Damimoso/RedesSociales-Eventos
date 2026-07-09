import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, AuthError, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type UserRole = 'user' | 'artist' | 'organizer' | 'admin'

type AuthContextValue = {
  user: User | null
  session: Session | null
  roles: UserRole[]
  loading: boolean
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  refreshRoles: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [roles, setRoles] = useState<UserRole[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRoles = async (uid: string) => {
    const { data } = await supabase.from('user_roles').select('role').eq('user_id', uid)
    if (data) setRoles(data.map(r => r.role as UserRole))
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchRoles(session.user.id)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) fetchRoles(session.user.id)
      else setRoles([])
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string, displayName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: displayName } },
    })
    return { error }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  const signInWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const refreshRoles = async () => {
    if (user) await fetchRoles(user.id)
    else setRoles([])
  }

  return (
    <AuthContext.Provider value={{ user, session, roles, loading, signUp, signIn, signInWithGoogle, signOut, refreshRoles }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
