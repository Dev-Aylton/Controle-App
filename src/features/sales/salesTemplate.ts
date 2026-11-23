import * as XLSX from 'xlsx'

export type SalesTemplateProduct = {
  id: string
  name: string
  sku: string | null
  unit: string
  volumeMl: number | null
  doseMl: number | null
}

export const SALES_TEMPLATE_COLUMNS = [
  'Código/SKU',
  'Produto',
  'Quantidade',
  'Tipo',
] as const

export function parseOfficialSalesRows(rawRows: Record<string, unknown>[]) {
  return rawRows.map((row, index) => {
    const sku = String(row['Código/SKU'] ?? '').trim()
    const name = String(row['Produto'] ?? '').trim()
    const quantityText = String(row['Quantidade'] ?? '').replace(',', '.').trim()
    const quantity = quantityText === '' ? Number.NaN : Number(quantityText)
    const saleTypeText = String(row['Tipo'] ?? '').trim().toLowerCase()
    const saleType: 'dose' | 'unidade' = saleTypeText.includes('dose') ? 'dose' : 'unidade'
    const errors: string[] = []
    if (!sku && !name) errors.push('Informe o código/SKU ou o nome do produto.')
    if (!Number.isFinite(quantity) || quantity <= 0) errors.push('Quantidade deve ser maior que zero.')
    if (saleTypeText && !['unidade', 'dose'].includes(saleTypeText)) {
      errors.push('Tipo deve ser “unidade” ou “dose”.')
    }
    return {
      line: index + 2,
      sku,
      name,
      quantity,
      saleType,
      errors,
      valid: errors.length === 0,
    }
  })
}

export function downloadSalesTemplate(
  companyName: string,
  environmentName: string,
  products: SalesTemplateProduct[],
) {
  const now = new Date()
  const dateText = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(now)
  const timeText = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(now)

  const instructionRows = [
    ['Controle-App', '', '', ''],
    ['Modelo oficial de vendas', '', '', ''],
    ['Empresa', companyName, 'Ambiente', environmentName],
    ['Gerado em', dateText, 'Hora', timeText],
    ['Preencha uma linha por venda ou grupo de vendas.', '', '', ''],
    ['', '', '', ''],
    [...SALES_TEMPLATE_COLUMNS],
  ]

  const worksheet = XLSX.utils.aoa_to_sheet([
    ...instructionRows,
    ...Array.from({ length: 30 }, () => ['', '', '', '']),
  ])
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 3 } },
  ]
  worksheet['!cols'] = [
    { wch: 20 },
    { wch: 42 },
    { wch: 16 },
    { wch: 14 },
  ]
  worksheet['!rows'] = [
    { hpt: 30 },
    { hpt: 24 },
    { hpt: 22 },
    { hpt: 22 },
    { hpt: 22 },
    { hpt: 8 },
    { hpt: 34 },
  ]

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendas')
  const catalogWorksheet = XLSX.utils.json_to_sheet(
    products.map((product) => ({
      'Código/SKU': product.sku ?? '',
      Produto: product.name,
      Unidade: product.unit,
      'Volume (ml)': product.volumeMl ?? '',
      'Dose (ml)': product.doseMl ?? '',
    })),
  )
  catalogWorksheet['!cols'] = [
    { wch: 20 },
    { wch: 42 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
  ]
  XLSX.utils.book_append_sheet(workbook, catalogWorksheet, 'Produtos cadastrados')
  XLSX.writeFile(
    workbook,
    `modelo-vendas-${companyName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${now.toISOString().slice(0, 10)}.xlsx`,
  )
}
