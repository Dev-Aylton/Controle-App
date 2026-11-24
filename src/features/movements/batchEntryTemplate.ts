import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { downloadCsv } from '../management/csv'

export type BatchEntryProduct = {
  id: string
  name: string
  sku?: string | null
  unit?: string | null
  volumeMl?: number | null
  weightG?: number | null
}

export type BatchEntryRow = {
  code: string
  name: string
  unit: string
  quantity: number
  note: string
  line: number
}

export type BatchEntryMatch = {
  productId: string | null
  productName: string
  quantity: number
  valid: boolean
  message: string
  suggestions?: Array<{ id: string; name: string; sku: string | null }>
}

const normalizeHeader = (value: unknown) => String(value ?? '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '')

export function normalizeBatchIdentifier(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export function findBatchEntryProduct(code: string, name: string, products: BatchEntryProduct[]) {
  const cleanCode = normalizeBatchIdentifier(code)
  if (cleanCode) {
    const skuMatch = products.find((product) => normalizeBatchIdentifier(product.sku) === cleanCode)
    if (skuMatch) return skuMatch
  }
  const cleanName = normalizeBatchIdentifier(name)
  if (cleanName) {
    return products.find((product) => normalizeBatchIdentifier(product.name) === cleanName) ?? null
  }
  return null
}

export function suggestBatchEntryProducts(code: string, name: string, products: BatchEntryProduct[], limit = 5) {
  const terms = [normalizeBatchIdentifier(code), normalizeBatchIdentifier(name)].filter(Boolean)
  if (terms.length === 0) return []
  return products
    .map((product) => {
      const productName = normalizeBatchIdentifier(product.name)
      const productSku = normalizeBatchIdentifier(product.sku)
      let score = 0
      for (const term of terms) {
        if (term === productSku) score += 100
        if (term === productName) score += 80
        if (term && productSku.includes(term)) score += 35
        if (term && productName.includes(term)) score += 25
        if (term.length >= 3 && productName.startsWith(term)) score += 10
      }
      return { product, score }
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.product)
}

export function buildBatchEntryRows(environmentName: string, products: BatchEntryProduct[]) {
  return [
    ['Código', 'Produto', 'Unidade', 'Quantidade de entrada', 'Observação', 'Ambiente'],
    ...products.map((product) => [
      product.sku ?? '',
      product.name,
      product.unit ?? 'un',
      '',
      '',
      environmentName,
    ]),
  ]
}

export function downloadBatchEntryTemplate(environmentName: string, products: BatchEntryProduct[]) {
  const rows = buildBatchEntryRows(environmentName, products)
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['Controle-App', '', '', '', '', ''],
    ['Modelo oficial de entrada em lote', '', '', '', '', ''],
    ['Versão', '1.0', 'Tipo', 'Entrada em lote', 'Ambiente', environmentName],
    ['Preencha uma quantidade maior que zero em cada linha que deseja entrar.', '', '', '', '', ''],
    ['', '', '', '', '', ''],
    ...rows,
  ])
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
  ]
  worksheet['!cols'] = [
    { wch: 16 },
    { wch: 38 },
    { wch: 14 },
    { wch: 20 },
    { wch: 32 },
    { wch: 24 },
  ]
  const border = {
    top: { style: 'thin', color: { rgb: 'C8D8D2' } },
    bottom: { style: 'thin', color: { rgb: 'C8D8D2' } },
    left: { style: 'thin', color: { rgb: 'C8D8D2' } },
    right: { style: 'thin', color: { rgb: 'C8D8D2' } },
  }
  worksheet['A1'].s = { font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1F7A65' } }, alignment: { horizontal: 'center' } }
  worksheet['A2'].s = { font: { bold: true, sz: 12, color: { rgb: '173A35' } }, alignment: { horizontal: 'center' } }
  for (let column = 0; column < 6; column += 1) {
    const header = XLSX.utils.encode_cell({ r: 5, c: column })
    if (worksheet[header]) {
      worksheet[header].s = {
        font: { bold: true, color: { rgb: '173A35' } },
        fill: { fgColor: { rgb: 'E7F3EF' } },
        border,
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      }
    }
  }
  for (let row = 6; row < 6 + products.length; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      const cell = XLSX.utils.encode_cell({ r: row, c: column })
      if (worksheet[cell]) worksheet[cell].s = { border, alignment: { vertical: 'top', wrapText: true } }
    }
  }
  worksheet['!autofilter'] = { ref: `A6:F${Math.max(6, 5 + products.length)}` }
  worksheet['!freeze'] = { xSplit: 0, ySplit: 6, topLeftCell: 'A7', state: 'frozen' }
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Entradas')
  XLSX.writeFile(workbook, `modelo-entrada-${environmentName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.xlsx`)
}

