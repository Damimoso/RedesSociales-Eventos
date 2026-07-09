import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, type UserRole } from '@/contexts/AuthContext'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

type Props = {
  children: React.ReactNode
  roles?: UserRole[]
  redirectTo?: string
}

export function ProtectedRoute({ children, roles, redirectTo = '/login' }: Props) {
  const { user, roles: userRoles, loading } = useAuth()
  const location = useLocation()

  if (loading) return <LoadingSpinner />

  if (!user) {
    return <Navigate to={`${redirectTo}?redirect=${encodeURIComponent(location.pathname)}`} replace />
  }

  if (roles && roles.length > 0) {
    const hasRole = roles.some(r => userRoles.includes(r))
    if (!hasRole) {
      return <Navigate to="/" replace />
    }
  }

  return <>{children}</>
}
