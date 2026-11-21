import { useEffect, useState } from 'react'
import { useCompanies } from '../features/company/company-context'
import { getStockBalance } from '../services/movements'
import { tryGetSupabaseClient } from '../lib/supabase'
import { Container, Card } from '../components'

type BalanceRow = { product_id: string; environment_id: string; balance: number }

export function StockPage() {
  const { activeCompany, role, isAdmin } = useCompanies()
  const companyId = activeCompany?.id
  const [rows, setRows] = useState<BalanceRow[]>([])
  const [environments, setEnvironments] = useState<Record<string, string>>({})
  const [products, setProducts] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!companyId || (!isAdmin && role !== 'owner' && role !== 'manager')) return
    const supabase = tryGetSupabaseClient()
    if (!supabase) return
    queueMicrotask(() => {
      void Promise.all([
        getStockBalance(companyId),
        supabase.from('environments').select('*').eq('company_id', companyId),
        supabase.from('products').select('*').eq('company_id', companyId),
      ]).then(([balances, environmentResult, productResult]) => {
        setRows(balances)
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
        <div className="member-list">
          {rows.map((row) => (
            <article className="member-row" key={`${row.product_id}-${row.environment_id}`}>
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
