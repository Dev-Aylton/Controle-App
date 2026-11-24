export function parseBrazilianCurrency(value: unknown): number | null {
  const text = String(value ?? '').trim()
  if (!text) return null
  let normalized = text.replace(/R\$\s*/gi, '').replace(/\s/g, '')
  if (normalized.includes(',')) {
    normalized = normalized.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replace(/\./g, '')
  }
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : null
}

export function formatBrazilianCurrencyInput(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return ''
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatBrazilianCurrency(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return 'Não definido'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}
