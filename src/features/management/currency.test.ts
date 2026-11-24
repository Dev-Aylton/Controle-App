import { describe, expect, it } from 'vitest'
import { formatBrazilianCurrency, formatBrazilianCurrencyInput, parseBrazilianCurrency } from './currency'

describe('formatação monetária brasileira', () => {
  it('aceita vírgula e ponto como separador decimal', () => {
    expect(parseBrazilianCurrency('12,50')).toBe(12.5)
    expect(parseBrazilianCurrency('12.50')).toBe(12.5)
  })
  it('remove R$ e separadores brasileiros', () => {
    expect(parseBrazilianCurrency('R$ 1.234,50')).toBe(1234.5)
  })
  it('formata entrada e exibição em padrão brasileiro', () => {
    expect(formatBrazilianCurrencyInput(1234.5)).toBe('1.234,50')
    expect(formatBrazilianCurrency(1234.5)).toBe('R$ 1.234,50')
  })
})
