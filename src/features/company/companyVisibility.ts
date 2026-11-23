export type CompanyVisibilityMembership = {
  company_id: string
  role: 'owner' | 'manager' | 'employee'
  active: boolean
}

export function getVisibleCompanyIds(
  isAdmin: boolean,
  allCompanyIds: string[],
  memberships: CompanyVisibilityMembership[],
) {
  if (isAdmin) return [...new Set(allCompanyIds)]
  return [...new Set(
    memberships
      .filter((membership) => membership.active)
      .map((membership) => membership.company_id),
  )]
}

export function canSelectCompany(
  isAdmin: boolean,
  visibleCompanyIds: string[],
  companyId: string,
) {
  if (isAdmin) return true
  return visibleCompanyIds.includes(companyId)
}
