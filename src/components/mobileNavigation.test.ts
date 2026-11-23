import { describe, expect, it } from 'vitest'
import { getMobileNavItems } from './mobileNavigation'

describe('barra inferior móvel', () => {
  it('permite consulta de saldo ao funcionário', () => {
    expect(getMobileNavItems('employee', false).map((item) => item.key)).toContain('stock')
  })
  it('mantém produtos acessíveis ao funcionário pelo menu Mais', () => {
    expect(getMobileNavItems('employee', false).map((item) => item.key)).toContain('more')
  })
  it('inclui saldo e alertas para gestão', () => {
    expect(getMobileNavItems('manager', false).map((item) => item.key)).toEqual(expect.arrayContaining(['stock', 'products', 'movements']))
  })
  it('prioriza saldo e inventário para funcionário', () => {
    expect(getMobileNavItems('employee', false).map((item) => item.key)).toEqual(expect.arrayContaining(['stock', 'inventory', 'movements']))
  })
})
