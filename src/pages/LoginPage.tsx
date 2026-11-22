import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import wordmarkLight from '../../docs/logos/opcao-a/wordmark-light.svg'
import wordmarkDark from '../../docs/logos/opcao-a/wordmark-dark.svg'
import { useAuth } from '../features/auth/auth-context'
import { friendlySupabaseError } from '../lib/errors'
import { useCompanies } from '../features/company/company-context'
import { getProtectedRoute } from '../lib/routeProtection'
import { ActionButton } from '../components/ActionButton'

export function LoginPage() {
  const auth = useAuth()
  const companies = useCompanies()
  const [mode, setMode] = useState<'entrar' | 'cadastrar' | 'recuperar'>('entrar')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (auth.loading) return <main className="page-state">Verificando sessão...</main>
  if (auth.session) {
    const route = getProtectedRoute({
      configured: auth.configured,
      loading: auth.loading,
      session: auth.session,
      accountDeletionPending: Boolean(auth.accountDeletionStatus),
      companyLoading: companies.loading,
      dataLoaded: companies.dataLoaded,
      isAdmin: companies.isAdmin,
      companyCount: companies.companies.length,
    })
    return <Navigate to={route ?? '/'} replace />
  }

  if (!auth.configured) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <img className="auth-logo light-logo" src={wordmarkLight} alt="Controle-App" />
          <img className="auth-logo dark-logo" src={wordmarkDark} alt="Controle-App" />
          <h1>Configuração necessária</h1>
          <p role="alert">Preencha VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo de ambiente.</p>
          <p>O login não pode ser iniciado até o Supabase ser configurado.</p>
          <div className="auth-links"><Link to="/privacidade">Aviso de privacidade</Link></div>
        </section>
      </main>
    )
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setMessage('')
    try {
      if (mode === 'entrar') await auth.signInWithPassword(email, password)
      if (mode === 'cadastrar') {
        await auth.signUpWithPassword(email, password)
        setMessage('Cadastro iniciado. Confira seu e-mail para confirmar a conta.')
      }
      if (mode === 'recuperar') {
        await auth.resetPassword(email)
        setMessage('Enviamos um link de recuperação para seu e-mail.')
      }
    } catch (caught) {
      setError(friendlySupabaseError(caught))
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <img className="auth-logo light-logo" src={wordmarkLight} alt="Controle-App" />
        <img className="auth-logo dark-logo" src={wordmarkDark} alt="Controle-App" />
        <h1>{mode === 'entrar' ? 'Entrar' : mode === 'cadastrar' ? 'Criar conta' : 'Recuperar senha'}</h1>
        {error && <p className="form-error" role="alert">{error}</p>}
        {auth.authError && <p className="form-error" role="alert">{auth.authError}</p>}
        {message && <p className="form-success" role="status">{message}</p>}
        {mode !== 'recuperar' && (
          <ActionButton className="google-button" busyLabel="Abrindo Google..." onAction={auth.signInWithGoogle}>
            Entrar com Google
          </ActionButton>
        )}
        <form onSubmit={(event) => event.preventDefault()}>
          <label>E-mail<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="seu@email.com" required /></label>
          {mode !== 'recuperar' && (
            <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo de 6 caracteres" minLength={6} required /></label>
          )}
          <ActionButton className="primary-button" busyLabel="Aguarde..." onAction={() => submit({ preventDefault: () => undefined } as FormEvent)}>
            {mode === 'entrar' ? 'Entrar' : mode === 'cadastrar' ? 'Criar conta' : 'Enviar link'}
          </ActionButton>
        </form>
        <div className="auth-links">
          {mode !== 'entrar' && <button type="button" onClick={() => setMode('entrar')}>Entrar</button>}
          {mode !== 'cadastrar' && <button type="button" onClick={() => setMode('cadastrar')}>Criar conta</button>}
          {mode !== 'recuperar' && <button type="button" onClick={() => setMode('recuperar')}>Esqueci a senha</button>}
          <Link to="/privacidade">Aviso de privacidade</Link>
        </div>
      </section>
    </main>
  )
}
