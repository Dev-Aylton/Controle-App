import { tryGetSupabaseClient } from '../../lib/supabase'
import { friendlySupabaseError } from '../../lib/errors'

export type StockSuggestion = {
  product_id: string
  product_name: string
  environment_id: string
  environment_name: string
  current_min: number
  current_max: number | null
  suggested_min: number
  suggested_max: number
  data_days: number
}

export async function getStockSuggestions(companyId: string, environmentId: string | null, days = 90) {
  const supabase = tryGetSupabaseClient()
  if (!supabase) throw new Error('Supabase não configurado.')
  const result = await supabase.rpc('get_stock_level_suggestions', {
    p_company_id: companyId,
    p_environment_id: environmentId,
    p_days: days,
  })
  if (result.error) throw new Error(friendlySupabaseError(result.error))
  return (result.data ?? []) as StockSuggestion[]
}

export function calculateStockLevels(dailyConsumption: number): { minimum: number; maximum: number } {
  return {
    minimum: Math.ceil(dailyConsumption * 2),
    maximum: Math.ceil(dailyConsumption * 7),
  }
}
