type EnvironmentBalance = {
  product_id: string
  total_balance: number
}

export function countProductsWithoutStock(rows: EnvironmentBalance[]) {
  return new Set(
    rows
      .filter((row) => Number(row.total_balance) === 0)
      .map((row) => row.product_id),
  ).size
}
