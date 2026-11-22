import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth-context'
import { useCompanies } from '../company/company-context'
import { getProtectedRoute } from '../../lib/routeProtection'
import { canManageCompany } from '../../lib/uiPermissions'
import { useSafeSignOut } from '../account/useSafeSignOut'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const {
    session,
    loading,
    configured,
    accountDeletionStatus,
    accountDeletionStatusError,
    refreshAccountDeletionStatus,
  } = useAuth()
  const safeSignOut = useSafeSignOut()
  const location = useLocation()
  const companies = useCompanies()

  if (!configured) return <>{children}</>
  if (loading) return <main className="page-state">Verificando sessão...</main>
  if (session && accountDeletionStatusError) {
    return (
      <>
        <main className="page-state">
          <p role="alert">{accountDeletionStatusError}</p>
          <button className="secondary-button" type="button" onClick={() => void refreshAccountDeletionStatus()}>
            Tentar novamente
          </button>
          <button className="secondary-button" type="button" disabled={safeSignOut.busy} onClick={() => void safeSignOut.requestSignOut()}>
            Sair da conta
          </button>
          {safeSignOut.error && <p role="alert">{safeSignOut.error}</p>}
        </main>
        {safeSignOut.dialog}
      </>
    )
  }
  const route = getProtectedRoute({
    configured,
    loading,
    session,
    accountDeletionPending: Boolean(accountDeletionStatus),
    companyLoading: companies.loading,
    dataLoaded: companies.dataLoaded,
    isAdmin: companies.isAdmin,
    companyCount: companies.companies.length,
    currentPath: location.pathname,
  })
  if (route === '/login') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (route) return <Navigate to={route} replace />
  return <>{children}</>
}

export function ManagementRoute({ children }: { children: ReactNode }) {
  const { loading, dataLoaded, role, isAdmin } = useCompanies()
  if (loading || !dataLoaded) return <main className="page-state">Verificando permissões...</main>
  return canManageCompany(role, isAdmin) ? <>{children}</> : <Navigate to="/" replace />
}
