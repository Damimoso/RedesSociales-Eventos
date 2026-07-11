import { Component, type ReactNode, type ErrorInfo } from 'react'

type Props = { children: ReactNode; fallback?: ReactNode }
type State = { hasError: boolean; error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-5xl mb-4">⚠️</span>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Algo salió mal</h2>
          <p className="text-gray-500 text-sm mb-6 max-w-md">
            Se produjo un error inesperado. Intenta recargar la página.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary-hover transition-colors text-sm font-medium"
          >
            Recargar página
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
