import { describe, expect, it } from 'vitest'
import { generateCsv } from './csv'

describe('exportação CSV', () => {
  it('inclui BOM, separador e números no formato brasileiro', () => {
    expect(generateCsv([['Produto', 'Quantidade'], ['Água', 1234.5], ['Ajuste', -1.25]]))
      .toBe('\uFEFFProduto;Quantidade\r\nÁgua;1.234,5\r\nAjuste;-1,25')
  })

  it('protege fórmulas em textos, inclusive após espaço em branco', () => {
    expect(generateCsv([['=1+1', '+1', '-1', '@cmd', ' =1']]))
      .toBe("\uFEFF'=1+1;'+1;'-1;'@cmd;' =1")
  })

  it('escapa delimitadores, aspas e quebras de linha', () => {
    expect(generateCsv([['a;b', 'aspas "duplas"', 'linha 1\nlinha 2', null]]))
      .toBe('\uFEFF"a;b";"aspas ""duplas""";"linha 1\nlinha 2";')
  })

  it('rejeita números inválidos', () => {
    expect(() => generateCsv([[NaN]])).toThrow('número inválido')
  })
})
