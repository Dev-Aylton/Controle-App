import { describe, expect, it } from 'vitest'
import { canDeactivate, canInvite, canManageCompany, canPromote, canRequestPurchase, canReviewPurchase, canViewCompanyCode } from '../../lib/uiPermissions'

describe('casos de uso por entidade', () => {
  it('administrador pode operar todas as empresas em modo suporte', () => {
    expect(canManageCompany(null, true)).toBe(true)
    expect(canViewCompanyCode(null, true)).toBe(true)
  })

  it('proprietário pode gerenciar a empresa e convidar gerentes', () => {
    expect(canManageCompany('owner', false)).toBe(true)
    expect(canInvite('owner', false, 'manager')).toBe(true)
    expect(canPromote('owner', false)).toBe(true)
  })

  it('gerente pode operar estoque sem possuir ou convidar proprietário', () => {
    expect(canManageCompany('manager', false)).toBe(true)
    expect(canInvite('manager', false, 'owner')).toBe(false)
    expect(canInvite('manager', false, 'manager')).toBe(false)
  })

  it('funcionário não pode administrar produtos, vendas, compras ou equipe', () => {
    expect(canManageCompany('employee', false)).toBe(false)
    expect(canPromote('employee', false)).toBe(false)
    expect(canViewCompanyCode('employee', false)).toBe(false)
  })

  it('ninguem pode desativar a própria vinculação pela interface', () => {
    expect(canDeactivate('owner', false, 'owner', 'self', 'self')).toBe(false)
    expect(canDeactivate('manager', false, 'employee', 'self', 'employee')).toBe(true)
  })

  it('compra funciona com solicitação do funcionário e aprovação de qualquer gestão', () => {
    expect(canRequestPurchase('employee', false)).toBe(true)
    expect(canReviewPurchase('manager', false)).toBe(true)
    expect(canReviewPurchase('owner', false)).toBe(true)
  })
})
