import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { Layout } from '@/components/layout/Layout'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import Home from '@/pages/Home'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import Events from '@/pages/Events'
import EventDetail from '@/pages/EventDetail'
import Profile from '@/pages/Profile'
import MyTickets from '@/pages/MyTickets'
import Dashboard from '@/pages/Dashboard'
import CreateEventWizard from '@/pages/CreateEventWizard'
import Admin from '@/pages/Admin'
import ArtistProfile from '@/pages/ArtistProfile'
import ArtistCalendar from '@/pages/ArtistCalendar'
import Friends from '@/pages/Friends'
import Messages from '@/pages/Messages'

function suppressMaplibreWorkerError(e: Event) {
  const msg = e instanceof ErrorEvent ? e.message : e instanceof PromiseRejectionEvent ? e.reason?.message : ''
  if (typeof msg === 'string' && msg.includes('Expected value to be of type number, but found null')) {
    e.preventDefault()
    e.stopImmediatePropagation()
  }
}

export default function App() {
  useEffect(() => {
    window.addEventListener('error', suppressMaplibreWorkerError, true)
    window.addEventListener('unhandledrejection', suppressMaplibreWorkerError, true)

    const origError = console.error
    console.error = (...args) => {
      const msg = args.join(' ')
      if (msg.includes('Expected value to be of type number, but found null')) return
      origError.apply(console, args)
    }

    return () => {
      window.removeEventListener('error', suppressMaplibreWorkerError, true)
      window.removeEventListener('unhandledrejection', suppressMaplibreWorkerError, true)
      console.error = origError
    }
  }, [])
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
        <ErrorBoundary>
        <Routes>
          <Route element={<Layout />}>
            {/* Públicas */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/events" element={<Events />} />
            <Route path="/events/:id" element={<EventDetail />} />

            {/* Requieren autenticación */}
            <Route path="/profile" element={
              <ProtectedRoute><Profile /></ProtectedRoute>
            } />
            <Route path="/tickets" element={
              <ProtectedRoute><MyTickets /></ProtectedRoute>
            } />
            <Route path="/friends" element={
              <ProtectedRoute><Friends /></ProtectedRoute>
            } />
            <Route path="/messages" element={
              <ProtectedRoute><Messages /></ProtectedRoute>
            } />

            {/* Requieren rol organizer o admin */}
            <Route path="/events/new" element={
              <ProtectedRoute roles={['organizer', 'admin']}><CreateEventWizard /></ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute roles={['organizer', 'admin']}><Dashboard /></ProtectedRoute>
            } />

            {/* Artista — perfil público y calendario */}
            <Route path="/artist/:id" element={<ArtistProfile />} />
            <Route path="/artist/:id/calendar" element={<ArtistCalendar />} />

            {/* Solo admin */}
            <Route path="/admin" element={
              <ProtectedRoute roles={['admin']}><Admin /></ProtectedRoute>
            } />
            <Route path="*" element={
              <div className="text-center py-16">
                <h1 className="text-4xl font-bold text-text mb-4">404</h1>
                <p className="text-muted mb-6">Página no encontrada</p>
                <a href="/" className="text-primary hover:underline">Volver al inicio</a>
              </div>
            } />
          </Route>
        </Routes>
        </ErrorBoundary>
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
