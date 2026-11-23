import { describe, expect, it } from 'vitest'
import { calculateRecipeCost, calculateRecipeMargin, type SaleRecipe } from './saleRecipe'

describe('receitas comerciais e custo dos insumos', () => {
  it('separa preço de venda do custo dos insumos de um prato', () => {
    const recipe: SaleRecipe = {
      id: 'r1',
      name: 'Espetinho com acompanhamento',
      category: 'prato',
      salePrice: 35,
      yieldQuantity: 1,
      active: true,
      ingredients: [
        { productId: 'p1', productName: 'Picanha', quantity: 0.2, unit: 'kg', unitCost: 80 },
        { productId: 'p2', productName: 'Farofa', quantity: 0.05, unit: 'kg', unitCost: 20 },
      ],
    }
    expect(calculateRecipeCost(recipe)).toEqual({ totalCost: 17, costPerYield: 17 })
    expect(calculateRecipeMargin(recipe)?.grossProfit).toBe(18)
  })

  it('permite diferentes drinks com diferentes preços usando o mesmo insumo', () => {
    const vodkaAndSoda: SaleRecipe = {
      id: 'r2',
      name: 'Vodka com água',
      category: 'bebida',
      salePrice: 20,
      yieldQuantity: 1,
      active: true,
      ingredients: [
        { productId: 'vodka', productName: 'Vodka', quantity: 50, unit: 'ml', unitCost: 0.09 },
      ],
    }
    const premiumVodka: SaleRecipe = {
      id: 'r3',
      name: 'Vodka premium',
      category: 'bebida',
      salePrice: 32,
      yieldQuantity: 1,
      active: true,
      ingredients: [
        { productId: 'vodka', productName: 'Vodka', quantity: 50, unit: 'ml', unitCost: 0.09 },
      ],
    }
    expect(calculateRecipeMargin(vodkaAndSoda)?.grossProfit).toBe(15.5)
    expect(calculateRecipeMargin(premiumVodka)?.grossProfit).toBe(27.5)
  })
})
