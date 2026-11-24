import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import * as XLSX from 'xlsx'

function readMatrix(path: string) {
  const workbook = XLSX.read(readFileSync(path), { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: '' })
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

  it('modelos CSV oficiais possuem os mesmos marcadores e cabeçalhos', () => {
    const productCsv = readFileSync('public/modelo-produtos.csv', 'utf8').replace(/^\uFEFF/, '')
    expect(productCsv).toContain('Controle-App;Modelo oficial de produtos')
    expect(productCsv).toContain('nome;codigo;tipo_categoria;unidade')

    const countCsv = readFileSync('public/modelo-contagem.csv', 'utf8').replace(/^\uFEFF/, '')
    expect(countCsv).toContain('Controle-App;Modelo oficial de contagem')
    expect(countCsv).toContain('Código;Tipo/Categoria;Produto')
  })
})
