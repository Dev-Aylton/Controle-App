import Papa from 'papaparse'
import * as XLSX from 'xlsx'

export type SalesColumnMapping = {
  name: string
  quantity: string
  saleType: string
}

export type SalesPreviewItem = {
  externalName: string
  quantity: number
  saleType: 'unidade' | 'dose'
  productId: string | null
  ignored: boolean
}

export type EnvironmentPricing = {
  unit_cost: number | null
  base_unit_cost: number | null
  unit_price: number | null
  dose_price: number | null
  volume_ml: number | null
  dose_ml: number | null
}

export function calculateAutomaticDosePrice(
  unitPrice: number | null,
  baseUnitCost: number | null,
  volumeMl: number | null,
  doseMl: number | null,
) {
  if (!volumeMl || !doseMl || doseMl <= 0) return null
  const dosesPerUnit = Math.floor(volumeMl / doseMl)
  if (dosesPerUnit < 1) return null
  const source = unitPrice ?? baseUnitCost
  if (source == null || source < 0) return null
  return Math.round((source / dosesPerUnit + Number.EPSILON) * 100) / 100
}

export function calculateSalesFinancials(
  item: Pick<SalesPreviewItem, 'quantity' | 'saleType'>,
  pricing?: EnvironmentPricing,
) {
  const salePrice = item.saleType === 'dose' ? pricing?.dose_price : pricing?.unit_price
  const revenue = salePrice == null ? null : Math.round((item.quantity * salePrice + Number.EPSILON) * 100) / 100
  const unitCost = pricing?.unit_cost ?? pricing?.base_unit_cost ?? null
  let costQuantity = item.quantity

  if (item.saleType === 'dose') {
    const dosesPerUnit = pricing?.volume_ml && pricing.dose_ml
      ? Math.floor(pricing.volume_ml / pricing.dose_ml)
      : 0
    if (dosesPerUnit < 1) costQuantity = Number.NaN
    else costQuantity = item.quantity / dosesPerUnit
  }

  const costOfGoodsSold = unitCost == null || !Number.isFinite(costQuantity)
    ? null
    : Math.round((costQuantity * unitCost + Number.EPSILON) * 100) / 100

  return {
    salePrice: salePrice ?? null,
    revenue,
    costOfGoodsSold,
    grossProfit: revenue == null || costOfGoodsSold == null
      ? null
      : Math.round((revenue - costOfGoodsSold + Number.EPSILON) * 100) / 100,
  }
}

export function validateSalesPricing(
  items: SalesPreviewItem[],
  pricingByProduct: ReadonlyMap<string, EnvironmentPricing>,
): string | null {
  for (const item of items) {
    if (item.ignored || !item.productId) continue
    const pricing = pricingByProduct.get(item.productId)
    const price = item.saleType === 'dose' ? pricing?.dose_price : pricing?.unit_price
    if (price == null) {
      return `Cadastre o preço de venda por ${item.saleType} para "${item.externalName}" antes de importar.`
    }
    if (item.saleType === 'dose' && (
      !pricing?.volume_ml || !pricing.dose_ml ||
      Math.floor(pricing.volume_ml / pricing.dose_ml) < 1
    )) {
      return `Cadastre volume e dose válidos no produto "${item.externalName}" antes de importar por dose.`
    }
  }
  return null
}

export function normalizeExternalName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function parseSalesRows(rows: Record<string, unknown>[], mapping: SalesColumnMapping): SalesPreviewItem[] {
  return rows.map((row) => ({
    externalName: String(row[mapping.name] ?? '').trim(),
    quantity: Number(String(row[mapping.quantity] ?? '').replace(',', '.')),
    saleType: (String(row[mapping.saleType] ?? '').toLowerCase().includes('dose') ? 'dose' : 'unidade') as 'dose' | 'unidade',
    productId: null,
    ignored: false,
  })).filter((row) => row.externalName && Number.isFinite(row.quantity) && row.quantity > 0)
}

export async function parseSalesFile(file: File): Promise<Record<string, unknown>[]> {
  const buffer = await file.arrayBuffer()
  if (file.name.toLowerCase().endsWith('.csv')) {
    let text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
    if (text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(buffer)
    text = text.replace(/^\uFEFF/, '')
    if (!text.includes('Modelo oficial de vendas')) {
      throw new Error('Use somente o modelo CSV oficial gerado pelo Controle-App.')
    }
    const lines = text.split(/\r?\n/)
    const headerIndex = lines.findIndex((line) => {
      const normalized = line.toLowerCase()
      return normalized.includes('codigo/sku') && normalized.includes('produto') && normalized.includes('quantidade') && normalized.includes('tipo')
    })
    if (headerIndex < 0) throw new Error('O cabeçalho oficial de vendas não foi encontrado.')
    const tableText = lines.slice(headerIndex).join('\n')
    return Papa.parse<Record<string, unknown>>(tableText, { header: true, skipEmptyLines: true, delimiter: tableText.includes(';') ? ';' : ',' }).data
  }
  const workbook = XLSX.read(buffer, { type: 'array' })
  for (const sheetName of workbook.SheetNames) {
    const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(workbook.Sheets[sheetName], { header: 1, defval: '' })
    const headerIndex = matrix.findIndex((row) =>
      row.some((cell) => String(cell).trim() === 'Código/SKU')
      && row.some((cell) => String(cell).trim() === 'Produto')
      && row.some((cell) => String(cell).trim() === 'Quantidade')
      && row.some((cell) => String(cell).trim() === 'Tipo'),
    )
    if (headerIndex >= 0) {
      const header = matrix[headerIndex].map((cell) => String(cell ?? '').trim())
      return matrix.slice(headerIndex + 1)
        .filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''))
        .map((row) => Object.fromEntries(header.map((title, columnIndex) => [title, row[columnIndex] ?? ''])))
    }
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
}

export async function hashSalesFile(file: File): Promise<string> {
  const data = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function validateSalesPreview(items: SalesPreviewItem[]): string | null {
  const invalidQuantity = items.find((item) => !item.ignored && (!Number.isFinite(item.quantity) || item.quantity <= 0))
  if (invalidQuantity) return `A quantidade de "${invalidQuantity.externalName}" é inválida. Informe um número maior que zero.`
  const overPrecision = items.find((item) => !item.ignored
    && Math.abs(item.quantity * 1000 - Math.round(item.quantity * 1000)) > 1e-8)
  if (overPrecision) return `A quantidade de "${overPrecision.externalName}" pode ter no máximo 3 casas decimais.`
  const unresolved = items.filter((item) => !item.ignored && !item.productId)
  if (unresolved.length) return 'Vincule todos os itens não ignorados antes de confirmar.'
  if (!items.some((item) => !item.ignored)) return 'Nenhum item foi selecionado.'
  return null
}
