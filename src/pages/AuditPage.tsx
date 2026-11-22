import { useCallback, useEffect, useState } from 'react'
import { useCompanies } from '../features/company/company-context'
import { Container, Card, ActionButton } from '../components'
import { getAuditLog } from '../features/management/management'
import type { AuditRow } from '../features/management/types'
import { downloadCsv } from '../features/management/csv'
import { traduzirErro } from '../lib/errors'

export function AuditPage() {
  const { activeCompany, role, isAdmin } = useCompanies()
  const [rows, setRows] = useState<AuditRow[]>([])
  const [action, setAction] = useState('')
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!activeCompany) return
    setLoading(true)
    setError('')
    try {
      setRows(await getAuditLog(activeCompany.id, `${from}T00:00:00.000Z`, `${to}T23:59:59.999Z`, 200))
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível carregar a auditoria.'))
    } finally {
      setLoading(false)
    }
  }, [activeCompany, from, to])

  useEffect(() => {
    if (activeCompany) queueMicrotask(() => { void load() })
  }, [activeCompany, load])

  if (!isAdmin && role !== 'owner' && role !== 'manager') {
    return <Container><h1>Auditoria</h1><Card><p>Acesso restrito.</p></Card></Container>
  }

  const filtered = action ? rows.filter((row) => row.action.includes(action)) : rows
  const exportCsv = () => {
    downloadCsv(
      `${activeCompany?.name ?? 'empresa'}-auditoria-${from}-${to}.csv`,
      [
        ['Data', 'Ação', 'Objeto', 'Usuário', 'Resumo'],
        ...filtered.map((row) => [new Date(row.created_at).toLocaleString('pt-BR'), row.action, row.object_name, row.user_name, row.summary]),
      ],
    )
  }

  return (
    <Container>
      <h1>Auditoria</h1>
      {error && <p className="form-error" role="alert">{error}</p>}
      <Card>
        <div className="form-grid">
          <label>De<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>Até<input type="date" value={to} onChange={(event) => setTo(event.target.value)} /></label>
          <label>Tipo
            <select value={action} onChange={(event) => setAction(event.target.value)}>
              <option value="">Todos</option>
              <option value="movement">Movimentações</option>
              <option value="inventory">Inventário</option>
              <option value="products">Produtos</option>
              <option value="promote">Promoções</option>
              <option value="deactivate">Desativações</option>
              <option value="rotate">Troca de código</option>
            </select>
          </label>
        </div>
        <ActionButton className="primary-button" onAction={load} disabled={loading} busyLabel="Carregando...">Aplicar filtros</ActionButton>
        <ActionButton className="secondary-button" onAction={exportCsv} disabled={loading || filtered.length === 0} busyLabel="Exportando...">Exportar CSV</ActionButton>
      </Card>
      {loading && <p className="page-state">Carregando auditoria...</p>}
      {!loading && <Card>{filtered.length === 0 ? <p>Nenhum registro de auditoria no período selecionado. Amplie o período para consultar.</p> : (
        <div className="member-list">{filtered.map((row) => (
          <article className="member-row" key={`${row.action}-${row.created_at}`}><div><strong>{row.summary}{row.acted_as_support ? ' • suporte' : ''}</strong><span>{row.action} • {row.object_name} • {row.user_name}</span><small>{new Date(row.created_at).toLocaleString('pt-BR')}</small></div></article>
        ))}</div>
      )}</Card>}
    </Container>
  )
}
