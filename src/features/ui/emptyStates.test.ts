import { describe, expect, it } from 'vitest'
import { emptyStates } from './emptyStates'

describe('estados vazios', () => {
  it('oferece ação principal nas listas principais', () => {
    expect(emptyStates.products).toContain('primeiro produto')
    expect(emptyStates.environments).toContain('primeiro ambiente')
    expect(emptyStates.movements).toContain('primeira movimentação')
  })
})
