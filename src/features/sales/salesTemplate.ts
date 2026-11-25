import * as XLSX from 'xlsx'
import { downloadCsv, protectSpreadsheetText } from '../management/csv'

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

export function isOfficialSalesTemplateColumns(columns: string[]) {
  return SALES_TEMPLATE_COLUMNS.every((column) => columns.includes(column))
}

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
    ['Versão', '1.0', 'Tipo', 'Vendas'],
    ['Empresa', protectSpreadsheetText(companyName), 'Ambiente', protectSpreadsheetText(environmentName)],
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
  const border = {
    top: { style: 'thin', color: { rgb: 'C8D8D2' } },
    bottom: { style: 'thin', color: { rgb: 'C8D8D2' } },
    left: { style: 'thin', color: { rgb: 'C8D8D2' } },
    right: { style: 'thin', color: { rgb: 'C8D8D2' } },
  }
  worksheet['A1'].s = { font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F7A65' } }, alignment: { horizontal: 'center' } }
  worksheet['A2'].s = { font: { bold: true, sz: 12, color: { rgb: '173A35' } }, alignment: { horizontal: 'center' } }
  for (let column = 0; column < 4; column += 1) {
    const header = XLSX.utils.encode_cell({ r: 7, c: column })
    if (worksheet[header]) {
      worksheet[header].s = { font: { bold: true, color: { rgb: '173A35' } }, fill: { fgColor: { rgb: 'E7F3EF' } }, border, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } }
    }
  }
  worksheet['!autofilter'] = { ref: 'A8:D38' }
  worksheet['!freeze'] = { xSplit: 0, ySplit: 8, topLeftCell: 'A9', state: 'frozen' }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Vendas')
  const catalogWorksheet = XLSX.utils.json_to_sheet(
    products.map((product) => ({
      'Código/SKU': protectSpreadsheetText(product.sku ?? ''),
      Produto: protectSpreadsheetText(product.name),
      Unidade: protectSpreadsheetText(product.unit),
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

export function downloadSalesCsvTemplate(
  companyName: string,
  environmentName: string,
  products: SalesTemplateProduct[],
) {
  downloadCsv(
    `modelo-vendas-${companyName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`,
    [
      ['Controle-App', 'Modelo oficial de vendas'],
      ['Versão', '1.0'],
      ['Tipo', 'Vendas'],
      ['Empresa', companyName, 'Ambiente', environmentName],
      ['Preencha uma linha por venda ou grupo de vendas.', '', '', ''],
      [],
      [...SALES_TEMPLATE_COLUMNS],
      ...products.map((product) => [
        product.sku ?? '',
        product.name,
        '',
        'unidade',
      ]),
    ],
  )
}
