import { tryGetSupabaseClient } from '../../lib/supabase'
import { friendlySupabaseError } from '../../lib/errors'

export async function listProductData(companyId: string, canManage = false) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const [productsResult, categoriesResult, costsResult] = await Promise.all([
    supabase.from('products').select('id,company_id,category_id,name,sku,unit,volume_ml,dose_ml,photo_path,active,created_at,created_by').eq('company_id', companyId).order('name'),
    supabase.from('product_categories').select('*').eq('company_id', companyId).order('name'),
    supabase.from('product_costs').select('*').eq('company_id', companyId),
  ])
  if (productsResult.error) throw new Error(friendlySupabaseError(productsResult.error))
  if (categoriesResult.error) throw new Error(friendlySupabaseError(categoriesResult.error))
  const limitsResult = canManage
    ? await supabase.rpc('get_product_stock_limits', { p_company_id: companyId })
    : null
  if (limitsResult?.error) throw new Error(friendlySupabaseError(limitsResult.error))
  const limits = new Map<string, { min_stock: number | null; max_stock: number | null }>(
    (limitsResult?.data ?? []).map((item: { product_id: string; min_stock: number | null; max_stock: number | null }) => [item.product_id, item]),
  )
  return {
    products: (productsResult.data ?? []).map((product) => ({
      ...product,
      min_stock: limits.get(product.id)?.min_stock ?? null,
      max_stock: limits.get(product.id)?.max_stock ?? null,
    })),
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

export async function updateCategory(id: string, name: string, active = true) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const { error } = await supabase
    .from('product_categories')
    .update({ name: name.trim(), active })
    .eq('id', id)
  if (error) throw new Error(friendlySupabaseError(error))
}

export async function saveProduct(
  companyId: string,
  id: string | null,
  payload: {
    name: string
    sku: string | null
    category_id: string | null
    unit: 'un'|'kg'|'g'|'l'|'ml'|'cx'|'pct'
    min_stock: number | null
    max_stock: number | null
    volume_ml: number | null
    dose_ml: number | null
    photo_path: string | null
    active: boolean
  },
  unitCost?: number,
) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const cleanPayload = { ...payload, company_id: companyId, name: payload.name.trim(), sku: payload.sku?.trim() || null }
  const result = id
    ? await supabase.from('products').update(cleanPayload).eq('id', id).select('id').single()
    : await supabase.from('products').insert(cleanPayload).select('id').single()
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
