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
  purchase_count?: number
  purchase_interval_days?: number
  average_purchase_qty?: number
  recommended_action?: 'increase' | 'keep' | 'reduce'
  confidence?: 'alta' | 'media' | 'baixa'
  reason?: string
  perishability?: 'perecivel' | 'conservavel'
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

export type ReplenishmentMovement = {
  type: 'entrada' | 'saida' | 'perda' | 'transferencia_entrada' | 'transferencia_saida'
  quantity: number
  created_at: string
}

export function detectPerishableProduct(name: string, categoryName = '') {
  const text = `${name} ${categoryName}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  const perishables = [
    'fruta','verdura','legume','hortifruti','peixe','camarao','frango','carne',
    'picanha','maminha','alcatra','leite','queijo','iogurte','creme',
    'pao','sushi','salada','folha','latico','embutido',
  ]
  return perishables.some((term) => text.includes(term))
}

export function analyzeReplenishmentPattern(
  productName: string,
  categoryName: string,
  movements: ReplenishmentMovement[],
  currentMin: number,
  currentMax: number | null,
) {
  const purchases = movements.filter((item) => item.type === 'entrada')
  const consumption = movements.filter((item) => item.type === 'saida' || item.type === 'perda')
  const purchaseCount = purchases.length
  const totalPurchased = purchases.reduce((sum, item) => sum + Number(item.quantity), 0)
  const totalConsumed = consumption.reduce((sum, item) => sum + Number(item.quantity), 0)
  const perishable = detectPerishableProduct(productName, categoryName)
  const dates = purchases
    .map((item) => new Date(item.created_at).getTime())
    .filter((value) => Number.isFinite(value))
    .sort((left, right) => left - right)
  const intervals = dates.slice(1).map((value, index) => (value - dates[index]) / 86400000)
  const averageInterval = intervals.length
    ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
    : null
  const averagePurchase = purchaseCount ? totalPurchased / purchaseCount : 0

  let action: 'increase' | 'keep' | 'reduce' = 'keep'
  let confidence: 'alta' | 'media' | 'baixa' = 'baixa'
  let reason = 'Não há padrão suficiente para alterar os níveis.'

  if (purchaseCount >= 3 && averageInterval !== null && averageInterval <= 7) {
    if (perishable) {
      action = 'keep'
      confidence = 'media'
      reason = 'Há reposições frequentes, mas o item é perecível. Compras menores e frequentes devem continuar até confirmar perdas e validade.'
    } else if (totalConsumed > 0) {
      action = 'increase'
      confidence = purchaseCount >= 6 ? 'alta' : 'media'
      reason = 'O item é recomposto várias vezes em período curto e o consumo utiliza boa parte das entradas.'
    }
  }

  if (purchaseCount === 0) {
    reason = 'Não há entradas suficientes no período analisado.'
  }

  const levels = calculateStockLevels(totalConsumed / 90)
  const suggestedMin = perishable
    ? Math.min(levels.minimum, Math.max(1, Math.ceil(averagePurchase * 0.35)))
    : levels.minimum
  const suggestedMax = perishable
    ? Math.max(suggestedMin, Math.ceil(averagePurchase * 1.5))
    : levels.maximum

  return {
    purchaseCount,
    purchaseIntervalDays: averageInterval == null ? null : Number(averageInterval.toFixed(1)),
    averagePurchase,
    perishable,
    action,
    confidence,
    reason,
    suggestedMin,
    suggestedMax,
    currentMin,
    currentMax,
  }
}
