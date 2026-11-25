import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'
import { parseProductsCsv } from './parseProductsCsv'
import { parseInventoryCountFile } from '../../movements/inventoryCountTemplate'

function readMatrix(path: string) {
  const workbook = XLSX.read(readFileSync(path), { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: '' })
}

function readStyledSheet(path: string) {
  const workbook = XLSX.read(readFileSync(path), { type: 'buffer', cellStyles: true })
  return workbook.Sheets[workbook.SheetNames[0]]
}

describe('arquivos XLSX oficiais estáticos', () => {
  it('modelo de produtos usa marcador, versão e cabeçalho completo', () => {
    const matrix = readMatrix('public/modelo-produtos.xlsx')
    expect(matrix[0]?.[0]).toBe('Controle-App')
    expect(matrix[1]?.[0]).toBe('Modelo oficial de produtos')
    expect(matrix[5]).toEqual([
      'nome',
      'codigo',
      'tipo_categoria',
      'unidade',
      'volume_ml',
      'peso',
      'dose_ml',
      'estoque_minimo',
      'estoque_maximo',
      'custo',
    ])
  })

  it('modelo de contagem usa marcador, versão e cabeçalho completo', () => {
    const matrix = readMatrix('public/modelo-contagem.xlsx')
    expect(matrix[0]?.[0]).toBe('Controle-App')
    expect(matrix[1]?.[0]).toBe('Modelo oficial de contagem')
    expect(matrix[5]).toEqual([
      'Código',
      'Tipo/Categoria',
      'Produto',
      'Unidade',
      'Volume/Peso',
      'Dose (ml)',
      'Ambiente',
      'Quantidade contada',
      'Observações',
    ])
  })

  it('modelos XLSX incluem filtros e grade visível em todas as células da tabela', () => {
    const products = readStyledSheet('public/modelo-produtos.xlsx')
    const count = readStyledSheet('public/modelo-contagem.xlsx')
    expect(products['!autofilter']?.ref).toBe('A6:J36')
    expect(products.A6.s.fgColor.rgb).toMatch(/E7F3EF$/i)
    expect(products.A7.s.fgColor.rgb).toMatch(/F5F9F7$/i)
    expect(products.J7.s).toBeDefined()
    expect(count['!autofilter']?.ref).toBe('A6:I106')
    expect(count.A6.s.fgColor.rgb).toMatch(/E7F3EF$/i)
    expect(count.I7.s).toBeDefined()
  })

  it('modelos CSV oficiais possuem os mesmos marcadores e cabeçalhos', () => {
    const productCsv = readFileSync('public/modelo-produtos.csv', 'utf8').replace(/^\uFEFF/, '')
    expect(productCsv).toContain('Controle-App;Modelo oficial de produtos')
    expect(productCsv).toContain('nome;codigo;tipo_categoria;unidade')

    const countCsv = readFileSync('public/modelo-contagem.csv', 'utf8').replace(/^\uFEFF/, '')
    expect(countCsv).toContain('Controle-App;Modelo oficial de contagem')
    expect(countCsv).toContain('Código;Tipo/Categoria;Produto')
    expect(countCsv).toContain('Complete os campos em branco para identificar o produto, mantenha os dados preenchidos')
    expect(productCsv.startsWith('sep=;')).toBe(true)
    expect(countCsv.startsWith('sep=;')).toBe(true)
  })

  it('lê os CSV oficiais depois de preenchidos pelo usuário', async () => {
    const productTemplate = readFileSync('public/modelo-produtos.csv', 'utf8')
    const productCsv = productTemplate.replace(
      ';;;;;;;;;',
      'Vodka Premium;"SKU;001";Destilados;garrafa;998;;50;2;10;"89,90"',
    )
    const products = parseProductsCsv(productCsv)
    expect(products).toHaveLength(1)
    expect(products[0]).toMatchObject({
      valid: true,
      name: 'Vodka Premium',
      sku: 'SKU;001',
      unit: 'garrafa',
      volumeMl: 998,
      doseMl: 50,
      cost: 89.9,
    })

    const countTemplate = readFileSync('public/modelo-contagem.csv', 'utf8')
    const countCsv = countTemplate.replace(
      ';;;;;;;;',
      'SKU001;Destilados;Vodka Premium;garrafa;998 ml;50;Bar;12.5;"Conferido; sem falta"',
    )
    const file = new File([countCsv], 'modelo-contagem.csv', { type: 'text/csv;charset=utf-8' })
    const counts = await parseInventoryCountFile(file)
    expect(counts).toHaveLength(1)
    expect(counts[0]).toMatchObject({
      code: 'SKU001',
      name: 'Vodka Premium',
      environment: 'Bar',
      quantity: 12.5,
    })
  })
})
