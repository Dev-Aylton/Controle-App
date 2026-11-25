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

export function generateCsv(
  rows: readonly (readonly CsvCell[])[],
  includeExcelSeparatorHint = false,
): string {
  const separatorHint = includeExcelSeparatorHint ? 'sep=;\r\n' : ''
  return `\uFEFF${separatorHint}${rows.map((row) => row.map(formatCell).join(';')).join('\r\n')}`
}

export function downloadCsv(
  filename: string,
  rows: readonly (readonly CsvCell[])[],
  includeExcelSeparatorHint = false,
  charset: 'utf-8' | 'windows-1252' = 'utf-8',
): void {
  if (charset === 'windows-1252') {
    const text = generateCsv(rows, includeExcelSeparatorHint).replace(/^\uFEFF/, '')
    const cp1252 = new Map([
      [0x20AC, 0x80], [0x201A, 0x82], [0x201E, 0x84], [0x2026, 0x85],
      [0x2018, 0x91], [0x2019, 0x92], [0x201C, 0x93], [0x201D, 0x94],
      [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97], [0x2122, 0x99],
    ])
    const bytes = new Uint8Array(Array.from(text).map((character) => {
      const code = character.charCodeAt(0)
      return code <= 0xFF ? code : (cp1252.get(code) ?? 0x3F)
    }))
    const blob = new Blob([bytes], { type: 'text/csv;charset=windows-1252' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
    return
  }
  const blob = new Blob([generateCsv(rows, includeExcelSeparatorHint)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
