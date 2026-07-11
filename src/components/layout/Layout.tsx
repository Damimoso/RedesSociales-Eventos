import { Outlet } from 'react-router-dom'
import { Header } from './Header'

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#071521]">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-[rgba(0,119,182,0.1)] py-4 text-center text-xs text-[#8BA4B8]">
        RedSocial Eventos &mdash; Hecho en Canarias con ❤️
      </footer>
    </div>
  )
}
