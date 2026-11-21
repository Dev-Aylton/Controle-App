export function calculateStockValue(
  saldoPorProduto: Array<{ product_id: string; balance: number }> | number,
  custos: Array<{ product_id: string; unit_cost: number }> | number,
) {
  if (typeof saldoPorProduto === 'number' && typeof custos === 'number') return saldoPorProduto * custos
  if (!Array.isArray(saldoPorProduto) || !Array.isArray(custos)) return null
  const custosPorProduto = new Map(custos.map((c) => [c.product_id, Number(c.unit_cost)]))
  return saldoPorProduto.reduce((total, item) => {
    const custo = custosPorProduto.get(item.product_id) ?? 0
    return total + Number(item.balance) * custo
  }, 0)
}
