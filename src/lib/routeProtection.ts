export type RouteProtectionInput = {
  configured: boolean
  loading: boolean
  session: unknown | null
  companyLoading: boolean
  dataLoaded: boolean
  isAdmin: boolean
  companyCount: number
  currentPath?: string
}

export function getProtectedRoute(input: RouteProtectionInput): '/login' | '/entrar-codigo' | '/empresa' | null {
  if (!input.configured) return null
  if (input.loading || (input.session && (!input.dataLoaded || input.companyLoading))) return null
  if (!input.session) return '/login'
  if (input.currentPath === '/entrar-codigo' || input.currentPath === '/empresa') return null
  if (input.isAdmin && input.companyCount === 0 && input.currentPath !== '/perfil') return '/empresa'
  if (!input.isAdmin && input.companyCount === 0) return '/entrar-codigo'
  return null
}
