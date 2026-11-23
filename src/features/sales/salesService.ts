import { tryGetSupabaseClient } from '../../lib/supabase'
import { friendlySupabaseError } from '../../lib/errors'

export type ProductEnvironmentPricing = {
  product_id: string
  product_name: string
  sku: string | null
  unit: string
  volume_ml: number | null
  dose_ml: number | null
  unit_cost: number | null
  base_unit_cost: number | null
  unit_price: number | null
  dose_price: number | null
}

export async function listProductEnvironmentPricing(companyId: string, environmentId: string): Promise<ProductEnvironmentPricing[]> {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('list_product_environment_pricing', {
    p_company_id: companyId,
    p_environment_id: environmentId,
  })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  const rows = (result.data ?? []) as Array<Record<keyof ProductEnvironmentPricing, unknown>>
  return rows.map((row) => ({
    product_id: String(row.product_id),
    product_name: String(row.product_name),
    sku: row.sku == null ? null : String(row.sku),
    unit: String(row.unit),
    volume_ml: row.volume_ml == null ? null : Number(row.volume_ml),
    dose_ml: row.dose_ml == null ? null : Number(row.dose_ml),
    unit_cost: row.unit_cost == null ? null : Number(row.unit_cost),
    base_unit_cost: row.base_unit_cost == null ? null : Number(row.base_unit_cost),
    unit_price: row.unit_price == null ? null : Number(row.unit_price),
    dose_price: row.dose_price == null ? null : Number(row.dose_price),
  }))
}

export async function saveProductEnvironmentPricing(
  companyId: string,
  environmentId: string,
  row: Pick<ProductEnvironmentPricing, 'product_id' | 'unit_cost' | 'unit_price' | 'dose_price'>,
) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('upsert_product_environment_pricing', {
    p_company_id: companyId,
    p_environment_id: environmentId,
    p_product_id: row.product_id,
    p_unit_cost: row.unit_cost,
    p_unit_price: row.unit_price,
    p_dose_price: row.dose_price,
  })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
}

export type SalesMapRow = {
  map_id: string
  external_name: string
  normalized_name: string
  product_id: string
  product_name: string
  environment_id: string
}

export type SalesImportBatchRow = {
  batch_id: string
  label: string
  status: 'applied' | 'undone'
  total_items: number
  total_quantity: number
  total_revenue: number | null
  total_cogs: number | null
  total_gross_profit: number | null
  imported_at: string
  imported_by_name: string
}

export async function listSalesMap(companyId: string): Promise<SalesMapRow[]> {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('list_sales_product_map', { p_company_id: companyId })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return (result.data ?? []) as SalesMapRow[]
}

export async function saveSalesMap(companyId: string, externalName: string, productId: string, environmentId: string) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('save_sales_product_map', {
    p_company_id: companyId,
    p_external_name: externalName,
    p_product_id: productId,
    p_environment_id: environmentId,
  })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return result.data as string
}

export async function removeSalesMap(companyId: string, mapId: string) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('remove_sales_product_map', { p_company_id: companyId, p_map_id: mapId })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
}

export async function importSalesBatch(
  companyId: string,
  environmentId: string,
  label: string,
  items: Array<{ product_id: string; quantity: number; sale_type: 'unidade' | 'dose' }>,
  sourceHash?: string,
) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const args: Record<string, unknown> = {
    p_company_id: companyId,
    p_environment_id: environmentId,
    p_label: label,
    p_items: items,
  }
  if (sourceHash) args.p_source_hash = sourceHash
  const result = await supabase.rpc('import_sales_batch', args)
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return result.data as string
}

export async function undoSalesImport(batchId: string) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('undo_sales_import', { p_batch_id: batchId })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
}

export async function listSalesImports(companyId: string): Promise<SalesImportBatchRow[]> {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('list_sales_imports', { p_company_id: companyId })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  const rows = (result.data ?? []) as Array<Record<keyof SalesImportBatchRow, unknown>>
  return rows.map((row) => ({
    batch_id: String(row.batch_id),
    label: String(row.label),
    status: row.status === 'undone' ? 'undone' : 'applied',
    total_items: Number(row.total_items),
    total_quantity: Number(row.total_quantity),
    total_revenue: row.total_revenue == null ? null : Number(row.total_revenue),
    total_cogs: row.total_cogs == null ? null : Number(row.total_cogs),
    total_gross_profit: row.total_gross_profit == null ? null : Number(row.total_gross_profit),
    imported_at: String(row.imported_at),
    imported_by_name: String(row.imported_by_name),
  }))
}
