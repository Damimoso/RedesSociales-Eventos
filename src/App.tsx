import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from '@/contexts/AuthContext'
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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

            {/* Requieren rol organizer o admin */}
            <Route path="/events/new" element={
              <ProtectedRoute roles={['organizer', 'admin']}><CreateEventWizard /></ProtectedRoute>
            } />
            <Route path="/dashboard" element={
              <ProtectedRoute roles={['organizer', 'admin']}><Dashboard /></ProtectedRoute>
            } />

            {/* Artista — perfil público */}
            <Route path="/artist/:id" element={<ArtistProfile />} />

            {/* Solo admin */}
            <Route path="/admin" element={
              <ProtectedRoute roles={['admin']}><Admin /></ProtectedRoute>
            } />
            <Route path="*" element={
              <div className="text-center py-16">
                <h1 className="text-4xl font-bold text-white mb-4">404</h1>
                <p className="text-[#8B8BA7] mb-6">Página no encontrada</p>
                <a href="/" className="text-[#7C5CFC] hover:underline">Volver al inicio</a>
              </div>
            } />
          </Route>
        </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  )
}
