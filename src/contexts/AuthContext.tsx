import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react'
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
  signInWithGoogle: () => Promise<{ error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  refreshRoles: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [roles, setRoles] = useState<UserRole[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRoles = useCallback(async (uid: string) => {
    try {
      const { data, error } = await supabase.from('user_roles').select('role').eq('user_id', uid)
      if (error) { console.error('Error fetching roles:', error); return }
      if (data) setRoles(data.map(r => r.role as UserRole))
    } catch (err) {
      console.error('fetchRoles error:', err)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        await fetchRoles(session.user.id)
      }
      if (mounted) setLoading(false)
    }).catch(err => {
      console.error('getSession error:', err)
      if (mounted) setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        try { await fetchRoles(session.user.id) } catch (err) { console.error('onAuthStateChange roles error:', err) }
      } else {
        setRoles([])
      }
      if (mounted) setLoading(false)
    })

    return () => { mounted = false; subscription.unsubscribe() }
  }, [fetchRoles])

  const signUp = async (email: string, password: string, displayName: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: displayName } },
      })
      return { error }
    } catch {
      return { error: new Error('Sign up failed') } as { error: AuthError | null }
    }
  }

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error }
    } catch {
      return { error: new Error('Sign in failed') } as { error: AuthError | null }
    }
  }

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      })
      return { error }
    } catch {
      return { error: new Error('Google sign in failed') } as { error: AuthError | null }
    }
  }

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      return { error }
    } catch {
      return { error: new Error('Sign out failed') } as { error: AuthError | null }
    }
  }

  const refreshRoles = useCallback(async () => {
    if (user) await fetchRoles(user.id)
    else setRoles([])
  }, [user, fetchRoles])

  const value = useMemo(() => ({
    user, session, roles, loading,
    signUp, signIn, signInWithGoogle, signOut, refreshRoles,
  }), [user, session, roles, loading, refreshRoles])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
