import { describe, expect, it } from 'vitest'
import {
  calculateSalesFinancials,
  normalizeExternalName,
  parseSalesRows,
  validateSalesPricing,
  validateSalesPreview,
} from './salesRules'

describe('importação de vendas', () => {
  it('normaliza nome externo', () => {
    expect(normalizeExternalName(' Cerveja  IPA! ')).toBe('cerveja ipa')
  })
  it('faz mapeamento e aceita quantidade brasileira', () => {
    const rows = parseSalesRows([{ Item: 'Água', Quant: '2,5', Tipo: 'Dose' }], {
      name: 'Item', quantity: 'Quant', saleType: 'Tipo',
    })
    expect(rows).toEqual([expect.objectContaining({ externalName: 'Água', quantity: 2.5, saleType: 'dose' })])
  })
  it('exige vínculo ou ignorar explícito', () => {
    expect(validateSalesPreview([{ externalName: 'X', quantity: 1, saleType: 'unidade', productId: null, ignored: false }])).toContain('Vincule')
    expect(validateSalesPreview([{ externalName: 'X', quantity: 1, saleType: 'unidade', productId: null, ignored: true }])).toBe('Nenhum item foi selecionado.')
    expect(validateSalesPreview([{ externalName: 'X', quantity: 0.0001, saleType: 'unidade', productId: 'p1', ignored: false }])).toContain('no máximo 3 casas decimais')
  })
  it('calcula faturamento e CMV de unidades', () => {
    expect(calculateSalesFinancials(
      { quantity: 2, saleType: 'unidade' },
      { unit_cost: 4, base_unit_cost: null, unit_price: 10, dose_price: null, volume_ml: null, dose_ml: null },
    )).toEqual({ salePrice: 10, revenue: 20, costOfGoodsSold: 8, grossProfit: 12 })
  })
  it('converte vendas por dose para custo de unidades completas', () => {
    expect(calculateSalesFinancials(
      { quantity: 19, saleType: 'dose' },
      { unit_cost: 4, base_unit_cost: null, unit_price: 10, dose_price: 2, volume_ml: 570, dose_ml: 30 },
    )).toEqual({ salePrice: 2, revenue: 38, costOfGoodsSold: 4, grossProfit: 34 })
  })
  it('não estima CMV ou lucro quando o custo não foi cadastrado', () => {
    expect(calculateSalesFinancials(
      { quantity: 1, saleType: 'unidade' },
      { unit_cost: null, base_unit_cost: null, unit_price: 10, dose_price: null, volume_ml: null, dose_ml: null },
    )).toEqual({ salePrice: 10, revenue: 10, costOfGoodsSold: null, grossProfit: null })
  })
  it('impede importação quando falta preço ou volume válido para dose', () => {
    const items = [{ externalName: 'Vodka', quantity: 1, saleType: 'dose' as const, productId: 'p1', ignored: false }]
    expect(validateSalesPricing(items, new Map())).toContain('Cadastre o preço de venda por dose')
    expect(validateSalesPricing(items, new Map([['p1', {
      unit_cost: 3, base_unit_cost: null, unit_price: 10, dose_price: 2, volume_ml: null, dose_ml: null,
    }]]))).toContain('Cadastre volume e dose válidos')
  })
})
