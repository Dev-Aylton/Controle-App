import { describe, expect, it } from 'vitest'
import { getMobileNavItems } from './mobileNavigation'

describe('barra inferior móvel', () => {
  it('oculta saldo do funcionário', () => {
    expect(getMobileNavItems('employee', false).map((item) => item.key)).not.toContain('stock')
  })
  it('inclui saldo e alertas para gestão', () => {
    expect(getMobileNavItems('manager', false).map((item) => item.key)).toEqual(expect.arrayContaining(['stock', 'alerts']))
  })
})
