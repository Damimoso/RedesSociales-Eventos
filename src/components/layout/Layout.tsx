import { Outlet } from 'react-router-dom'
import { Header } from './Header'

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-base">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 pb-20 lg:pb-6">
        <Outlet />
      </main>
      <footer className="border-t border-primary/10 py-4 text-center text-xs text-muted">
        RedSocial Eventos &mdash; Hecho en Canarias con ❤️
      </footer>
    </div>
  )
}
