import { describe, expect, it } from 'vitest'
import { drawerAriaLabel, drawerCloseLabel } from './accountDrawerRules'

describe('painel da conta', () => {
  it('expõe rótulos acessíveis', () => {
    expect(drawerAriaLabel).toBe('Minha conta')
    expect(drawerCloseLabel).toBe('Fechar minha conta')
  })
})
