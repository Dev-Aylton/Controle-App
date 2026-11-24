import { useCallback, useEffect, useState } from 'react'
import { useCompanies } from '../features/company/company-context'
import { tryGetSupabaseClient } from '../lib/supabase'
import { Container, Card, ContextHelp, PageGuide } from '../components'
import {
  getEnvironmentLowStock, getLowStockAlerts, getMovementReport, getNegativeBalances, getPendingLossReasons,
} from '../features/management/management'
import type { AlertFilter } from '../features/management/rules'
import type { EnvironmentLowStock, LowStockAlert, NegativeBalance, PendingLoss } from '../features/management/types'
import { traduzirErro } from '../lib/errors'
import { NavLink } from 'react-router-dom'

type Option = { id: string; name: string }

export function AlertsPage() {
  const { activeCompany, role, isAdmin } = useCompanies()
  const [filter, setFilter] = useState<AlertFilter>('abaixo')
  const [environmentId, setEnvironmentId] = useState('')
  const [environments, setEnvironments] = useState<Option[]>([])
  const [below, setBelow] = useState<LowStockAlert[]>([])
  const [negative, setNegative] = useState<NegativeBalance[]>([])
  const [environmentLow, setEnvironmentLow] = useState<EnvironmentLowStock[]>([])
  const [pending, setPending] = useState<PendingLoss[]>([])
  const [divergenceCount, setDivergenceCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [alertSearch, setAlertSearch] = useState('')
  const [alertPage, setAlertPage] = useState(1)
  const alertPageSize = 25

  const load = useCallback(async () => {
    if (!activeCompany) return
    setLoading(true)
    setError('')
    try {
      const supabase = tryGetSupabaseClient()
      if (!supabase) throw new Error('Supabase não configurado.')
      const environmentResult = await supabase
        .from('environments').select('id,name').eq('company_id', activeCompany.id).eq('active', true)
      if (environmentResult.error) throw environmentResult.error
      setEnvironments((environmentResult.data ?? []).map((item) => ({ id: item.id, name: item.name })))
      const [belowRows, negativeRows, envRows, pendingRows] = await Promise.all([
        getLowStockAlerts(activeCompany.id),
        getNegativeBalances(activeCompany.id),
        getEnvironmentLowStock(activeCompany.id),
        getPendingLossReasons(activeCompany.id),
      ])
      setBelow(belowRows)
      setNegative(negativeRows)
      setEnvironmentLow(envRows)
      setPending(pendingRows)
      const now = new Date()
      const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const report = await getMovementReport(
        activeCompany.id,
        from.toISOString(),
        now.toISOString(),
        environmentId || null,
      )
      setDivergenceCount(report.filter((row) => Number(row.ajustes) !== 0).length)
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível carregar os alertas.'))
    } finally {
      setLoading(false)
    }
  }, [activeCompany, environmentId])

  useEffect(() => {
    if (activeCompany) queueMicrotask(() => { void load() })
  }, [activeCompany, environmentId, load])

  if (!isAdmin && role !== 'owner' && role !== 'manager') {
    return <Container><h1>Central de alertas</h1><Card><p>Acesso restrito a administradores, proprietários e gerentes.</p></Card></Container>
  }

  const belowFiltered = below.filter((row) => {
    if (!environmentId) return true
    return environmentLow.some((env) =>
      env.product_id === row.product_id
      && env.environment_id === environmentId
      && env.balance <= row.min_stock,
    )
  })
  const negativeFiltered = negative.filter((row) => !environmentId || row.environment_id === environmentId)
  const pendingFiltered = pending.filter((row) => !environmentId || row.environment_id === environmentId)
  const noStock = environmentLow.filter((row) => row.balance === 0 && (!environmentId || row.environment_id === environmentId))
  const matchesAlertSearch = (values: Array<string | number | null>) =>
    values.some((value) => String(value ?? '').toLowerCase().includes(alertSearch.toLowerCase().trim()))
  const belowVisible = belowFiltered.filter((row) => matchesAlertSearch([row.product_name, row.total_balance, row.min_stock])).slice((alertPage - 1) * alertPageSize, alertPage * alertPageSize)
  const noStockVisible = noStock.filter((row) => matchesAlertSearch([row.product_name, row.environment_name])).slice((alertPage - 1) * alertPageSize, alertPage * alertPageSize)
  const negativeVisible = negativeFiltered.filter((row) => matchesAlertSearch([row.product_name, row.environment_name, row.balance])).slice((alertPage - 1) * alertPageSize, alertPage * alertPageSize)
  const pendingVisible = pendingFiltered.filter((row) => matchesAlertSearch([row.product_name, row.environment_name, row.quantity])).slice((alertPage - 1) * alertPageSize, alertPage * alertPageSize)
  const alertResultCount = filter === 'abaixo'
    ? belowFiltered.filter((row) => matchesAlertSearch([row.product_name, row.total_balance, row.min_stock])).length
    : filter === 'sem_estoque'
      ? noStock.filter((row) => matchesAlertSearch([row.product_name, row.environment_name])).length
      : filter === 'negativo'
        ? negativeFiltered.filter((row) => matchesAlertSearch([row.product_name, row.environment_name, row.balance])).length
        : filter === 'perda'
          ? pendingFiltered.filter((row) => matchesAlertSearch([row.product_name, row.environment_name, row.quantity])).length
          : divergenceCount
  const alertPageCount = Math.max(1, Math.ceil(alertResultCount / alertPageSize))

  return (
    <Container>
      <h1>Central de alertas</h1>
      <PageGuide
        purpose="Concentrar situações que exigem decisão antes de afetar o estoque ou o fechamento."
        doNext="Escolha um tipo de alerta e use a rota sugerida para corrigir ou investigar."
        result="Alertas resolvidos deixam de representar pendências operacionais."
        roleNote="Disponível para proprietários, gerentes e administradores."
      />
      <ContextHelp
        title="O que esta central monitora?"
        description="Os alertas apontam situações que precisam de atenção antes que afetem operação ou fechamento."
        steps={[
          'Abaixo do mínimo: saldo chegou ao limite definido.',
          'Sem estoque: não existe saldo disponível no ambiente.',
          'Saldo negativo: lançamentos retiraram mais do que havia.',
          'Perdas pendentes: falta informar o motivo da perda.',
        ]}
        result="Use os alertas para corrigir dados e preparar reposições."
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      <Card>
        <div className="form-grid">
          <label>Aba
            <select value={filter} onChange={(event) => { setFilter(event.target.value as AlertFilter); setAlertPage(1) }}>
              <option value="abaixo">Abaixo do mínimo</option>
              <option value="sem_estoque">Sem estoque</option>
              <option value="negativo">Saldo negativo</option>
              <option value="perda">Perdas sem motivo</option>
              <option value="divergencia">Divergência de inventário</option>
            </select>
          </label>
          <label>Ambiente
            <select value={environmentId} onChange={(event) => { setEnvironmentId(event.target.value); setAlertPage(1) }}>
              <option value="">Todos</option>
              {environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>Buscar
            <input value={alertSearch} onChange={(event) => { setAlertSearch(event.target.value); setAlertPage(1) }} placeholder="Produto ou ambiente" />
          </label>
        </div>
      </Card>
      {loading && <p className="page-state">Carregando alertas...</p>}
      {!loading && (
        <Card>
          {filter === 'abaixo' && (
            belowFiltered.length === 0 ? <p>Nenhum produto abaixo do mínimo. Continue acompanhando as movimentações.</p> :
              belowVisible.map((row) => (
                <article className="member-row" key={row.product_id}>
                  <div><strong>{row.product_name}</strong><span>Saldo {row.total_balance} • mínimo {row.min_stock}</span></div>
                  <NavLink className="dashboard-action-button" to="/compras">Abrir lista de compras</NavLink>
                </article>
              ))
          )}
          {filter === 'sem_estoque' && (
            noStock.length === 0 ? <p>Nenhum produto sem estoque. Nenhuma ação é necessária agora.</p> :
              noStockVisible.map((row) => (
                <article className="member-row" key={`${row.product_id}-${row.environment_id}`}>
                  <div><strong>{row.product_name}</strong><span>{row.environment_name} • saldo zero</span></div>
                  <NavLink className="dashboard-action-button" to="/movimentacoes">Registrar entrada</NavLink>
                </article>
              ))
          )}
          {filter === 'negativo' && (
            negativeFiltered.length === 0 ? <p>Nenhum saldo negativo. Revise inventários somente quando necessário.</p> :
              negativeVisible.map((row) => (
                <article className="member-row" key={`${row.product_id}-${row.environment_id}`}>
                  <div><strong>{row.product_name}</strong><span>{row.environment_name} • saldo {row.balance}</span></div>
                  <NavLink className="dashboard-action-button" to="/inventario">Conferir inventário</NavLink>
                </article>
              ))
          )}
          {filter === 'perda' && (
            pendingFiltered.length === 0 ? <p>Nenhuma perda pendente. Todas as perdas registradas possuem motivo.</p> :
              pendingVisible.map((row) => (
                <article className="member-row" key={row.movement_id}>
                  <div><strong>{row.product_name}</strong><span>{row.environment_name} • quantidade {row.quantity}</span></div>
                  <NavLink className="dashboard-action-button" to="/movimentacoes">Informar motivo</NavLink>
                </article>
              ))
          )}
          {filter === 'divergencia' && (
            divergenceCount === 0 ? <p>Nenhuma divergência recente nos últimos 30 dias.</p> :
              (
                <article className="member-row">
                  <div><strong>Divergências recentes</strong><span>{divergenceCount} produto(s) nos últimos 30 dias</span></div>
                  <NavLink className="dashboard-action-button" to="/inventario">Revisar contagem</NavLink>
                </article>
              )
          )}
          {filter !== 'divergencia' && alertResultCount > 0 && (
            <div className="pagination-controls" aria-label="Paginação dos alertas">
              <button type="button" className="secondary-button" disabled={alertPage <= 1} onClick={() => setAlertPage((page) => Math.max(1, page - 1))}>Anterior</button>
              <span>Página {alertPage} de {alertPageCount}</span>
              <button type="button" className="secondary-button" disabled={alertPage >= alertPageCount} onClick={() => setAlertPage((page) => Math.min(alertPageCount, page + 1))}>Próxima</button>
            </div>
          )}
        </Card>
      )}
    </Container>
  )
}
