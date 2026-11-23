import type { ParsedProductRow } from './parseProductsCsv'

export type ImportExistingProduct = {
  id: string
  name: string
  sku: string | null
  unit: string
  volumeMl: number | null
  doseMl: number | null
  weightG: number | null
}

export type ImportProductMatch = {
  id: string
  name: string
  sku: string | null
  unit: string
  volumeMl: number | null
  doseMl: number | null
  weightG: number | null
  score: number
  reason: string
}

export type ProductImportResolution = {
  action: 'create' | 'update' | null
  matchedProductId: string | null
  resolvedSku: string
  resolvedUnit: string
  resolvedCategory: string
  resolvedVolumeMl: number | null
  resolvedDoseMl: number | null
  resolvedWeightG: number | null
  resolvedCost: number | null
  reviewed: boolean
  matches: ImportProductMatch[]
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function levenshtein(left: string, right: string) {
  const a = normalize(left)
  const b = normalize(right)
  if (!a) return b.length
  if (!b) return a.length
  const matrix = Array.from({ length: b.length + 1 }, (_, index) => [index])
  for (let index = 0; index <= a.length; index += 1) matrix[0][index] = index
  for (let row = 1; row <= b.length; row += 1) {
    for (let column = 1; column <= a.length; column += 1) {
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + (a[column - 1] === b[row - 1] ? 0 : 1),
      )
    }
  }
  return matrix[b.length][a.length]
}

function similar(left: string, right: string) {
  const a = normalize(left)
  const b = normalize(right)
  if (!a || !b) return 0
  if (a === b) return 100
  const longer = Math.max(a.length, b.length)
  return Math.round((1 - levenshtein(a, b) / longer) * 100)
}

export function generateProductSku(name: string, unit: string, volumeMl: number | null, weightG: number | null) {
  const prefix = normalize(name)
    .split(' ')
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part.slice(0, 3))
    .join('-')
    .replace(/[^a-z0-9-]/gi, '')
    .toUpperCase() || 'ITEM'
  const measure = volumeMl ? String(volumeMl) : weightG ? `${weightG}G` : unit.toUpperCase()
  return `${prefix}-${measure}`
}

export function findProductImportMatches(row: ParsedProductRow, existing: ImportExistingProduct[]) {
  const nameScoreBase = normalize(row.name)
  return existing
    .map((product) => {
      const nameScore = similar(nameScoreBase, product.name)
      let score = nameScore
      let reason = 'Nome semelhante'
      if (normalize(row.name) === normalize(product.name)) {
        score += 35
        reason = 'Nome igual'
      }
      if (row.sku && product.sku && row.sku.toLowerCase() === product.sku.toLowerCase()) {
        score += 100
        reason = 'SKU igual'
      }
      if (row.unit && normalize(row.unit) === normalize(product.unit)) {
        score += 15
      }
      if (row.volumeMl != null && product.volumeMl != null && row.volumeMl === product.volumeMl) {
        score += 15
      }
      if (row.weight != null && product.weightG != null && row.weight === product.weightG) {
        score += 15
      }
      return {
        id: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        volumeMl: product.volumeMl,
        doseMl: product.doseMl,
        weightG: product.weightG,
        score,
        reason,
      }
    })
    .filter((match) => match.score >= 55)
    .sort((left, right) => right.score - left.score)
    .slice(0, 5)
}

export function prepareProductImportResolutions(
  rows: ParsedProductRow[],
  existing: ImportExistingProduct[],
): Array<ParsedProductRow & ProductImportResolution> {
  return rows.map((row) => {
    const matches = findProductImportMatches(row, existing)
    const exactSku = row.sku
      ? matches.find((match) => normalize(match.sku ?? '') === normalize(row.sku))
      : null
    const exactVariant = matches.find((match) =>
      normalize(match.name) === normalize(row.name)
      && normalize(match.unit) === normalize(row.unit)
      && (row.volumeMl == null || match.volumeMl === row.volumeMl)
      && (row.weight == null || match.weightG === row.weight),
    )
    const recommended = exactSku ?? exactVariant ?? (matches.length === 1 ? matches[0] : null)
    return {
      ...row,
      matches,
      action: null,
      matchedProductId: recommended?.id ?? null,
      resolvedSku: row.sku || recommended?.sku || '',
      resolvedUnit: row.unit,
      resolvedCategory: row.category,
      resolvedVolumeMl: row.volumeMl,
      resolvedDoseMl: row.doseMl,
      resolvedWeightG: row.weight,
      resolvedCost: row.cost,
      reviewed: false,
    }
  })
}
