import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/Button'

export default function Register() {
  const { signUp, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setLoading(true)
    setError('')
    const { error } = await signUp(email, password, name)
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="max-w-sm mx-auto pt-16">
      <h1 className="text-2xl font-bold text-center mb-6">Crear cuenta</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-text mb-1">Nombre</label>
          <input
            type="text" required value={name} onChange={e => setName(e.target.value)}
            className="w-full rounded-lg border border-primary/20 bg-base px-4 py-2.5 text-text text-sm placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Tu nombre"
          />
        </div>
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
            placeholder="Mínimo 6 caracteres"
          />
        </div>
        {error && <p className="text-error text-sm">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">Crear cuenta</Button>
      </form>
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-primary/10" /></div>
        <div className="relative flex justify-center text-xs"><span className="bg-base px-2 text-muted">o</span></div>
      </div>
      <Button variant="outline" className="w-full" onClick={signInWithGoogle}>
        Registrarse con Google
      </Button>
      <p className="text-center text-sm text-muted mt-6">
        ¿Ya tienes cuenta? <Link to="/login" className="text-primary font-medium">Entrar</Link>
      </p>
    </div>
  )
}
