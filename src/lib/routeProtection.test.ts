import { describe, expect, it } from 'vitest'
import { getProtectedRoute } from './routeProtection'

describe('proteção de rota', () => {
  it('mantém carregamento antes de decidir', () => {
    expect(getProtectedRoute({ configured: true, loading: true, session: null, companyLoading: false, dataLoaded: false, isAdmin: false, companyCount: 0 })).toBeNull()
  })
  it('direciona sessão ausente ao login', () => {
    expect(getProtectedRoute({ configured: true, loading: false, session: null, companyLoading: false, dataLoaded: true, isAdmin: false, companyCount: 0 })).toBe('/login')
  })
  it('limita conta com exclusão pendente à tela de reativação, mesmo durante carregamento da empresa', () => {
    expect(getProtectedRoute({
      configured: true,
      loading: false,
      session: { user: {} },
      accountDeletionPending: true,
      companyLoading: true,
      dataLoaded: false,
      isAdmin: false,
      companyCount: 0,
    })).toBe('/reativar-conta')
  })
  it('direciona usuário sem empresa para código', () => {
    expect(getProtectedRoute({ configured: true, loading: false, session: { user: {} }, companyLoading: false, dataLoaded: true, isAdmin: false, companyCount: 0 })).toBe('/entrar-codigo')
  })
  it('direciona admin sem empresa para empresas', () => {
    expect(getProtectedRoute({ configured: true, loading: false, session: { user: {} }, companyLoading: false, dataLoaded: true, isAdmin: true, companyCount: 0 })).toBe('/empresa')
  })
  it('mantém usuário com empresa', () => {
    expect(getProtectedRoute({ configured: true, loading: false, session: { user: {} }, companyLoading: false, dataLoaded: true, isAdmin: false, companyCount: 1 })).toBeNull()
  })
})
