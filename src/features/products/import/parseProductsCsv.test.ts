import { describe, expect, it } from 'vitest'
import { parseProductsCsv, parseNumber } from './parseProductsCsv'
import { formatBRL } from './formatCurrency'
import { calculateStockValue } from '../stockValue'

describe('importação de produtos', () => {
  it('detecta separador ponto e vírgula', () => {
    const rows = parseProductsCsv('nome,código,categoria,unidade,estoque_minimo,custo\nCerveja,CEV-1,Bebidas,un,10,12,50')
    expect(rows.length).toBeGreaterThan(0)
  })

  it('detecta ponto e vírgula', () => {
    const rows = parseProductsCsv('nome;codigo;categoria;unidade;estoque_minimo;custo\nCerveja;CEV-1;Bebidas;un;10;12,50')
    expect(rows[0].name).toBe('Cerveja')
    expect(rows[0].cost).toBe(12.5)
  })

  it('rejeita unidade inválida e custo negativo', () => {
    const rows = parseProductsCsv('nome;codigo;categoria;unidade;estoque_minimo;custo\nÁgua;A1;;litro;1;-2')
    expect(rows[0].valid).toBe(false)
    expect(rows[0].errors).toContain('Unidade inválida')
    expect(rows[0].errors).toContain('Custo negativo')
  })

  it('detecta duplicados no arquivo', () => {
    const rows = parseProductsCsv('nome;codigo;categoria;unidade;estoque_minimo;custo\nÁgua;A1;;l;1;2\nÁgua;A1;;l;1;2')
    expect(rows[1].errors.some((error) => error.includes('Duplicado'))).toBe(true)
  })

  it('formata número e moeda', () => {
    expect(parseNumber('1.234,50')).toBe(1234.5)
    expect(formatBRL(1234.5)).toContain('1.234')
  })

  it('calcula valor de estoque parado', () => {
    expect(calculateStockValue(20, 12.5)).toBe(250)
  })
})
