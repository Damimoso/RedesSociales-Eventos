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

// Intercept Blob to inject console.error suppression into worker script blobs.
// Worker errors do not propagate to the main thread, so we inject suppression
// directly into the worker code before the worker is instantiated.
const _INJECTED_PREFIX = '(function(){var _ce=console.error;console.error=function(){var m=Array.prototype.map.call(arguments,String).join(" ");if(m.includes("Expected value to be of type number")||m.includes("/rpc/check_streak"))return;_ce.apply(console,arguments)};var _ae=self.addEventListener;self.addEventListener=function(t,l,o){if(t==="message"&&typeof l==="function"){var w=function(e){try{return l(e)}catch(ex){if(ex&&typeof ex.message==="string"&&ex.message.includes("Expected value to be of type number, but found null"))return;throw ex}};return _ae.call(self,t,w,o)}return _ae.apply(self,arguments)};var _om=null;Object.defineProperty(self,"onmessage",{get:function(){return _om},set:function(f){if(typeof f==="function"){_om=function(e){try{return f(e)}catch(ex){if(ex&&typeof ex.message==="string"&&ex.message.includes("Expected value to be of type number, but found null"))return;throw ex}}}else{_om=f}},configurable:true});self.onerror=function(m,s,l,c,e){if(e&&typeof e.message==="string"&&e.message.includes("Expected value to be of type number, but found null"))return true;return false};self.addEventListener("unhandledrejection",function(e){if(e.reason&&typeof e.reason.message==="string"&&e.reason.message.includes("Expected value to be of type number, but found null"))e.preventDefault()});})();'
class PatchedBlob extends Blob {
  constructor(parts?: BlobPart[], options?: BlobPropertyBag) {
    if (options?.type === 'text/javascript' && parts != null) {
      const newParts: BlobPart[] = []
      let alreadyPatched = false
      for (const p of parts) {
        if (typeof p === 'string' && p.includes('var _ce=console.error')) {
          alreadyPatched = true
        }
        newParts.push(p)
      }
      if (!alreadyPatched) {
        newParts.unshift(_INJECTED_PREFIX)
      }
      super(newParts, options)
    } else {
      super(parts, options)
    }
  }
}
window.Blob = PatchedBlob

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
