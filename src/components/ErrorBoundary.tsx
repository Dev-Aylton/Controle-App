import { Component, type ErrorInfo, type ReactNode } from 'react'
import { recordTechnicalError } from '../lib/diagnostics'

type Props = { children: ReactNode }
type State = { error: Error | null; componentStack: string | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null }

  static getDerivedStateFromError(error: Error): State {
    return { error, componentStack: null }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    recordTechnicalError('ErrorBoundary', `${error.message}\n${info.componentStack ?? ''}`)
    this.setState({ componentStack: info.componentStack ?? null })
    console.error('Erro inesperado no Controle-App', error, info)
  }

  retry = () => {
    this.setState({ error: null, componentStack: null })
    window.location.reload()
  }

  render() {
    if (this.state.error) {
      return (
        <main className="auth-page">
          <section className="auth-card" role="alert">
            <h1>Não foi possível mostrar o aplicativo</h1>
            <p>Ocorreu uma falha inesperada. Recarregue para tentar novamente.</p>
            <button className="primary-button" type="button" onClick={this.retry}>Recarregar aplicativo</button>
          </section>
        </main>
      )
    }
    return this.props.children
  }
}
