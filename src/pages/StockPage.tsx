import { useEffect, useState } from 'react'
import { useCompanies } from '../features/company/company-context'
import { getStockBalance } from '../services/movements'
import { tryGetSupabaseClient } from '../lib/supabase'
import { Container, Card, ContextHelp, PageGuide } from '../components'
import { getEnvironmentLowStock, getNegativeBalances } from '../features/management/management'
import type { EnvironmentLowStock, NegativeBalance } from '../features/management/types'
import { traduzirErro } from '../lib/errors'
import { canManageCompany, canViewStock } from '../lib/uiPermissions'

type BalanceRow = { product_id: string; environment_id: string; balance: number }

export function StockPage() {
  const { activeCompany, role, isAdmin } = useCompanies()
  const companyId = activeCompany?.id
  const canView = canViewStock(role, isAdmin)
  const [rows, setRows] = useState<BalanceRow[]>([])
  const [environments, setEnvironments] = useState<Record<string, string>>({})
  const [products, setProducts] = useState<Record<string, string>>({})
  const [lowRows, setLowRows] = useState<EnvironmentLowStock[]>([])
  const [negativeRows, setNegativeRows] = useState<NegativeBalance[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!companyId || !canView) return
    const supabase = tryGetSupabaseClient()
    if (!supabase) {
      queueMicrotask(() => {
        setError('O servidor de dados não está configurado. Entre em contato com o suporte.')
        setLoading(false)
      })
      return
    }
    queueMicrotask(() => {
      setLoading(true)
      setError('')
      const canManage = isAdmin || role === 'owner' || role === 'manager'
      void Promise.all([
        getStockBalance(companyId),
        supabase.from('environments').select('*').eq('company_id', companyId),
        supabase.from('products').select('id,name').eq('company_id', companyId),
        canManage ? getEnvironmentLowStock(companyId) : Promise.resolve([]),
        canManage ? getNegativeBalances(companyId) : Promise.resolve([]),
      ]).then(([balances, environmentResult, productResult, low, negative]) => {
        setRows(balances)
        setLowRows(low)
        setNegativeRows(negative)
        setEnvironments(Object.fromEntries((environmentResult.data ?? []).map((item) => [item.id, item.name])))
        setProducts(Object.fromEntries((productResult.data ?? []).map((item) => [item.id, item.name])))
      }).catch((caught) => {
        setError(traduzirErro(caught, 'Não foi possível carregar o saldo dos ambientes.'))
      }).finally(() => {
        setLoading(false)
      })
    })
  }, [companyId, canView, isAdmin, role])

  if (!canView) {
    return <Container><h1>Saldo por ambiente</h1><Card><p>Selecione uma empresa ativa para consultar os saldos.</p></Card></Container>
  }

  return (
    <Container>
      <h1>Saldo por ambiente</h1>
      <PageGuide
        purpose="Mostrar a quantidade física registrada de cada produto em cada local."
        doNext="Filtre o ambiente ou produto que deseja conferir e use uma ação de movimentação ou inventário se houver divergência."
        result="Você sabe exatamente onde o estoque está e pode decidir entre transferir ou comprar."
        roleNote={canManageCompany(role, isAdmin) ? 'Você pode consultar alertas, mínimos e saldos detalhados.' : 'Você pode consultar o saldo operacional da empresa.'}
      />
      <ContextHelp
        title="Como interpretar o saldo?"
        description="Cada linha representa a quantidade registrada de um produto em um ambiente específico."
        steps={[
          'Amarelo: saldo chegou ao mínimo configurado.',
          'Vermelho: saldo ficou negativo.',
          'Use esta página para conferência; alterações são feitas em movimentações ou inventário.',
        ]}
        result="O saldo atual vem das entradas, saídas, perdas, transferências e ajustes do período."
      />
      <Card>
        <p><span style={{ color: '#8a6500' }}>■ Amarelo: abaixo do mínimo</span> • <span style={{ color: '#b00020' }}>■ Vermelho: saldo negativo</span></p>
        {loading && <p className="page-state">Carregando saldos...</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {!loading && !error && rows.length === 0 && <p>Nenhum saldo cadastrado. Faça uma entrada ou abra uma contagem para iniciar o controle.</p>}
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
