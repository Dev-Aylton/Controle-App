import { useCallback, useEffect, useState } from 'react'
import { useCompanies } from '../features/company/company-context'
import { Container, Card, ActionButton } from '../components'
import { tryGetSupabaseClient } from '../lib/supabase'
import { getPurchaseList } from '../features/management/management'
import type { PurchaseItem } from '../features/management/types'
import { downloadCsv } from '../features/management/csv'
import { traduzirErro } from '../lib/errors'
import { NavLink } from 'react-router-dom'

export function PurchaseListPage() {
  const { activeCompany, role, isAdmin } = useCompanies()
  const [rows, setRows] = useState<PurchaseItem[]>([])
  const [environments, setEnvironments] = useState<Array<{ id: string; name: string }>>([])
  const [environmentId, setEnvironmentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!activeCompany) return
    setLoading(true)
    setError('')
    try {
      const supabase = tryGetSupabaseClient()
      if (!supabase) throw new Error('Supabase não configurado.')
      const envResult = await supabase.from('environments').select('id,name').eq('company_id', activeCompany.id).eq('active', true)
      if (envResult.error) throw envResult.error
      setEnvironments((envResult.data ?? []).map((item) => ({ id: item.id, name: item.name })))
      setRows(await getPurchaseList(activeCompany.id, environmentId || null))
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível carregar a lista de compras.'))
    } finally {
      setLoading(false)
    }
  }, [activeCompany, environmentId])

  useEffect(() => {
    if (activeCompany) queueMicrotask(() => { void load() })
  }, [activeCompany, environmentId, load])

  if (!isAdmin && role !== 'owner' && role !== 'manager') {
    return <Container><h1>Lista de compras</h1><Card><p>Acesso restrito a administradores, proprietários e gerentes.</p></Card></Container>
  }

  const missingCosts = rows.some((row) => row.unit_cost === null || row.estimated_cost === null)
  const total = missingCosts ? null : rows.reduce((sum, row) => sum + Number(row.estimated_cost), 0)
  const exportCsv = () => {
    downloadCsv(
      `${activeCompany?.name ?? 'empresa'}-compras-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ['Produto', 'Ambiente', 'Saldo', 'Mínimo', 'Máximo', 'Sugestão', 'Custo unitário', 'Custo estimado'],
        ...rows.map((row) => [
          row.product_name, row.environment_name, row.balance, row.min_stock, row.max_stock,
          row.suggested_qty, row.unit_cost, row.estimated_cost,
        ]),
        ['Total', '', '', '', '', '', '', total ?? 'Custo ausente'],
      ],
    )
  }

  return (
    <Container>
      <h1>Lista de compras</h1>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Card>
        <label>Ambiente
          <select value={environmentId} onChange={(event) => setEnvironmentId(event.target.value)}>
            <option value="">Todos</option>
            {environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <ActionButton className="secondary-button" onAction={exportCsv} disabled={loading || rows.length === 0} busyLabel="Exportando...">Exportar CSV</ActionButton>
      </Card>
      {loading && <p className="page-state">Carregando lista de compras...</p>}
      {!loading && (
        <Card>
          {rows.length === 0 ? <p>Nenhum item precisa de compra no momento. Mantenha mínimo e máximo atualizados.</p> : (
            <>
              <div className="table-wrap"><table>
                <thead><tr><th>Produto</th><th>Ambiente</th><th>Saldo</th><th>Mínimo</th><th>Máximo</th><th>Sugestão</th><th>Custo</th><th>Estimado</th></tr></thead>
                <tbody>{rows.map((row) => (
                  <tr key={`${row.product_id}-${row.environment_id}`}>
                    <td>{row.product_name}</td><td>{row.environment_name}</td><td>{row.balance}</td><td>{row.min_stock}</td><td>{row.max_stock ?? '-'}</td><td>{row.suggested_qty}</td><td>{row.unit_cost ?? '-'}</td><td>{row.estimated_cost ?? '-'}</td>
                  </tr>
                ))}</tbody>
              </table></div>
              <p>
                <strong>Total estimado:</strong> {total === null
                  ? 'Indisponível — configure o custo base do produto ou o custo do ambiente em '
                  : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
                {total === null && <NavLink to="/vendas/precos">Preços de venda</NavLink>}
              </p>
            </>
          )}
        </Card>
      )}
    </Container>
  )
}
