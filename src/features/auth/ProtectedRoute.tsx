import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './auth-context'
import { useCompanies } from '../company/company-context'
import { getProtectedRoute } from '../../lib/routeProtection'

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, configured } = useAuth()
  const location = useLocation()
  const companies = useCompanies()

  if (!configured) return <>{children}</>
  if (loading) return <main className="page-state">Verificando sessão...</main>
  const route = getProtectedRoute({
    configured,
    loading,
    session,
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
