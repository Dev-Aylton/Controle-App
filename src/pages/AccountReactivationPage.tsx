import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { ActionButton } from '../components/ActionButton'
import { useAuth } from '../features/auth/auth-context'
import { useCompanies } from '../features/company/company-context'
import { friendlySupabaseError } from '../lib/errors'
import { tryGetSupabaseClient } from '../lib/supabase'
import { useSafeSignOut } from '../features/account/useSafeSignOut'

export function AccountReactivationPage() {
  const auth = useAuth()
  const safeSignOut = useSafeSignOut()
  const companies = useCompanies()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!auth.configured) return <Navigate to="/login" replace />
  if (auth.loading) return <main className="page-state">Verificando status da conta...</main>
  if (!auth.session) return <Navigate to="/login" replace state={{ from: '/reativar-conta' }} />
  if (auth.accountDeletionStatusError) {
    return (
      <>
        <main className="auth-page">
          <section className="auth-card" aria-labelledby="reactivation-title">
            <h1 id="reactivation-title">Status da conta indisponível</h1>
            <p role="alert">{auth.accountDeletionStatusError}</p>
            <ActionButton className="secondary-button" busyLabel="Verificando..." onAction={auth.refreshAccountDeletionStatus}>
              Tentar novamente
            </ActionButton>
            <button className="secondary-button" type="button" disabled={safeSignOut.busy} onClick={() => void safeSignOut.requestSignOut()}>
              Sair da conta
            </button>
            {safeSignOut.error && <p className="form-error" role="alert">{safeSignOut.error}</p>}
          </section>
        </main>
        {safeSignOut.dialog}
      </>
    )
  }
  if (!auth.accountDeletionStatus) return <Navigate to="/" replace />

  const status = auth.accountDeletionStatus
  const scheduledFor = new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(status.scheduled_for))

  const reactivateAccount = async () => {
    setBusy(true)
    setError('')
    try {
      const supabase = tryGetSupabaseClient()
      if (!supabase) throw new Error('Supabase não configurado.')
      const { error: rpcError } = await supabase.rpc('reactivate_my_account')
      if (rpcError) throw rpcError
      await auth.refreshAccountDeletionStatus()
      await companies.refresh(true)
      navigate('/', { replace: true })
    } catch (caught) {
      setError(friendlySupabaseError(caught))
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    setBusy(true)
    setError('')
    try {
      if (await safeSignOut.requestSignOut()) navigate('/login', { replace: true })
    } catch (caught) {
      setError(friendlySupabaseError(caught))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="reactivation-title">
        <p className="eyebrow">Acesso à conta suspenso</p>
        <h1 id="reactivation-title">
          {status.can_reactivate ? 'Pedido de exclusão em andamento' : 'Exclusão em processamento'}
        </h1>
        {status.can_reactivate ? (
          <>
            <p>Seu acesso permanece suspenso enquanto o pedido está ativo. Você pode cancelar o pedido até {scheduledFor}.</p>
            <p>Ao reativar, seus vínculos anteriores serão restaurados e você voltará a usar o aplicativo.</p>
            <ActionButton className="primary-button" disabled={busy} busyLabel="Reativando..." onAction={reactivateAccount}>
              Cancelar pedido e reativar conta
            </ActionButton>
          </>
        ) : (
          <>
            <p>O prazo para reativação terminou em {scheduledFor}. A conta está aguardando a finalização automática da exclusão.</p>
            <p>
              Se você acredita que isso ocorreu por engano, entre em contato com o responsável pelo Controle-App:{' '}
              <a href="mailto:desenvolvedor.aylton@gmail.com">desenvolvedor.aylton@gmail.com</a>.
            </p>
          </>
        )}
        {error && <p className="form-error" role="alert">{error}</p>}
        {safeSignOut.error && <p className="form-error" role="alert">{safeSignOut.error}</p>}
        <button className="secondary-button" type="button" disabled={busy || safeSignOut.busy} onClick={() => void signOut()}>
          Sair da conta
        </button>
      </section>
      {safeSignOut.dialog}
    </main>
  )
}
