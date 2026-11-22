import { describe, expect, it } from 'vitest'
import { findUnsafeRoleChecks } from './sql-role-safety.mjs'

describe('trava estática de cargos SQL', () => {
  it('reprova member_role not in sem coalesce', () => {
    expect(findUnsafeRoleChecks("if public.member_role(company_id) not in ('owner','manager') then")).toHaveLength(1)
  })
  it('aprova helper seguro', () => {
    expect(findUnsafeRoleChecks("if not coalesce(public.is_manager_or_owner(company_id), false) then")).toHaveLength(0)
  })
  it('reprova enum com fallback vazio', () => {
    expect(findUnsafeRoleChecks("coalesce(public.member_role(company_id), '') <> 'owner'")).toHaveLength(1)
  })
})
