import wordmarkLight from '../../docs/logos/opcao-a/wordmark-light.svg'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { Container } from '../components/Container'
import { Grid } from '../components/Grid'
import { Card } from '../components/Card'
import { useCompanies } from '../features/company/company-context'
import { useEffect, useState } from 'react'
import { listProductData } from '../features/products/productService'
import { getStockBalance } from '../services/movements'
import { tryGetSupabaseClient } from '../lib/supabase'

type HomePageProps = {
  status: string
}

export function HomePage({ status }: HomePageProps) {
  const layout = useBreakpoint()
  const { activeCompany, role, isAdmin } = useCompanies()
  const activeCompanyId = activeCompany?.id
  const [activeProducts, setActiveProducts] = useState<number | null>(null)
  const [stockValue, setStockValue] = useState<number | null>(null)
  const [movementsToday, setMovementsToday] = useState<number | null>(null)
  useEffect(() => {
    if (!activeCompanyId) return
    void listProductData(activeCompanyId).then((data) => {
      setActiveProducts(data.products.filter((product) => product.active).length)
      if (isAdmin || role === 'owner' || role === 'manager') {
        void getStockBalance(activeCompanyId).then((balances) => {
          const costMap = new Map(data.costs.map((cost) => [cost.product_id, Number(cost.unit_cost)]))
          const value = balances.reduce((total, row) => total + Number(row.balance) * (costMap.get(row.product_id) ?? 0), 0)
          setStockValue(value)
        })
        const supabase = tryGetSupabaseClient()
        if (supabase) {
          const start = new Date()
          start.setHours(0, 0, 0, 0)
          void supabase.from('stock_movements').select('id', { count: 'exact', head: true }).eq('company_id', activeCompanyId).gte('created_at', start.toISOString()).then((result) => setMovementsToday(result.count ?? 0))
        }
      }
    }).catch(() => setActiveProducts(0))
  }, [activeCompanyId, isAdmin, role])
  const showStockValue = isAdmin || role === 'owner' || role === 'manager'
  return (
    <Container>
      <img className="app-wordmark" src={wordmarkLight} alt="Controle-App" />
      <p className="layout-check">Layout detectado: {layout}</p>
      <Grid>
        <Card><p role="status">{status}</p></Card>
        <Card><p>Área pronta para recursos do Controle-App.</p></Card>
        <Card><p><strong>Produtos ativos</strong><br />{activeProducts ?? '—'}</p></Card>
        {showStockValue && (
          <>
          <Card><p><strong>Valor de estoque parado</strong><br />{stockValue === null ? '—' : new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(stockValue)}<br /><small>disponível após as primeiras movimentações</small></p></Card>
          <Card><p><strong>Movimentações de hoje</strong><br />{movementsToday ?? '—'}</p></Card>
          </>
        )}
      </Grid>
    </Container>
  )
}
