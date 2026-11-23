import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { ActionButton } from '../components'
import { useAuth } from '../features/auth/auth-context'
import { friendlySupabaseError } from '../lib/errors'
import iconLight from '../../docs/logos/opcao-a/icon-light.svg'
import iconDark from '../../docs/logos/opcao-a/icon-dark.svg'

export function ResetPasswordPage() {
  const auth = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  if (auth.loading) return <main className="page-state">Validando o link de recuperação...</main>
  if (!auth.session) return <Navigate to="/login" replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setMessage('')
    if (password.length < 6) {
      setError('Informe uma nova senha com pelo menos 6 caracteres.')
      return
    }
    if (password !== confirmation) {
      setError('A confirmação não corresponde à nova senha.')
      return
    }
    try {
      await auth.updatePassword(password)
      setMessage('Senha alterada. Você já pode continuar usando o aplicativo.')
      setPassword('')
      setConfirmation('')
    } catch (caught) {
      setError(friendlySupabaseError(caught))
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="auth-brand" aria-label="Controle-App">
          <img className="auth-brand-icon light-logo" src={iconLight} alt="" />
          <img className="auth-brand-icon dark-logo" src={iconDark} alt="" />
          <span>Controle-App</span>
        </div>
        <h1>Definir nova senha</h1>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="form-success" role="status">{message}</p>}
        <form onSubmit={submit}>
          <label>Nova senha
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={6} autoComplete="new-password" required />
          </label>
          <label>Confirmar nova senha
            <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={6} autoComplete="new-password" required />
          </label>
          <ActionButton className="primary-button" busyLabel="Salvando..." onAction={() => submit({ preventDefault: () => undefined } as FormEvent)}>
            Alterar senha
          </ActionButton>
        </form>
      </section>
    </main>
  )
}
