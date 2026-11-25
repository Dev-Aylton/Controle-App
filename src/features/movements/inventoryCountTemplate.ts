import Papa from 'papaparse'
import * as XLSX from 'xlsx-js-style'
import { parseLocalizedNumber } from '../../lib/parseLocalizedNumber'
import { downloadCsv } from '../management/csv'

export type CountTemplateProduct = {
  id: string
  name: string
  sku?: string | null
  categoryName?: string | null
  unit?: string | null
  volumeMl?: number | null
  doseMl?: number | null
  weightG?: number | null
}

export type InventoryCountRow = {
  code: string
  category: string
  name: string
  unit: string
  measure: string
  dose: string
  environment: string
  quantity: number
  line: number
}

export type CountProductMatch = {
  product: CountTemplateProduct
  kind: 'sku' | 'variant' | 'name'
}

export function normalizeCountIdentifier(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export function findInventoryCountProduct(
  code: string,
  name: string,
  unit: string,
  measure: string,
  products: CountTemplateProduct[],
): CountProductMatch | null {
  const cleanCode = normalizeCountIdentifier(code)
  if (cleanCode) {
    const skuMatch = products.find((product) =>
      normalizeCountIdentifier(product.sku) === cleanCode,
    )
    if (skuMatch) return { product: skuMatch, kind: 'sku' }
  }

  const cleanName = normalizeCountIdentifier(name)
  const cleanUnit = normalizeCountIdentifier(unit)
  const cleanMeasure = String(measure ?? '').replace(',', '.').trim()
  if (cleanName) {
    const variantMatch = products.find((product) => {
      if (normalizeCountIdentifier(product.name) !== cleanName) return false
      if (cleanUnit && normalizeCountIdentifier(product.unit) !== cleanUnit) return false
      if (cleanMeasure && product.volumeMl != null) {
        return String(product.volumeMl).replace('.', ',') === cleanMeasure
          || String(product.volumeMl) === cleanMeasure
      }
      return true
    })
    if (variantMatch) return { product: variantMatch, kind: 'variant' }

    const nameMatch = products.find((product) =>
      normalizeCountIdentifier(product.name) === cleanName,
    )
    if (nameMatch) return { product: nameMatch, kind: 'name' }
  }
  return null
}

export function suggestInventoryCountProducts(
  code: string,
  name: string,
  products: CountTemplateProduct[],
  limit = 5,
) {
  const terms = [code, name]
    .map(normalizeCountIdentifier)
    .filter(Boolean)
  if (terms.length === 0) return []
  return products
    .map((product) => {
      const productName = normalizeCountIdentifier(product.name)
      const productSku = normalizeCountIdentifier(product.sku)
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

export function buildInventoryCountRows(environmentName: string, products: CountTemplateProduct[]) {
  return [
    [
      'Código',
      'Tipo/Categoria',
      'Produto',
      'Unidade',
      'Volume/Peso',
      'Dose (ml)',
      'Ambiente',
      'Quantidade contada',
      'Observações',
    ],
    ...products.map((product) => [
      product.sku ?? '',
      product.categoryName ?? '',
      product.name,
      product.unit ?? 'un',
      product.weightG != null ? `${product.weightG} g/un` : product.volumeMl == null ? '' : `${product.volumeMl} ml`,
      product.doseMl == null ? '' : String(product.doseMl),
      environmentName,
      '',
      '',
    ]),
  ]
}

export function buildInventoryCountWorksheet(environmentName: string, products: CountTemplateProduct[]) {
  const now = new Date()
  const dateText = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(now)
  const timeText = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(now)
  const rows = buildInventoryCountRows(environmentName, products)
  const worksheet = XLSX.utils.aoa_to_sheet([
    ['Controle-App', '', '', '', '', '', '', '', ''],
    ['Modelo oficial de contagem', '', '', '', '', '', '', '', ''],
    ['Versão', '1.0', 'Tipo', 'Contagem', 'Ambiente', environmentName, '', '', ''],
    ['Data', dateText, 'Hora', timeText, 'Complete os campos em branco para identificar o produto, mantenha os dados preenchidos e informe Quantidade contada. Observações é opcional.', '', '', '', ''],
    ['', '', '', '', '', '', '', '', ''],
    ...rows,
  ])
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
  ]
  worksheet['!cols'] = [
    { wch: 14 },
    { wch: 20 },
    { wch: 38 },
    { wch: 14 },
    { wch: 16 },
    { wch: 12 },
    { wch: 24 },
    { wch: 20 },
    { wch: 32 },
  ]
  worksheet['A1'].s = {
    font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1F7A65' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  worksheet['A2'].s = {
    font: { bold: true, sz: 12, color: { rgb: '173A35' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  worksheet['A3'].s = { font: { bold: true, color: { rgb: '173A35' } }, fill: { fgColor: { rgb: 'E7F3EF' } } }
  worksheet['C3'].s = { font: { bold: true, color: { rgb: '173A35' } }, fill: { fgColor: { rgb: 'E7F3EF' } } }
  worksheet['E3'].s = { font: { bold: true, color: { rgb: '173A35' } }, fill: { fgColor: { rgb: 'E7F3EF' } } }
  for (let column = 0; column < 9; column += 1) {
    const cell = XLSX.utils.encode_cell({ r: 5, c: column })
    if (!worksheet[cell]) worksheet[cell] = { t: 's', v: '' }
    worksheet[cell].s = {
      font: { bold: true, color: { rgb: '173A35' } },
      fill: { fgColor: { rgb: 'E7F3EF' } },
      border: {
        top: { style: 'thin', color: { rgb: 'C8D8D2' } },
        bottom: { style: 'thin', color: { rgb: 'C8D8D2' } },
        left: { style: 'thin', color: { rgb: 'C8D8D2' } },
        right: { style: 'thin', color: { rgb: 'C8D8D2' } },
      },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    }
  }
  for (let row = 6; row < 6 + products.length; row += 1) {
    for (let column = 0; column < 9; column += 1) {
      const cell = XLSX.utils.encode_cell({ r: row, c: column })
      if (!worksheet[cell]) worksheet[cell] = { t: 's', v: '' }
      worksheet[cell].s = {
        fill: { fgColor: { rgb: row % 2 === 0 ? 'F5F9F7' : 'FFFFFF' } },
        border: {
          top: { style: 'thin', color: { rgb: 'C8D8D2' } },
          bottom: { style: 'thin', color: { rgb: 'C8D8D2' } },
          left: { style: 'thin', color: { rgb: 'C8D8D2' } },
          right: { style: 'thin', color: { rgb: 'C8D8D2' } },
        },
        alignment: { vertical: 'top', wrapText: true },
      }
    }
  }
  worksheet['!autofilter'] = { ref: `A6:I${6 + products.length}` }
  worksheet['!freeze'] = { xSplit: 0, ySplit: 6, topLeftCell: 'A7', state: 'frozen' }
  worksheet['!rows'] = [{ hpt: 30 }, { hpt: 22 }, { hpt: 20 }, { hpt: 36 }, { hpt: 8 }, { hpt: 34 }, ...Array(Math.max(0, products.length)).fill({ hpt: 24 })]
  return worksheet
}

export function downloadInventoryCountTemplate(environmentName: string, products: CountTemplateProduct[]) {
  const worksheet = buildInventoryCountWorksheet(environmentName, products)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Contagem')
  XLSX.writeFile(workbook, `modelo-contagem-${environmentName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.xlsx`)
}

export function downloadInventoryCountCsvTemplate(environmentName: string, products: CountTemplateProduct[]) {
  downloadCsv(
    `modelo-contagem-${environmentName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`,
    [
      ['Controle-App', 'Modelo oficial de contagem'],
      ['Versão', '1.0'],
      ['Tipo', 'Contagem'],
      ['Ambiente', environmentName],
      ['Complete os campos em branco para identificar o produto, mantenha os dados preenchidos e informe Quantidade contada. Observações é opcional.', ''],
      [],
      ...buildInventoryCountRows(environmentName, products),
    ],
    true,
    'windows-1252',
  )
}


export async function parseInventoryCountFile(file: File): Promise<InventoryCountRow[]> {
  const buffer = await file.arrayBuffer()
  const normalizeHeader = (value: unknown) => String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '')
  const rawRows: Record<string, unknown>[] = /\.xlsx?$/.test(file.name.toLowerCase())
    ? (() => {
    const workbook = XLSX.read(buffer, { type: 'array' })
    const sheetName = workbook.SheetNames[0]
    if (!sheetName) throw new Error('Nenhuma aba encontrada na planilha.')
        const sheet = workbook.Sheets[sheetName]
        const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: '' })
        if (String(matrix[0]?.[0] ?? '').trim() !== 'Controle-App'
          || !matrix.some((row) => String(row[0] ?? '').includes('Modelo oficial de contagem'))) {
          throw new Error('Use somente o modelo XLSX oficial gerado pelo Controle-App.')
        }
        const headerIndex = matrix.findIndex((row) =>
          row.some((cell) => normalizeHeader(cell) === 'quantidadecontada')
          && row.some((cell) => normalizeHeader(cell) === 'produto'),
        )
        if (headerIndex < 0) throw new Error('A tabela de contagem não foi encontrada na planilha.')
        const header = matrix[headerIndex].map((cell) => String(cell ?? '').trim())
        return matrix.slice(headerIndex + 1)
          .filter((row) => row.some((cell) => String(cell ?? '').trim() !== ''))
          .map((row) => Object.fromEntries(header.map((title, columnIndex) => [title, row[columnIndex] ?? ''])))
      })()
    : (() => {
    let text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
    if (text.includes('\uFFFD')) text = new TextDecoder('windows-1252').decode(buffer)
    text = text.replace(/^\uFEFF/, '')
    if (!text.includes('Modelo oficial de contagem')) {
      throw new Error('Use somente o modelo CSV oficial gerado pelo Controle-App.')
    }
    const lines = text.split(/\r?\n/)
    const headerIndex = lines.findIndex((line) => {
      const cells = line.split(/[;,]/).map((cell) => normalizeHeader(cell.replace(/^"|"$/g, '')))
      return cells.includes('quantidadecontada') && cells.includes('produto')
    })
    if (headerIndex < 0) throw new Error('O cabeçalho oficial de contagem não foi encontrado.')
    const tableText = lines.slice(headerIndex).join('\n')
    const parsed = Papa.parse<Record<string, unknown>>(tableText, {
      header: true,
      skipEmptyLines: 'greedy',
      delimiter: lines[headerIndex].match(/;/g)?.length ? ';' : ',',
    })
    if (parsed.errors.length > 0) throw new Error('Não foi possível interpretar o modelo CSV de contagem.')
    return parsed.data
      })()
  return rawRows.map((row, index) => {
    const get = (...keys: string[]) => {
      for (const key of keys) {
        const normalizedKey = normalizeHeader(key)
        const found = Object.keys(row).find((candidate) => normalizeHeader(candidate) === normalizedKey)
        if (found) return row[found]
      }
      return ''
    }
    const code = String(get('codigo', 'código', 'code', 'sku')).trim()
    const category = String(get('tipo/categoria', 'tipo', 'categoria', 'category')).trim()
    const name = String(get('produto', 'nome', 'name')).trim()
    const unit = String(get('unidade', 'unit')).trim()
    const measure = String(get('volume/peso', 'volume/peso', 'volume', 'peso', 'measure')).trim()
    const dose = String(get('dose (ml)', 'dose ml', 'dose_ml', 'dose')).trim()
    const environment = String(get('ambiente', 'environment')).trim()
    const quantityText = String(get('quantidade contada', 'contagem', 'quantidade', 'count')).trim()
    const quantity = parseLocalizedNumber(quantityText)
    return {
      code,
      category,
      name,
      unit,
      measure,
      dose,
      environment,
      quantity: quantityText === '' || quantity === null ? Number.NaN : quantity,
      line: index + 2,
    }
  })
}
