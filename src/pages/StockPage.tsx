import { useEffect, useState } from 'react'
import { useCompanies } from '../features/company/company-context'
import { getStockBalance } from '../services/movements'
import { tryGetSupabaseClient } from '../lib/supabase'
import { Container, Card } from '../components'
import { getEnvironmentLowStock, getNegativeBalances } from '../features/management/management'
import type { EnvironmentLowStock, NegativeBalance } from '../features/management/types'

type BalanceRow = { product_id: string; environment_id: string; balance: number }

export function StockPage() {
  const { activeCompany, role, isAdmin } = useCompanies()
  const companyId = activeCompany?.id
  const [rows, setRows] = useState<BalanceRow[]>([])
  const [environments, setEnvironments] = useState<Record<string, string>>({})
  const [products, setProducts] = useState<Record<string, string>>({})
  const [lowRows, setLowRows] = useState<EnvironmentLowStock[]>([])
  const [negativeRows, setNegativeRows] = useState<NegativeBalance[]>([])

  useEffect(() => {
    if (!companyId || (!isAdmin && role !== 'owner' && role !== 'manager')) return
    const supabase = tryGetSupabaseClient()
    if (!supabase) return
    queueMicrotask(() => {
      void Promise.all([
        getStockBalance(companyId),
        supabase.from('environments').select('*').eq('company_id', companyId),
        supabase.from('products').select('id,name').eq('company_id', companyId),
        getEnvironmentLowStock(companyId),
        getNegativeBalances(companyId),
      ]).then(([balances, environmentResult, productResult, low, negative]) => {
        setRows(balances)
        setLowRows(low)
        setNegativeRows(negative)
        setEnvironments(Object.fromEntries((environmentResult.data ?? []).map((item) => [item.id, item.name])))
        setProducts(Object.fromEntries((productResult.data ?? []).map((item) => [item.id, item.name])))
      })
    })
  }, [companyId, isAdmin, role])

  if (!isAdmin && role !== 'owner' && role !== 'manager') {
    return <Container><h1>Saldo por ambiente</h1><Card><p>Saldo disponível somente para proprietário e gerente.</p></Card></Container>
  }

  return (
    <Container>
      <h1>Saldo por ambiente</h1>
      <Card>
        <p><span style={{ color: '#8a6500' }}>■ Amarelo: abaixo do mínimo</span> • <span style={{ color: '#b00020' }}>■ Vermelho: saldo negativo</span></p>
        <div className="member-list">
          {rows.map((row) => (
            <article
              className="member-row"
              key={`${row.product_id}-${row.environment_id}`}
              style={{
                background: negativeRows.some((item) => item.product_id === row.product_id && item.environment_id === row.environment_id)
                  ? '#fde7ea'
                  : lowRows.some((item) => item.product_id === row.product_id && item.environment_id === row.environment_id && row.balance <= item.min_stock)
                    ? '#fff4cc'
                    : undefined,
              }}
            >
              <div>
                <strong>{products[row.product_id] ?? row.product_id}</strong>
                <span>{environments[row.environment_id] ?? row.environment_id}</span>
              </div>
              <strong>{new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(row.balance)}</strong>
            </article>
          ))}
        </div>
      </Card>
    </Container>
  )
}
