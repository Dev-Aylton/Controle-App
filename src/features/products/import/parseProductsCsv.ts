import Papa from 'papaparse'
import { parseLocalizedNumber } from '../../../lib/parseLocalizedNumber'

export type ParsedProductRow = {
  line: number
  valid: boolean
  name: string
  sku: string
  category: string
  unit: string
  minStock: number
  maxStock: number | null
  volumeMl: number | null
  doseMl: number | null
  weight: number | null
  cost: number | null
  errors: string[]
}

export type ExistingProductVariant = {
  name: string
  unit: string
  volumeMl: number | null
  doseMl: number | null
}

const units = new Set([
  'un','kg','g','l','ml','cx','pct','garrafa','lata','maço','maco','pacote','fruta','unidade',
  'porcao','porção','duzia','dúzia','bandeja','saco','ramo','peca','peça','fardo','frasco',
])

export function parseNumber(value: unknown) {
  return parseLocalizedNumber(value)
}

export function normalizeProductUnit(value: unknown): string {
  const unit = String(value ?? '').trim().toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  if (['garrafa','lata','maco','pacote','unidade','fruta','porcao','duzia','bandeja','saco','ramo','peca','peça','fardo','frasco'].includes(unit)) {
    if (unit === 'maco') return 'maço'
    if (unit === 'porcao') return 'porcao'
    if (unit === 'duzia') return 'duzia'
    if (unit === 'peça') return 'peca'
    return unit
  }
  if (['kg','g','l','ml','cx','pct','un'].includes(unit)) return unit
  return unit
}

export function parseProductRows(
  rawRows: Record<string, unknown>[],
  existingNames: string[] = [],
  existingSkus: string[] = [],
  existingVariants: ExistingProductVariant[] = [],
): ParsedProductRow[] {
  const seenNames = new Set(existingNames.map((value) => value.trim().toLowerCase()))
  const seenSkus = new Set(existingSkus.filter(Boolean).map((value) => value.trim().toLowerCase()))
  const seenVariants = new Set(existingVariants.map((variant) =>
    `${variant.name.trim().toLowerCase()}|${normalizeProductUnit(variant.unit)}|${variant.volumeMl ?? ''}|${variant.doseMl ?? ''}`,
  ))
  return rawRows.map((raw, index) => {
    const normalizeHeader = (value: unknown) => String(value ?? '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '')
    const get = (...keys: string[]) => {
      for (const key of keys) {
        const normalizedKey = normalizeHeader(key)
        const found = Object.keys(raw).find((candidate) => normalizeHeader(candidate) === normalizedKey)
        if (found) return raw[found]
      }
      return ''
    }
    const name = String(get('nome','name','produto','product')).trim()
    const sku = String(get('codigo','código','cod','sku','code')).trim()
    const category = String(get('categoria','category','tipo_categoria','tipo/categoria','tipo')).trim()
    const unit = normalizeProductUnit(get('unidade','unit'))
    const minStock = parseNumber(get('estoque minimo','estoque mínimo','estoque_minimo','min_stock','estoque minimo  ')) ?? 0
    const maxStock = parseNumber(get('estoque máximo','estoque_maximo','estoque maximo','max_stock'))
    const volumeMl = parseNumber(get('volume','volume ml','volume_ml'))
    const doseMl = parseNumber(get('dose','dose ml','dose_ml'))
    const rawWeight = parseNumber(get('peso','weight','peso kg','peso_kg','peso unidade','peso_unidade'))
    const weightUnitHeader = normalizeHeader(get('unidade peso','peso_unidade','peso unidade'))
    const weight = rawWeight === null
      ? null
      : weightUnitHeader === 'kg' || /peso.*kg|kg.*peso/i.test(Object.keys(raw).join(' '))
        ? rawWeight * 1000
        : rawWeight
    const cost = parseNumber(get('custo','custo_unitario','custo unitário','unit_cost','custo unitario r','custo unit.'))
    const errors: string[] = []
    if (!name) errors.push('Nome vazio')
    if (!units.has(unit || 'un')) errors.push('Unidade inválida')
    if (minStock < 0) errors.push('Estoque mínimo negativo')
    if (maxStock !== null && maxStock < 0) errors.push('Estoque máximo negativo')
    if (maxStock !== null && maxStock < minStock) errors.push('Estoque máximo menor que o mínimo')
    if (cost !== null && cost < 0) errors.push('Custo negativo')
    if (volumeMl !== null && volumeMl <= 0) errors.push('Volume inválido')
    if (doseMl !== null && doseMl <= 0) errors.push('Dose inválida')
    if (weight !== null && weight <= 0) errors.push('Peso inválido')
    if (doseMl !== null && volumeMl !== null && doseMl > volumeMl) errors.push('Dose maior que o volume')
    const variantKey = `${name.toLowerCase()}|${unit}|${volumeMl ?? ''}|${doseMl ?? ''}`
    if (name && seenVariants.has(variantKey)) {
      const alreadyInExistingCatalog = existingVariants.some((variant) =>
        normalizeProductUnit(variant.unit) === unit
        && variant.name.trim().toLowerCase() === name.toLowerCase()
        && (variant.volumeMl ?? null) === volumeMl
        && (variant.doseMl ?? null) === doseMl,
      )
      if (!alreadyInExistingCatalog) {
        errors.push('Duplicado: produto, unidade e volume aparecem mais de uma vez no arquivo')
      }
    }
    if (sku && seenSkus.has(sku.toLowerCase())) {
      const alreadyUsedInExistingCatalog = existingSkus.some((existingSku) =>
        existingSku.trim().toLowerCase() === sku.toLowerCase(),
      )
      if (!alreadyUsedInExistingCatalog) {
        errors.push('Código/SKU repetido em mais de uma linha do arquivo')
      }
    }
    if (name) {
      seenNames.add(name.toLowerCase())
      seenVariants.add(variantKey)
    }
    if (sku) seenSkus.add(sku.toLowerCase())
    return {
      line: index + 2,
      valid: errors.length === 0,
      name,
      sku,
      category,
      unit: unit || 'un',
      minStock,
      maxStock,
      volumeMl,
      doseMl,
      weight,
      cost,
      errors,
    }
  })
}

export function parseProductsCsv(
  csvText: string,
  existingNames: string[] = [],
  existingSkus: string[] = [],
  existingVariants: ExistingProductVariant[] = [],
) {
  const normalized = csvText.replace(/\uFEFF/g, '')
  const lines = normalized.split(/\r?\n/)
  const hasOfficialMarker = normalized.includes('Modelo oficial de produtos')
  const headerIndex = lines.findIndex((line) => {
    const cells = line.split(/[;,]/).map((cell) => cell
      .trim()
      .replace(/^"|"$/g, '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ''))
    return cells.includes('nome')
      && cells.includes('codigo')
      && cells.includes('unidade')
  })
  if (hasOfficialMarker && headerIndex < 0) throw new Error('O cabeçalho oficial de produtos não foi encontrado.')
  const effectiveHeaderIndex = headerIndex >= 0 ? headerIndex : 0
  const tableText = lines.slice(effectiveHeaderIndex).join('\n')
  const firstLine = lines[effectiveHeaderIndex] ?? ''
  const separator = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const parsed = Papa.parse<Record<string, string>>(tableText, {
    header: true,
    delimiter: separator,
    skipEmptyLines: 'greedy',
  })
  if (hasOfficialMarker && parsed.errors.length > 0) throw new Error('Não foi possível interpretar o modelo CSV de produtos.')
  return parseProductRows(parsed.data as Record<string, unknown>[], existingNames, existingSkus, existingVariants)
}
