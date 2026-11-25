export function parseLocalizedNumber(value: unknown): number | null {
  const text = String(value ?? '').trim().replace(/[\s\u00A0\u202F]/g, '')
  if (!text) return null

  let normalized = text
  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    if (lastComma > lastDot) {
      normalized = text.replace(/\./g, '').replace(',', '.')
    } else {
      normalized = text.replace(/,/g, '')
    }
  } else if (lastComma >= 0) {
    normalized = text.replace(',', '.')
  } else if ((text.match(/\./g)?.length ?? 0) > 1) {
    normalized = text.replace(/\./g, '')
  }

  const number = Number(normalized)
  return Number.isFinite(number) ? number : null
}
