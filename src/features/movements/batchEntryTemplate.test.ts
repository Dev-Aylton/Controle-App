import { describe, expect, it } from 'vitest'
import {
  buildBatchEntryRows,
  findBatchEntryProduct,
  normalizeBatchIdentifier,
  suggestBatchEntryProducts,
} from './batchEntryTemplate'

describe('modelo de entrada em lote', () => {
  it('gera um modelo simples por ambiente', () => {
    const rows = buildBatchEntryRows('Estoque', [
      { id: 'p1', name: 'Água', sku: 'A001', unit: 'garrafa' },
    ])
    expect(rows[0]).toEqual(['Código', 'Produto', 'Unidade', 'Quantidade de entrada', 'Observação', 'Ambiente'])
    expect(rows[1]).toEqual(['A001', 'Água', 'garrafa', '', '', 'Estoque'])
  })

  it('identifica produto pelo SKU', () => {
    const product = findBatchEntryProduct(' a-001 ', 'Outro nome', [
      { id: 'p1', name: 'Água mineral', sku: 'A-001', unit: 'garrafa' },
    ])
    expect(product?.id).toBe('p1')
  })

  it('identifica produto pelo nome normalizado', () => {
    const product = findBatchEntryProduct('', '  Agua Mineral  ', [
      { id: 'p1', name: 'Água Mineral', sku: 'A-001', unit: 'garrafa' },
    ])
    expect(product?.id).toBe('p1')
  })

  it('normaliza acentos e espaços para comparações simples', () => {
    expect(normalizeBatchIdentifier('  Coca   Cola  ')).toBe('coca cola')
  })

  it('sugere produto aproximado quando nome ou SKU não são exatos', () => {
    const suggestions = suggestBatchEntryProducts('A-001', 'Agua Mineral', [
      { id: 'p1', name: 'Água Mineral', sku: 'A001', unit: 'garrafa' },
      { id: 'p2', name: 'Refrigerante', sku: 'R001', unit: 'lata' },
    ])
    expect(suggestions[0]?.id).toBe('p1')
  })
})
