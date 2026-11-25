import { describe, expect, it } from 'vitest'
import { parseProductsCsv, parseNumber } from './parseProductsCsv'
import { formatBRL } from './formatCurrency'
import { calculateStockValue } from '../stockValue'

describe('importação de produtos', () => {
  it('lê o CSV oficial com cabeçalho e metadados', () => {
    const csv = [
      'Controle-App;Modelo oficial de produtos',
      'Versão;1.0',
      'Tipo;Produtos',
      'Preencha uma linha por produto ou variante.;',
      '',
      'nome;codigo;tipo_categoria;unidade;volume_ml;peso;dose_ml;estoque_minimo;estoque_maximo;custo',
      'Vodka;V001;Destilados;garrafa;998;;50;2;10;89,90',
    ].join('\r\n')
    const rows = parseProductsCsv(csv)
    expect(rows[0]).toMatchObject({ name: 'Vodka', sku: 'V001', unit: 'garrafa', volumeMl: 998, doseMl: 50, cost: 89.9 })
  })
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

  it('aceita unidades da planilha e dados de dose', () => {
    const rows = parseProductsCsv('nome;codigo;tipo_categoria;unidade;volume_ml;peso;dose_ml;estoque_minimo;estoque_maximo;custo\nVodka;P001;Vodka;Garrafa;998;;50;2;10;89,90')
    expect(rows[0].valid).toBe(true)
    expect(rows[0].unit).toBe('garrafa')
    expect(rows[0].volumeMl).toBe(998)
    expect(rows[0].doseMl).toBe(50)
    expect(rows[0].maxStock).toBe(10)
  })

  it('aceita insumos de bar e restaurante', () => {
    const rows = parseProductsCsv('nome;codigo;tipo_categoria;unidade;peso;estoque_minimo\nEspetinho de carne;E001;Carnes e espetinhos;porcao;0,180;20')
    expect(rows[0].valid).toBe(true)
    expect(rows[0].unit).toBe('porcao')
  })

  it('aceita peixes, verduras e peças sem serem tratados como bebidas', () => {
    const rows = parseProductsCsv('nome;codigo;tipo_categoria;unidade;peso;estoque_minimo\nAlface americana;V001;Verduras;peca;;20\nTilápia em posta;P001;Peixes;porcao;0,180;20')
    expect(rows[0].valid).toBe(true)
    expect(rows[1].valid).toBe(true)
    expect(rows[1].unit).toBe('porcao')
  })

  it('detecta duplicados no arquivo', () => {
    const rows = parseProductsCsv('nome;codigo;categoria;unidade;estoque_minimo;custo\nÁgua;A1;;l;1;2\nÁgua;A1;;l;1;2')
    expect(rows[1].errors.some((error) => error.includes('Duplicado'))).toBe(true)
  })

  it('permite versões do mesmo produto com volumes diferentes', () => {
    const rows = parseProductsCsv('nome;codigo;categoria;unidade;volume_ml;dose_ml\nSmirnoff;SMI-998;Destilados;garrafa;998;50\nSmirnoff;SMI-1500;Destilados;garrafa;1500;50')
    expect(rows[0].valid).toBe(true)
    expect(rows[1].valid).toBe(true)
  })

  it('bloqueia SKU reutilizado em outra variante', () => {
    const rows = parseProductsCsv('nome;codigo;categoria;unidade;volume_ml;dose_ml\nSmirnoff;SMI-998;Destilados;garrafa;998;50\nSmirnoff;SMI-998;Destilados;garrafa;1500;50')
    expect(rows[1].valid).toBe(false)
    expect(rows[1].errors.some((error) => error.includes('Código/SKU'))).toBe(true)
  })

  it('formata número e moeda', () => {
    expect(parseNumber('1.234,50')).toBe(1234.5)
    expect(parseNumber('1,234.50')).toBe(1234.5)
    expect(parseNumber('12.5')).toBe(12.5)
    expect(parseNumber('12,5')).toBe(12.5)
    expect(formatBRL(1234.5)).toContain('1.234')
  })

  it('calcula valor de estoque parado', () => {
    expect(calculateStockValue(20, 12.5)).toBe(250)
  })
})
