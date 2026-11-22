import { describe, expect, it } from 'vitest'
import { calculateStockLevels } from './stockSuggestions'

describe('sugestão de estoque', () => {
  it('arredonda mínimo para 2 dias e máximo para 7 dias', () => {
    expect(calculateStockLevels(1.2)).toEqual({ minimum: 3, maximum: 9 })
  })
})
