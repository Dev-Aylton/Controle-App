import type { CompanyRole } from './database.types'

export function canManageCompany(role: CompanyRole | null, isAdmin: boolean) {
  return isAdmin || role === 'owner' || role === 'manager'
}

export function canCreateProduct(role: CompanyRole | null, isAdmin: boolean) {
  return isAdmin || role === 'owner' || role === 'manager' || role === 'employee'
}

export function canViewStock(role: CompanyRole | null, isAdmin: boolean) {
  return isAdmin || role === 'owner' || role === 'manager' || role === 'employee'
}

export function canViewCompanyCode(role: CompanyRole | null, isAdmin: boolean) {
  return isAdmin || role === 'owner' || role === 'manager'
}

export function canInvite(role: CompanyRole | null, isAdmin: boolean, targetRole: 'owner' | 'manager') {
  if (isAdmin) return targetRole === 'owner' || targetRole === 'manager'
  return role === 'owner' && targetRole === 'manager'
}

export function canPromote(role: CompanyRole | null, isAdmin: boolean) {
  return isAdmin || role === 'owner'
}

export function canDeactivate(
  callerRole: CompanyRole | null,
  isAdmin: boolean,
  targetRole: CompanyRole,
  callerUserId: string,
  targetUserId: string,
) {
  if (callerUserId === targetUserId) return false
  if (isAdmin) return true
  if (callerRole === 'owner') return targetRole === 'manager' || targetRole === 'employee'
  if (callerRole === 'manager') return targetRole === 'employee'
  return false
}