export function downloadBatchEntryCsvTemplate(environmentName: string, products: BatchEntryProduct[]) {
  downloadCsv(
    `modelo-entrada-${environmentName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`,
    [
      ['Controle-App', 'Modelo oficial de entrada em lote'],
      ['Versão', '1.0'],
      ['Tipo', 'Entrada em lote'],
      ['Ambiente', environmentName],
      ['Preencha uma quantidade maior que zero em cada linha que deseja entrar.', ''],
      [],
      ['Código', 'Produto', 'Unidade', 'Quantidade de entrada', 'Observação', 'Ambiente'],
      ...products.map((product) => [
        product.sku ?? '',
        product.name,
        product.unit ?? 'un',
        '',
        '',
        environmentName,
      ]),
    ],
  )
}

export async function parseBatchEntryFile(file: File): Promise<BatchEntryRow[]> {
  const buffer = await file.arrayBuffer()
  let rawRows: Record<string, unknown>[]

  if (/\.xlsx?$/.test(file.name.toLowerCase())) {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames.find((name) => /entrada|movimenta|estoque/i.test(name)) ?? workbook.SheetNames[0]
    if (!sheetName) throw new Error('Nenhuma aba encontrada na planilha.')
    const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(
      workbook.Sheets[sheetName],
      { header: 1, defval: '' },
    )
    if (String(matrix[0]?.[0] ?? '').trim() !== 'Controle-App'
      || !matrix.some((row) => String(row[0] ?? '').includes('Modelo oficial de entrada em lote'))) {
      throw new Error('Use somente o modelo XLSX oficial gerado pelo Controle-App.')
    }
    const headerIndex = matrix.findIndex((row) =>
      row.some((cell) => normalizeHeader(cell).includes('quantidadedeentrada'))
      && row.some((cell) => normalizeHeader(cell) === 'produto'),
    )
    if (headerIndex < 0) throw new Error('A tabela de entrada não foi encontrada na planilha.')
    const header = matrix[headerIndex].map((cell) => String(cell ?? '').trim())
    rawRows = matrix.slice(headerIndex + 1)
      .filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''))
      .map((row) => Object.fromEntries(header.map((title, columnIndex) => [title, row[columnIndex] ?? ''])))
  } else {
    let text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
    if (text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(buffer)
    text = text.replace(/^\uFEFF/, '')
    if (!text.includes('Modelo oficial de entrada em lote')) {
      throw new Error('Use somente o modelo CSV oficial gerado pelo Controle-App.')
    }
    const lines = text.split(/\r?\n/)
    const headerIndex = lines.findIndex((line) => {
      const normalized = normalizeHeader(line)
      return normalized.includes('codigo') && normalized.includes('produto') && normalized.includes('quantidadedeentrada')
    })
    if (headerIndex < 0) throw new Error('O cabeçalho oficial de entrada não foi encontrado.')
    const tableText = lines.slice(headerIndex).join('\n')
    const parsed = Papa.parse<Record<string, unknown>>(tableText, {
      header: true,
      skipEmptyLines: true,
      delimiter: text.includes(';') ? ';' : ',',
    })
    if (parsed.errors.length > 0) throw new Error('Não foi possível interpretar o arquivo CSV.')
    rawRows = parsed.data
  }

  return rawRows.map((row, index) => {
    const get = (...keys: string[]) => {
      for (const key of keys) {
        const normalizedKey = normalizeHeader(key)
        const found = Object.keys(row).find((candidate) => normalizeHeader(candidate) === normalizedKey)
        if (found) return row[found]
      }
      return ''
    }
    const quantityText = String(get('quantidade de entrada', 'quantidade', 'entrada', 'quantity'))
      .replace(/\./g, '')
      .replace(',', '.')
      .trim()
    return {
      code: String(get('codigo', 'código', 'code', 'sku')).trim(),
      name: String(get('produto', 'nome', 'name')).trim(),
      unit: String(get('unidade', 'unit')).trim(),
      quantity: quantityText === '' ? Number.NaN : Number(quantityText),
      note: String(get('observação', 'observacao', 'nota', 'note')).trim(),
      line: index + 2,
    }
  })
}
