import { describe, expect, it } from 'vitest'
import { findProductImportMatches, generateProductSku, prepareProductImportResolutions } from './productImportResolution'
import type { ParsedProductRow } from './parseProductsCsv'

function parsedRow(overrides: Partial<ParsedProductRow>): ParsedProductRow {
  return {
    line: 2,
    valid: true,
    name: 'Filé de frango',
    sku: '',
    category: 'Aves',
    unit: 'kg',
    minStock: 5,
    maxStock: null,
    volumeMl: null,
    doseMl: null,
    weight: null,
    cost: 20,
    errors: [],
    ...overrides,
  }
}

describe('resolução assistida de importação', () => {
  it('sugere um produto existente pelo nome quando o SKU está ausente', () => {
    const matches = findProductImportMatches(parsedRow({}), [{
      id: 'p1',
      name: 'Filé de frango',
      sku: 'AVE-FILE-1',
      unit: 'kg',
      volumeMl: null,
      doseMl: null,
      weightG: null,
    }])
    expect(matches[0]?.id).toBe('p1')
    expect(matches[0]?.score).toBeGreaterThanOrEqual(55)
  })

  it('gera SKU único como sugestão, nunca aplica automaticamente', () => {
    expect(generateProductSku('Filé de frango', 'kg', null, null)).toBe('FIL-DE-FRA-KG')
  })

  it('deixa toda correspondência ambígua para decisão do usuário', () => {
    const resolved = prepareProductImportResolutions([parsedRow({})], [
      { id: 'p1', name: 'Filé de frango', sku: 'F1', unit: 'kg', volumeMl: null, doseMl: null, weightG: null },
      { id: 'p2', name: 'File frango', sku: 'F2', unit: 'kg', volumeMl: null, doseMl: null, weightG: null },
    ])
    expect(resolved[0].action).toBeNull()
    expect(resolved[0].reviewed).toBe(false)
  })

  it('distingue variantes pela embalagem e pelo volume', () => {
    const matches = findProductImportMatches(parsedRow({
      name: 'Smirnoff',
      sku: '',
      unit: 'garrafa',
      volumeMl: 1500,
    }), [{
      id: 'p998',
      name: 'Smirnoff',
      sku: 'SMI-998',
      unit: 'garrafa',
      volumeMl: 998,
      doseMl: 50,
      weightG: null,
    }, {
      id: 'p1500',
      name: 'Smirnoff',
      sku: 'SMI-1500',
      unit: 'garrafa',
      volumeMl: 1500,
      doseMl: 50,
      weightG: null,
    }])
    expect(matches[0]?.id).toBe('p1500')
  })
})
