import { useCallback, useEffect, useState } from 'react'
import { useCompanies } from '../features/company/company-context'
import { tryGetSupabaseClient } from '../lib/supabase'
import { Container, Card, ContextHelp } from '../components'
import {
  getEnvironmentLowStock, getLowStockAlerts, getMovementReport, getNegativeBalances, getPendingLossReasons,
} from '../features/management/management'
import type { AlertFilter } from '../features/management/rules'
import type { EnvironmentLowStock, LowStockAlert, NegativeBalance, PendingLoss } from '../features/management/types'
import { traduzirErro } from '../lib/errors'

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

  return (
    <Container>
      <h1>Central de alertas</h1>
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
            <select value={filter} onChange={(event) => setFilter(event.target.value as AlertFilter)}>
              <option value="abaixo">Abaixo do mínimo</option>
              <option value="sem_estoque">Sem estoque</option>
              <option value="negativo">Saldo negativo</option>
              <option value="perda">Perdas sem motivo</option>
              <option value="divergencia">Divergência de inventário</option>
            </select>
          </label>
          <label>Ambiente
            <select value={environmentId} onChange={(event) => setEnvironmentId(event.target.value)}>
              <option value="">Todos</option>
              {environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
      </Card>
      {loading && <p className="page-state">Carregando alertas...</p>}
      {!loading && (
        <Card>
          {filter === 'abaixo' && (
            belowFiltered.length === 0 ? <p>Nenhum produto abaixo do mínimo. Continue acompanhando as movimentações.</p> :
              belowFiltered.map((row) => <article className="member-row" key={row.product_id}><strong>{row.product_name}</strong><span>Saldo {row.total_balance} • mínimo {row.min_stock}</span></article>)
          )}
          {filter === 'sem_estoque' && (
            noStock.length === 0 ? <p>Nenhum produto sem estoque. Nenhuma ação é necessária agora.</p> :
              noStock.map((row) => <article className="member-row" key={`${row.product_id}-${row.environment_id}`}><strong>{row.product_name}</strong><span>{row.environment_name} • saldo zero</span></article>)
          )}
          {filter === 'negativo' && (
            negativeFiltered.length === 0 ? <p>Nenhum saldo negativo. Revise inventários somente quando necessário.</p> :
              negativeFiltered.map((row) => <article className="member-row" key={`${row.product_id}-${row.environment_id}`}><strong>{row.product_name}</strong><span>{row.environment_name} • saldo {row.balance}</span></article>)
          )}
          {filter === 'perda' && (
            pendingFiltered.length === 0 ? <p>Nenhuma perda pendente. Todas as perdas registradas possuem motivo.</p> :
              pendingFiltered.map((row) => <article className="member-row" key={row.movement_id}><strong>{row.product_name}</strong><span>{row.environment_name} • quantidade {row.quantity}</span></article>)
          )}
          {filter === 'divergencia' && (
            divergenceCount === 0 ? <p>Nenhuma divergência recente nos últimos 30 dias.</p> :
              <p>{divergenceCount} produto(s) com ajuste de inventário nos últimos 30 dias.</p>
          )}
        </Card>
      )}
    </Container>
  )
}
