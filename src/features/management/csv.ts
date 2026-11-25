export type CsvCell = string | number | null

export function protectSpreadsheetText(value: string): string {
  return /^[\s]*[=+\-@]/u.test(value) ? `'${value}` : value
}

const numberFormat = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 20 })

function formatCell(value: CsvCell): string {
  if (value === null) return ''
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Não é possível exportar um número inválido.')
    return numberFormat.format(value).replace(/[^0-9,.-]/g, '')
  }
  const safe = protectSpreadsheetText(value)
  return /[;"\r\n]/u.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function generateCsv(rows: readonly (readonly CsvCell[])[]): string {
  return `\uFEFF${rows.map((row) => row.map(formatCell).join(';')).join('\r\n')}`
}

export function downloadCsv(filename: string, rows: readonly (readonly CsvCell[])[]): void {
  const blob = new Blob([generateCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
