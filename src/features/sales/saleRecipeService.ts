import { tryGetSupabaseClient } from '../../lib/supabase'
import { friendlySupabaseError } from '../../lib/errors'

export type SaleRecipeIngredientInput = {
  product_id: string
  quantity: number
  unit: string
}

export async function upsertSaleRecipe(
  companyId: string,
  saleItemId: string | null,
  name: string,
  category: 'bebida' | 'prato' | 'porcao' | 'outro',
  ingredients: SaleRecipeIngredientInput[],
) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('upsert_sale_item', {
    p_company_id: companyId,
    p_sale_item_id: saleItemId,
    p_name: name,
    p_category: category,
    p_ingredients: ingredients,
  })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return result.data as string
}

export async function upsertSaleRecipeEnvironmentPrice(
  companyId: string,
  environmentId: string,
  saleItemId: string,
  salePrice: number,
) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('upsert_sale_item_environment_price', {
    p_company_id: companyId,
    p_environment_id: environmentId,
    p_sale_item_id: saleItemId,
    p_sale_price: salePrice,
  })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
}
