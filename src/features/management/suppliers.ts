import { tryGetSupabaseClient } from '../../lib/supabase'
import { friendlySupabaseError } from '../../lib/errors'

export type Supplier = {
  id: string
  name: string
  contactName: string | null
  phone: string | null
  email: string | null
  notes: string | null
  active: boolean
}

export type SupplierPrice = {
  id: number
  productId: string
  supplierId: string
  unitPrice: number
  purchaseUnit: string
  unitsPerPurchase: number | null
  validFrom: string
}

export function getCheapestSupplierPrice(
  prices: SupplierPrice[],
  productId: string,
) {
  return prices
    .filter((price) => price.productId === productId)
    .sort((left, right) =>
      left.unitPrice - right.unitPrice
      || new Date(right.validFrom).getTime() - new Date(left.validFrom).getTime(),
    )[0] ?? null
}

export async function listSuppliers(companyId: string): Promise<Supplier[]> {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase
    .from('suppliers')
    .select('id,name,contact_name,phone,email,notes,active')
    .eq('company_id', companyId)
    .order('name')
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return (result.data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    contactName: row.contact_name,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    active: row.active,
  }))
}

export async function saveSupplier(
  companyId: string,
  supplierId: string | null,
  values: Pick<Supplier, 'name' | 'contactName' | 'phone' | 'email' | 'notes'>,
) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('save_supplier', {
    p_company_id: companyId,
    p_supplier_id: supplierId,
    p_name: values.name,
    p_contact_name: values.contactName,
    p_phone: values.phone,
    p_email: values.email,
    p_notes: values.notes,
  })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return String(result.data)
}

export async function listSupplierPrices(companyId: string, productId?: string): Promise<SupplierPrice[]> {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  let query = supabase
    .from('product_supplier_prices')
    .select('id,product_id,supplier_id,unit_price,purchase_unit,units_per_purchase,valid_from')
    .eq('company_id', companyId)
    .order('valid_from', { ascending: false })
  if (productId) query = query.eq('product_id', productId)
  const result = await query
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return (result.data ?? []).map((row) => ({
    id: row.id,
    productId: row.product_id,
    supplierId: row.supplier_id,
    unitPrice: Number(row.unit_price),
    purchaseUnit: row.purchase_unit,
    unitsPerPurchase: row.units_per_purchase == null ? null : Number(row.units_per_purchase),
    validFrom: row.valid_from,
  }))
}

export async function saveSupplierPrice(
  companyId: string,
  productId: string,
  supplierId: string,
  unitPrice: number,
  purchaseUnit = 'un',
  unitsPerPurchase: number | null = null,
) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('save_product_supplier_price', {
    p_company_id: companyId,
    p_product_id: productId,
    p_supplier_id: supplierId,
    p_unit_price: unitPrice,
    p_purchase_unit: purchaseUnit,
    p_units_per_purchase: unitsPerPurchase,
  })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
}
