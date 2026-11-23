export type StockDivergence = {
  productId: string
  productName: string
  environmentId: string
  environmentName: string
  available: number
  informed: number
  excess: number
  kind: 'negative_withdrawal' | 'sale_above_stock'
}

export function calculateStockDivergence(
  available: number,
  informed: number,
  kind: 'negative_withdrawal' | 'sale_above_stock',
) {
  if (!Number.isFinite(available) || !Number.isFinite(informed) || informed <= 0) return null
  const excess = Number((informed - available).toFixed(3))
  if (excess <= 0) return null
  return { excess, available, informed, kind } as Omit<StockDivergence, 'productId' | 'productName' | 'environmentId' | 'environmentName'>
}

export function formatStockDivergenceMessage(divergence: Omit<StockDivergence, 'productId' | 'productName' | 'environmentId' | 'environmentName'>) {
  if (divergence.kind === 'sale_above_stock') {
    return `Foram informadas ${divergence.informed} venda(s), mas havia ${divergence.available} no estoque. Há ${divergence.excess} unidade(s) além do disponível.`
  }
  return `A retirada informada foi ${divergence.informed}, mas havia ${divergence.available} no estoque. O excesso informado foi ${divergence.excess} unidade(s).`
}
