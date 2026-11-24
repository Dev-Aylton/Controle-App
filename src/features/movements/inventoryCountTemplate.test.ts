import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { buildInventoryCountRows, findInventoryCountProduct, parseInventoryCountFile, suggestInventoryCountProducts } from './inventoryCountTemplate'

describe('modelo de contagem', () => {
  it('gera cabeçalho e linhas por produto', () => {
    const rows = buildInventoryCountRows('Estoque', [
      { id: 'p1', name: 'Vodka', sku: 'P001', categoryName: 'Vodka', unit: 'Garrafa', volumeMl: 998, doseMl: 50 },
      { id: 'p2', name: 'Coca-Cola', sku: 'P036', categoryName: 'Softs', unit: 'Lata', volumeMl: 350, doseMl: null },
    ])
    expect(rows[0]).toEqual(['Código', 'Tipo/Categoria', 'Produto', 'Unidade', 'Volume/Peso', 'Dose (ml)', 'Ambiente', 'Quantidade contada', 'Observações'])
    expect(rows[1]).toEqual(['P001', 'Vodka', 'Vodka', 'Garrafa', '998 ml', '50', 'Estoque', '', ''])
    expect(rows[2]).toEqual(['P036', 'Softs', 'Coca-Cola', 'Lata', '350 ml', '', 'Estoque', '', ''])
  })

  it('mantém os campos operacionais completos do modelo', () => {
    const rows = buildInventoryCountRows('Bar VIP', [
      { id: 'p1', name: 'Vodka Premium', sku: 'P001', categoryName: 'Vodka', unit: 'Garrafa', volumeMl: 998, doseMl: 50 },
    ])
    expect(rows[0]).toHaveLength(9)
    expect(rows[0]).toContain('Quantidade contada')
    expect(rows[0]).toContain('Volume/Peso')
    expect(rows[0]).toContain('Tipo/Categoria')
  })

  it('inclui ambiente, data e hora no modelo personalizado', () => {
    const rows = buildInventoryCountRows('Bar VIP', [
      { id: 'p1', name: 'Vodka Premium', sku: 'P001', categoryName: 'Vodka', unit: 'Garrafa', volumeMl: 998, doseMl: 50 },
    ])
    expect(rows.at(-1)?.[6]).toBe('Bar VIP')
  })

  it('identifica a variante correta pelo SKU', () => {
    const products = [
      { id: 'p1', name: 'Smirnoff', sku: 'SMI-998', unit: 'garrafa', volumeMl: 998 },
      { id: 'p2', name: 'Smirnoff', sku: 'SMI-1500', unit: 'garrafa', volumeMl: 1500 },
    ]
    expect(findInventoryCountProduct('SMI-1500', '', '', '', products)?.product.id).toBe('p2')
  })

  it('identifica nome e volume quando o SKU não foi preenchido', () => {
    const products = [
      { id: 'p1', name: 'Smirnoff', sku: 'SMI-998', unit: 'garrafa', volumeMl: 998 },
      { id: 'p2', name: 'Smirnoff', sku: 'SMI-1500', unit: 'garrafa', volumeMl: 1500 },
    ]
    expect(findInventoryCountProduct('', 'Smirnoff', 'Garrafa', '1500', products)?.product.id).toBe('p2')
  })

  it('sugere SKU e nome próximos para linhas não reconhecidas', () => {
    const products = [
      { id: 'p1', name: 'Smirnoff', sku: 'SMI-998' },
      { id: 'p2', name: 'Absolut', sku: 'ABS-750' },
    ]
    expect(suggestInventoryCountProducts('998', 'Smirnof', products)[0]?.id).toBe('p1')
  })

  it('lê o modelo CSV oficial preenchido', async () => {
    const csv = [
      'Controle-App;Modelo oficial de contagem',
      'Versão;1.0',
      'Tipo;Contagem',
      'Ambiente;Bar',
      '',
      'Código;Tipo/Categoria;Produto;Unidade;Volume/Peso;Dose (ml);Ambiente;Quantidade contada;Observações',
      'P001;Vodka;Vodka;Garrafa;998 ml;50;Bar;12,5;Conferido',
    ].join('\r\n')
    const file = new File([csv], 'modelo-contagem.csv', { type: 'text/csv' })
    const rows = await parseInventoryCountFile(file)
    expect(rows[0]).toMatchObject({ code: 'P001', name: 'Vodka', quantity: 12.5, environment: 'Bar' })
  })

  it('lê o modelo XLSX oficial preenchido', async () => {
    const sheet = XLSX.utils.aoa_to_sheet([
      ['Controle-App'],
      ['Modelo oficial de contagem'],
      ['Versão', '1.0', 'Tipo', 'Contagem'],
      [],
      ['Código', 'Tipo/Categoria', 'Produto', 'Unidade', 'Volume/Peso', 'Dose (ml)', 'Ambiente', 'Quantidade contada', 'Observações'],
      ['P001', 'Vodka', 'Vodka', 'Garrafa', '998 ml', 50, 'Bar', 12.5, 'Conferido'],
    ])
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, 'Contagem')
    const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
    const file = new File([bytes], 'modelo-contagem.xlsx')
    const rows = await parseInventoryCountFile(file)
    expect(rows[0]).toMatchObject({ code: 'P001', name: 'Vodka', quantity: 12.5, environment: 'Bar' })
  })
})
