import { Outlet } from 'react-router-dom'
import { Header } from './Header'

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0F0F1A]">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-[rgba(124,92,252,0.1)] py-4 text-center text-xs text-[#8B8BA7]">
        RedSocial Eventos &mdash; Hecho en Canarias con ❤️
      </footer>
    </div>
  )
}
