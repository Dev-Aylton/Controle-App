import { tryGetSupabaseClient } from '../../lib/supabase'
import { friendlySupabaseError } from '../../lib/errors'

export async function listProductData(companyId: string) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const [productsResult, categoriesResult, costsResult] = await Promise.all([
    supabase.from('products').select('*').eq('company_id', companyId).order('name'),
    supabase.from('product_categories').select('*').eq('company_id', companyId).order('name'),
    supabase.from('product_costs').select('*').eq('company_id', companyId),
  ])
  if (productsResult.error) throw new Error(friendlySupabaseError(productsResult.error))
  if (categoriesResult.error) throw new Error(friendlySupabaseError(categoriesResult.error))
  return {
    products: productsResult.data ?? [],
    categories: categoriesResult.data ?? [],
    costs: costsResult.data ?? [],
  }
}

export async function saveCategory(companyId: string, name: string) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const { data, error } = await supabase
    .from('product_categories')
    .insert({ company_id: companyId, name: name.trim(), active: true })
    .select('*')
    .single()
  if (error) throw new Error(friendlySupabaseError(error))
  return data
}

export async function saveProduct(
  companyId: string,
  id: string | null,
  payload: {
    name: string
    sku: string | null
    category_id: string | null
    unit: 'un'|'kg'|'g'|'l'|'ml'|'cx'|'pct'
    min_stock: number
    photo_path: string | null
    active: boolean
  },
  unitCost?: number,
) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const cleanPayload = { ...payload, company_id: companyId, name: payload.name.trim(), sku: payload.sku?.trim() || null }
  const result = id
    ? await supabase.from('products').update(cleanPayload).eq('id', id).select('*').single()
    : await supabase.from('products').insert(cleanPayload).select('*').single()
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  if (unitCost !== undefined && result.data?.id) {
    const { error } = await supabase.rpc('upsert_product_cost', {
      p_product_id: result.data.id,
      p_unit_cost: unitCost,
    })
    if (error) throw new Error(friendlySupabaseError(error))
  }
  return result.data
}
