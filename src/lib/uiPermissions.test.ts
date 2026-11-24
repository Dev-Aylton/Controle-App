import { describe, expect, it } from 'vitest'
import { canCreateProduct, canDeactivate, canInvite, canManageCompany, canPromote, canRequestPurchase, canReviewPurchase, canViewCompanyCode, canViewStock } from './uiPermissions'

describe('permissões da interface', () => {
  it('reconhece cargos que podem gerenciar empresa', () => {
    expect(canManageCompany('owner', false)).toBe(true)
    expect(canManageCompany('manager', false)).toBe(true)
    expect(canManageCompany('employee', false)).toBe(false)
    expect(canManageCompany(null, true)).toBe(true)
  })

  it('permite cadastrar produto e consultar saldo ao funcionário sem permitir alteração', () => {
    expect(canCreateProduct('employee', false)).toBe(true)
    expect(canViewStock('employee', false)).toBe(true)
    expect(canManageCompany('employee', false)).toBe(false)
  })

  it('limita convite e promoção', () => {
    expect(canInvite('owner', false, 'manager')).toBe(true)
    expect(canInvite('owner', false, 'owner')).toBe(false)
    expect(canInvite('manager', false, 'manager')).toBe(false)
    expect(canInvite(null, true, 'owner')).toBe(true)
    expect(canPromote('owner', false)).toBe(true)
    expect(canPromote('employee', false)).toBe(false)
  })

  it('impede desativação de si mesmo e aplica regras por cargo', () => {
    expect(canDeactivate('owner', false, 'manager', 'a', 'a')).toBe(false)
    expect(canDeactivate('owner', false, 'manager', 'a', 'b')).toBe(true)
    expect(canDeactivate('manager', false, 'employee', 'a', 'b')).toBe(true)
    expect(canDeactivate('manager', false, 'manager', 'a', 'b')).toBe(false)
    expect(canDeactivate('employee', false, 'employee', 'a', 'b')).toBe(false)
  })

  it('mostra código apenas para admin, proprietário e gerente', () => {
    expect(canViewCompanyCode('employee', false)).toBe(false)
    expect(canViewCompanyCode('manager', false)).toBe(true)
    expect(canViewCompanyCode(null, true)).toBe(true)
  })

  it('oculta menus novos de gestão para funcionário', () => {
    expect(canManageCompany('employee', false)).toBe(false)
    expect(canManageCompany('manager', false)).toBe(true)
    expect(canManageCompany('owner', false)).toBe(true)
    expect(canManageCompany(null, true)).toBe(true)
  })

  it('admin de suporte pode gerenciar todas as empresas', () => {
    expect(canManageCompany(null, true)).toBe(true)
  })

  it('funcionário pode solicitar compra sem bloquear suas outras atividades', () => {
    expect(canRequestPurchase('employee', false)).toBe(true)
    expect(canReviewPurchase('employee', false)).toBe(false)
  })

  it('qualquer gerente ou proprietário ativo pode revisar solicitações', () => {
    expect(canReviewPurchase('manager', false)).toBe(true)
    expect(canReviewPurchase('owner', false)).toBe(true)
  })
})
