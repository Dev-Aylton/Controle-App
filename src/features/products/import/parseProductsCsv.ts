import Papa from 'papaparse'

export type ParsedProductRow = {
  line: number
  valid: boolean
  name: string
  sku: string
  category: string
  unit: string
  minStock: number
  cost: number | null
  errors: string[]
}

const units = new Set(['un','kg','g','l','ml','cx','pct'])

export function parseNumber(value: unknown) {
  const text = String(value ?? '').trim().replace(/\./g, '').replace(',', '.')
  if (!text) return null
  const number = Number(text)
  return Number.isFinite(number) ? number : null
}

export function parseProductsCsv(csvText: string, existingNames: string[] = [], existingSkus: string[] = []) {
  const normalized = csvText.replace(/\uFEFF/g, '')
  const firstLine = normalized.split(/\r?\n/, 1)[0] ?? ''
  const separator = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const parsed = Papa.parse<Record<string, string>>(normalized, {
    header: true,
    delimiter: separator,
    skipEmptyLines: true,
  })
  const seenNames = new Set(existingNames.map((value) => value.trim().toLowerCase()))
  const seenSkus = new Set(existingSkus.filter(Boolean).map((value) => value.trim().toLowerCase()))
  const rows: ParsedProductRow[] = parsed.data.map((raw, index) => {
    const get = (...keys: string[]) => {
      for (const key of keys) {
        const found = Object.keys(raw).find((candidate) => candidate.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'') === key)
        if (found) return raw[found]
      }
      return ''
    }
    const name = get('nome','name').trim()
    const sku = get('codigo','código','sku','code').trim()
    const category = get('categoria','category').trim()
    const unit = get('unidade','unit').trim().toLowerCase()
    const minStock = parseNumber(get('estoque minimo','estoque mínimo','estoque_minimo','min_stock')) ?? 0
    const cost = parseNumber(get('custo','custo_unitario','custo unitário','unit_cost'))
    const errors: string[] = []
    if (!name) errors.push('Nome vazio')
    if (!units.has(unit || 'un')) errors.push('Unidade inválida')
    if (minStock < 0) errors.push('Estoque mínimo negativo')
    if (cost !== null && cost < 0) errors.push('Custo negativo')
    if (name && seenNames.has(name.toLowerCase())) errors.push('Duplicado no arquivo ou já existente')
    if (sku && seenSkus.has(sku.toLowerCase())) errors.push('Código duplicado')
    if (name) seenNames.add(name.toLowerCase())
    if (sku) seenSkus.add(sku.toLowerCase())
    return {
      line: index + 2,
      valid: errors.length === 0,
      name,
      sku,
      category,
      unit: unit || 'un',
      minStock,
      cost,
      errors,
    }
  })
  return rows
}
