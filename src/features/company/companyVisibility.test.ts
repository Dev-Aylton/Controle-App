import { describe, expect, it } from 'vitest'
import { getVisibleCompanyIds, canSelectCompany } from './companyVisibility'

describe('visibilidade de empresas', () => {
  it('admin vê todas as empresas', () => {
    expect(getVisibleCompanyIds(true, ['a', 'b', 'c'], [])).toEqual(['a', 'b', 'c'])
  })

  it('proprietário, gerente e funcionário veem apenas vínculos ativos', () => {
    const memberships = [
      { company_id: 'a', role: 'owner' as const, active: true },
      { company_id: 'b', role: 'manager' as const, active: true },
      { company_id: 'c', role: 'employee' as const, active: false },
    ]
    expect(getVisibleCompanyIds(false, ['a', 'b', 'c'], memberships)).toEqual(['a', 'b'])
  })

  it('bloqueia seleção direta de empresa não vinculada', () => {
    expect(canSelectCompany(false, ['a', 'b'], 'c')).toBe(false)
    expect(canSelectCompany(false, ['a', 'b'], 'b')).toBe(true)
  })
})
