export type SaleRecipeIngredient = {
  productId: string
  productName: string
  quantity: number
  unit: string
  unitCost: number | null
}

export type SaleRecipe = {
  id: string
  name: string
  category: 'bebida' | 'prato' | 'porcao'
  salePrice: number
  ingredients: SaleRecipeIngredient[]
  yieldQuantity: number
  active: boolean
}

export function calculateRecipeCost(recipe: SaleRecipe) {
  const cost = recipe.ingredients.reduce((total, ingredient) =>
    total + (ingredient.unitCost == null ? 0 : ingredient.quantity * ingredient.unitCost),
  0)
  return {
    totalCost: Math.round((cost + Number.EPSILON) * 100) / 100,
    costPerYield: recipe.yieldQuantity > 0
      ? Math.round((cost / recipe.yieldQuantity + Number.EPSILON) * 100) / 100
      : null,
  }
}

export function calculateRecipeMargin(recipe: SaleRecipe) {
  const cost = calculateRecipeCost(recipe)
  const costPerSale = cost.costPerYield
  if (costPerSale == null) return null
  const grossProfit = recipe.salePrice - costPerSale
  const margin = recipe.salePrice > 0
    ? (grossProfit / recipe.salePrice) * 100
    : null
  return {
    costPerSale,
    grossProfit: Math.round((grossProfit + Number.EPSILON) * 100) / 100,
    marginPercent: margin == null ? null : Math.round(margin * 10) / 10,
  }
}
