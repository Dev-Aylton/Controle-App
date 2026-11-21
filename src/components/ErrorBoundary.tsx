import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null; componentStack: string | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null }

  static getDerivedStateFromError(error: Error): State {
    return { error, componentStack: null }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
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
            <p>{this.state.error.message || 'Ocorreu um erro inesperado.'}</p>
            <pre style={{ maxWidth: '100%', overflow: 'auto', whiteSpace: 'pre-wrap', textAlign: 'left' }}>
              {this.state.error.stack || 'Stack não disponível'}
              {this.state.componentStack ? `\nComponente:\n${this.state.componentStack}` : ''}
            </pre>
            <button className="primary-button" type="button" onClick={this.retry}>Tentar de novo</button>
          </section>
        </main>
      )
    }
    return this.props.children
  }
}
