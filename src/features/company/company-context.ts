import { createContext, useContext } from 'react'
import type { CompanyRole, Tables } from '../../lib/database.types'

type Membership = Tables<'memberships'>
type Company = Tables<'companies'>

export type CompanyContextValue = {
  memberships: Membership[]
  companies: Company[]
  activeCompany: Company | null
  activeMembership: Membership | null
  role: CompanyRole | null
  isAdmin: boolean
  loading: boolean
  refresh: (force?: boolean) => Promise<void>
  selectCompany: (companyId: string) => void
  dataLoaded: boolean
  error: string | null
  clearError: () => void
}

export const CompanyContext = createContext<CompanyContextValue | null>(null)

export function useCompanies() {
  const value = useContext(CompanyContext)
  if (!value) throw new Error('useCompanies deve ser usado dentro de CompanyProvider')
  return value
}
