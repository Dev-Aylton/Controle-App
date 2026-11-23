import { tryGetSupabaseClient } from '../../lib/supabase'
import { friendlySupabaseError } from '../../lib/errors'
import type { Tables } from '../../lib/database.types'
import { expandProductSearchTerms, normalizeProductSearch, PRODUCT_CATEGORY_SYNONYMS } from './productCatalog'

export async function listPagedProductData(input: {
  companyId: string
  canManage: boolean
  search: string
  categoryId: string
  showInactive: boolean
  page: number
  pageSize: number
}) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const from = (input.page - 1) * input.pageSize
  const to = from + input.pageSize - 1
  const [categoriesResult, costsResult] = await Promise.all([
    supabase.from('product_categories').select('*').eq('company_id', input.companyId).order('name'),
    input.canManage
      ? supabase.from('product_costs').select('*').eq('company_id', input.companyId)
      : Promise.resolve({ data: [] as Tables<'product_costs'>[], error: null }),
  ])
  const categories = categoriesResult.data ?? []
  let query = supabase
    .from('products')
    .select('id,company_id,category_id,name,sku,unit,weight_g,volume_ml,dose_ml,photo_path,active,created_at,created_by', { count: 'exact' })
    .eq('company_id', input.companyId)
    .order('name')
  if (!input.showInactive) query = query.eq('active', true)
  if (input.categoryId) query = query.eq('category_id', input.categoryId)
  const cleanSearch = input.search.trim()
  if (cleanSearch) {
    const normalizedSearch = normalizeProductSearch(cleanSearch)
    const searchTerms = expandProductSearchTerms(cleanSearch)
    const categoryIds = categories
      .filter((category) => {
        const categoryName = normalizeProductSearch(category.name)
        if (normalizedSearch && (categoryName.includes(normalizedSearch) || normalizedSearch.includes(categoryName))) return true
        return searchTerms.some((term) => {
          if (categoryName.includes(term) || term.includes(categoryName)) return true
          return Object.entries(PRODUCT_CATEGORY_SYNONYMS).some(([canonical, synonyms]) => {
            if (normalizeProductSearch(canonical) !== categoryName
              && categoryName !== 'softs'
              && !categoryName.includes(normalizeProductSearch(canonical))) return false
            return [canonical, ...synonyms].some((value) => {
              const normalizedValue = normalizeProductSearch(value)
              return normalizedSearch.includes(normalizedValue) || normalizedValue.includes(normalizedSearch)
            })
          })
        })
      })
      .map((category) => category.id)
    const orParts = searchTerms.flatMap((term) => [
      `name.ilike.%${term}%`,
      `sku.ilike.%${term}%`,
    ])
    if (categoryIds.length) orParts.push(...categoryIds.map((categoryId) => `category_id.eq.${categoryId}`))
    if (orParts.length) query = query.or(orParts.join(','))
  }
  const { data, count, error } = await query.range(from, to)
  if (error) throw new Error(`Produtos: ${friendlySupabaseError(error)}`)
  return {
    products: (data ?? []) as unknown as Array<Tables<'products'>>,
    categories: categoriesResult.data ?? [],
    categoryError: categoriesResult.error ? friendlySupabaseError(categoriesResult.error) : null,
    costs: costsResult.data ?? [],
    total: count ?? 0,
  }
}

export async function listProductCategories(companyId: string) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const { data, error } = await supabase
    .from('product_categories')
    .select('*')
    .eq('company_id', companyId)
    .order('name')
  if (error) throw new Error(`Categorias: ${friendlySupabaseError(error)}`)
  return data ?? []
}

