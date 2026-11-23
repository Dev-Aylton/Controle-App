import { describe, expect, it } from 'vitest'
import { parseOfficialSalesRows, SALES_TEMPLATE_COLUMNS } from './salesTemplate'

describe('modelo oficial de vendas', () => {
  it('usa as quatro colunas obrigatórias', () => {
    expect(SALES_TEMPLATE_COLUMNS).toEqual(['Código/SKU', 'Produto', 'Quantidade', 'Tipo'])
  })

  it('aceita linha completa preenchida conforme o modelo', () => {
    const rows = parseOfficialSalesRows([{
      'Código/SKU': 'SMI-998',
      Produto: 'Smirnoff',
      Quantidade: '3',
      Tipo: 'unidade',
    }])
    expect(rows[0].valid).toBe(true)
    expect(rows[0].quantity).toBe(3)
  })

  it('bloqueia quantidade vazia ou negativa', () => {
    expect(parseOfficialSalesRows([{
      'Código/SKU': 'SMI-998',
      Produto: 'Smirnoff',
      Quantidade: '-1',
      Tipo: 'unidade',
    }])[0].valid).toBe(false)
  })

  it('bloqueia linha sem SKU e sem nome', () => {
    expect(parseOfficialSalesRows([{
      'Código/SKU': '',
      Produto: '',
      Quantidade: '2',
      Tipo: 'unidade',
    }])[0].valid).toBe(false)
  })

  it('bloqueia tipo diferente de unidade ou dose', () => {
    expect(parseOfficialSalesRows([{
      'Código/SKU': 'SMI-998',
      Produto: 'Smirnoff',
      Quantidade: '2',
      Tipo: 'garrafa',
    }])[0].valid).toBe(false)
  })
})
