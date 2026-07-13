import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'

export default function Login() {
  const { signIn, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await signIn(email, password)
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="max-w-sm mx-auto pt-16">
      <h1 className="text-2xl font-bold text-center mb-6">Iniciar sesión</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">Email</label>
          <input
            type="email" required value={email} onChange={e => setEmail(e.target.value)}
            className="w-full rounded-lg border border-primary/20 bg-base px-4 py-2.5 text-text text-sm placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="tu@email.com"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text mb-1">Contraseña</label>
          <input
            type="password" required value={password} onChange={e => setPassword(e.target.value)}
            className="w-full rounded-lg border border-primary/20 bg-base px-4 py-2.5 text-text text-sm placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="••••••••"
          />
        </div>
        {error && <p className="text-error text-sm">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">Entrar</Button>
      </form>
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-primary/10" /></div>
        <div className="relative flex justify-center text-xs"><span className="bg-base px-2 text-muted">o</span></div>
      </div>
      <Button variant="outline" className="w-full" onClick={signInWithGoogle}>
        Continuar con Google
      </Button>
      <p className="text-center text-sm text-muted mt-6">
        ¿No tienes cuenta? <Link to="/register" className="text-primary font-medium">Regístrate</Link>
      </p>
    </div>
  )
}
