import { useCallback, useEffect, useState } from 'react'
import { useCompanies } from '../features/company/company-context'
import { tryGetSupabaseClient } from '../lib/supabase'
import { Container, Card, ActionButton, ContextHelp, PageGuide } from '../components'
import { getMovementReport } from '../features/management/management'
import type { MovementReportRow } from '../features/management/types'
import { downloadCsv } from '../features/management/csv'
import { traduzirErro } from '../lib/errors'

export function ReportPage() {
  const { activeCompany, role, isAdmin } = useCompanies()
  const [environmentId, setEnvironmentId] = useState('')
  const [environments, setEnvironments] = useState<Array<{ id: string; name: string }>>([])
  const [rows, setRows] = useState<MovementReportRow[]>([])
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
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
      setRows(await getMovementReport(
        activeCompany.id,
        `${from}T00:00:00.000Z`,
        `${to}T23:59:59.999Z`,
        environmentId || null,
      ))
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível carregar o relatório.'))
    } finally {
      setLoading(false)
    }
  }, [activeCompany, environmentId, from, to])

  useEffect(() => {
    if (activeCompany) queueMicrotask(() => { void load() })
  }, [activeCompany, load])

  if (!isAdmin && role !== 'owner' && role !== 'manager') {
    return <Container><h1>Relatórios</h1><Card><p>Acesso restrito.</p></Card></Container>
  }

  const exportCsv = () => {
    downloadCsv(
      `${activeCompany?.name ?? 'empresa'}-relatorio-${from}-${to}.csv`,
      [
        ['Produto', 'Ambiente', 'Entradas', 'Saídas', 'Perdas', 'Transferências saída', 'Transferências entrada', 'Ajustes', 'Estornos'],
        ...rows.map((row) => [row.product_name, row.environment_name, row.entradas, row.saidas, row.perdas, row.transferencias_saida, row.transferencias_entrada, row.ajustes, row.estornos]),
      ],
    )
  }

  return (
    <Container>
      <h1>Relatórios de movimentação</h1>
      <PageGuide
        purpose="Explicar como o estoque mudou em um período escolhido."
        doNext="Defina datas e ambiente e revise entradas, saídas, perdas, transferências e ajustes."
        result="O relatório ajuda na conferência operacional e pode ser exportado."
        roleNote="Disponível para proprietários, gerentes e administradores."
      />
      <ContextHelp
        title="Como ler este relatório?"
        description="O relatório reúne todas as movimentações por produto e ambiente dentro do período escolhido."
        steps={[
          'Defina início e fim.',
          'Escolha um ambiente ou consulte todos.',
          'Compare entradas, saídas, perdas, transferências e ajustes.',
          'Exporte o resultado em CSV para análise externa.',
        ]}
        result="O relatório ajuda a explicar por que o estoque mudou em determinado período."
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      <Card>
        <div className="form-grid">
          <label>De<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>Até<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <label>Ambiente
            <select value={environmentId} onChange={(event) => setEnvironmentId(event.target.value)}>
              <option value="">Todos</option>
              {environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </div>
        <ActionButton className="primary-button" onAction={load} disabled={loading} busyLabel="Carregando...">Aplicar filtros</ActionButton>
        <ActionButton className="secondary-button" onAction={exportCsv} disabled={loading || rows.length === 0} busyLabel="Exportando...">Exportar CSV</ActionButton>
      </Card>
      {loading && <p className="page-state">Carregando relatório...</p>}
      {!loading && <Card>{rows.length === 0 ? <p>Nenhuma movimentação encontrada. Altere o período ou o ambiente.</p> : (
        <>
        <div className="form-grid" aria-label="Resumo consolidado">
          <Card><p><strong>Entradas</strong><br />{rows.reduce((sum, row) => sum + Number(row.entradas), 0)}</p></Card>
          <Card><p><strong>Saídas</strong><br />{rows.reduce((sum, row) => sum + Number(row.saidas), 0)}</p></Card>
          <Card><p><strong>Perdas</strong><br />{rows.reduce((sum, row) => sum + Number(row.perdas), 0)}</p></Card>
          <Card><p><strong>Ajustes</strong><br />{rows.reduce((sum, row) => sum + Number(row.ajustes), 0)}</p></Card>
        </div>
        <div className="table-wrap"><table><thead><tr><th>Produto</th><th>Ambiente</th><th>Entradas</th><th>Saídas</th><th>Perdas</th><th>Transf. saída</th><th>Transf. entrada</th><th>Ajustes</th><th>Estornos</th></tr></thead>
          <tbody>{rows.map((row) => <tr key={`${row.product_id}-${row.environment_id}`}><td>{row.product_name}</td><td>{row.environment_name}</td><td>{row.entradas}</td><td>{row.saidas}</td><td>{row.perdas}</td><td>{row.transferencias_saida}</td><td>{row.transferencias_entrada}</td><td>{row.ajustes}</td><td>{row.estornos}</td></tr>)}</tbody>
        </table></div>
        </>
      )}</Card>}
    </Container>
  )
}