export async function listProductData(companyId: string, canManage = false) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const fullProductsResult = await supabase
    .from('products')
    .select('id,company_id,category_id,name,sku,unit,weight_g,volume_ml,dose_ml,photo_path,active,created_at,created_by')
    .eq('company_id', companyId)
    .order('name')

  let productsData = (fullProductsResult.data ?? []) as unknown as Array<Tables<'products'>>
  let productsError: { message: string } | null = fullProductsResult.error
  if (fullProductsResult.error) {
    const minimalProductsResult = await supabase
      .from('products')
      .select('id,company_id,category_id,name,sku,unit,photo_path,active,created_at,created_by')
      .eq('company_id', companyId)
      .order('name')
    productsData = (minimalProductsResult.data ?? []).map((product) => ({
      ...product,
      weight_g: null,
      volume_ml: null,
      dose_ml: null,
    })) as unknown as Array<Tables<'products'>>
    productsError = minimalProductsResult.error
  }
  const [categoriesResult, costsResult] = await Promise.all([
    supabase.from('product_categories').select('*').eq('company_id', companyId).order('name'),
    canManage
      ? supabase.from('product_costs').select('*').eq('company_id', companyId)
      : Promise.resolve({ data: [] as Tables<'product_costs'>[], error: null }),
  ])
  if (productsError) throw new Error(`Produtos: ${friendlySupabaseError(productsError)}`)
  let limitsResult: { data: unknown[] | null; error: unknown } | null = null
  if (canManage) limitsResult = await supabase.rpc('get_product_stock_limits', { p_company_id: companyId })
  const limits = new Map<string, { min_stock: number | null; max_stock: number | null }>(
    (limitsResult?.error ? [] : (limitsResult?.data ?? [])).map((item: unknown) => {
      const row = item as { product_id: string; min_stock: number | null; max_stock: number | null }
      return [row.product_id, row]
    }),
  )
  return {
    products: productsData.map((product) => ({
      ...product,
      min_stock: limits.get(product.id)?.min_stock ?? null,
      max_stock: limits.get(product.id)?.max_stock ?? null,
    })),
    categories: categoriesResult.data ?? [],
    categoryError: categoriesResult.error ? friendlySupabaseError(categoriesResult.error) : null,
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
  if (!supabase) return
  const { error } = await supabase.from('product_categories').update({ name: name.trim(), active }).eq('id', id)
  if (error) throw new Error(friendlySupabaseError(error))
}

export async function saveProduct(
  companyId: string,
  id: string | null,
  payload: {
    name: string
    sku: string | null
    category_id: string | null
    unit: 'un'|'kg'|'g'|'l'|'ml'|'cx'|'pct'|'garrafa'|'lata'|'maço'|'porcao'|'duzia'|'bandeja'|'pacote'|'saco'|'ramo'|'peca'|'fardo'|'frasco'
    weight_g: number | null
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
  if (!cleanPayload.name) throw new Error('Informe o nome do produto.')

  if (!id) {
    if (cleanPayload.sku) {
      const { data: skuConflict, error: skuError } = await supabase
        .from('products')
        .select('id,name')
        .eq('company_id', companyId)
        .ilike('sku', cleanPayload.sku)
        .limit(1)
        .maybeSingle()
      if (skuError) throw new Error(friendlySupabaseError(skuError))
      if (skuConflict) throw new Error(`Este código/SKU já pertence ao produto "${skuConflict.name}".`)
    }
    const variantRows = await supabase
      .from('products')
      .select('id,name,volume_ml,dose_ml,weight_g')
      .eq('company_id', companyId)
      .ilike('name', cleanPayload.name)
      .eq('unit', cleanPayload.unit)
    if (variantRows.error) throw new Error(friendlySupabaseError(variantRows.error))
    const exactVariant = (variantRows.data ?? []).find((row) =>
      Number(row.volume_ml ?? 0) === Number(cleanPayload.volume_ml ?? 0)
      && Number(row.dose_ml ?? 0) === Number(cleanPayload.dose_ml ?? 0)
      && Number(row.weight_g ?? 0) === Number(cleanPayload.weight_g ?? 0),
    )
    if (exactVariant) throw new Error(`Esta variante já existe: "${exactVariant.name}", ${cleanPayload.unit}. Use outro tamanho, volume ou peso.`)
  }

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
