import { useCallback, useEffect, useState } from 'react'
import { useCompanies } from '../features/company/company-context'
import { Container, Card, ActionButton, ContextHelp, PageGuide } from '../components'
import { getAuditPage } from '../features/management/management'
import type { AuditRow } from '../features/management/types'
import { downloadCsv } from '../features/management/csv'
import { traduzirErro } from '../lib/errors'

function getAuditActionLabel(action: string) {
  const labels: Record<string, string> = {
    movement_registered: 'Movimentação registrada',
    movement_reversed: 'Movimentação estornada',
    transfer_registered: 'Transferência registrada',
    inventory_opened: 'Contagem iniciada',
    inventory_finished: 'Inventário finalizado',
    stock_zeroed: 'Estoque zerado',
    sales_import_applied: 'Venda importada',
    sales_import_undone: 'Importação de vendas desfeita',
    products_created: 'Produto cadastrado',
    products_updated: 'Produto atualizado',
    products_deleted: 'Produto desativado',
    products_imported: 'Produtos importados',
    environments_created: 'Ambiente criado',
    environments_updated: 'Ambiente atualizado',
    product_categories_created: 'Categoria criada',
    product_categories_updated: 'Categoria atualizada',
    rotate_company_code: 'Código da empresa alterado',
    promote_to_manager: 'Membro promovido',
    deactivate_member: 'Membro desativado',
    join_company_with_code: 'Membro entrou na empresa',
    create_invite: 'Convite criado',
  }
  return labels[action] ?? action.replaceAll('_', ' ')
}

export function AuditPage() {
  const { activeCompany, role, isAdmin } = useCompanies()
  const [rows, setRows] = useState<AuditRow[]>([])
  const [action, setAction] = useState('')
  const [userFilter, setUserFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<AuditRow | null>(null)
  const [from, setFrom] = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10))
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [auditPage, setAuditPage] = useState(1)
  const [auditTotal, setAuditTotal] = useState(0)
  const auditPageSize = 50

  const load = useCallback(async (page = 1) => {
    if (!activeCompany) return
    setAuditPage(page)
    setLoading(true)
    setError('')
    try {
      const result = await getAuditPage({
        companyId: activeCompany.id,
        from: `${from}T00:00:00.000Z`,
        to: `${to}T23:59:59.999Z`,
        action,
        user: userFilter,
        search,
        limit: auditPageSize,
        offset: (page - 1) * auditPageSize,
      })
      setRows(result.rows)
      setAuditTotal(result.total)
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível carregar a auditoria.'))
    } finally {
      setLoading(false)
    }
  }, [action, activeCompany, from, search, to, userFilter])

  useEffect(() => {
    if (activeCompany) queueMicrotask(() => { void load(1) })
  }, [activeCompany, load])

  if (!isAdmin && role !== 'owner' && role !== 'manager') {
    return <Container><h1>Auditoria</h1><Card><p>Acesso restrito.</p></Card></Container>
  }

  const filtered = rows
  const supportCount = rows.filter((row) => row.acted_as_support).length
  const auditPageCount = Math.max(1, Math.ceil(auditTotal / auditPageSize))
  const visibleAuditRows = rows
  const exportCsv = () => {
    downloadCsv(
      `${activeCompany?.name ?? 'empresa'}-auditoria-${from}-${to}.csv`,
      [
        ['Data', 'Ação', 'Objeto', 'Usuário', 'Resumo'],
        ...filtered.map((row) => [new Date(row.created_at).toLocaleString('pt-BR'), getAuditActionLabel(row.action), row.object_name, row.user_name, row.summary]),
      ],
    )
  }

  return (
    <Container>
      <h1>Auditoria</h1>
      <PageGuide
        purpose="Identificar quem fez ações críticas e quando, evitando alterações sem rastreabilidade."
        doNext="Filtre por período, usuário ou ação e abra um registro para ver detalhes."
        result="A auditoria oferece responsabilidade, contexto e base para investigação."
        roleNote="Disponível para proprietários, gerentes e administradores."
      />
      <ContextHelp
        title="Para que serve a auditoria?"
        description="A auditoria registra quem fez ações importantes, em qual empresa e quando. Serve para identificar, revisar e corrigir alterações."
        steps={[
          'Filtre por período, usuário, ação ou produto.',
          'Abra um registro para ver os detalhes.',
          'Use “Suporte” apenas para ações feitas pelo administrador em nome da empresa.',
          'Exporte os registros para investigação ou prestação de contas.',
        ]}
        result="Cada registro mostra responsabilidade operacional e reduz alterações sem rastreabilidade."
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="audit-summary-grid" aria-label="Resumo da auditoria">
        <Card><span>Registros</span><strong>{auditTotal}</strong><small>No período filtrado</small></Card>
        <Card><span>Pessoas</span><strong>{new Set(filtered.map((row) => row.user_name)).size}</strong><small>Usuários identificados</small></Card>
        <Card><span>Suporte</span><strong>{supportCount}</strong><small>Ações registradas como suporte</small></Card>
      </div>
      <Card>
        <div className="audit-filter-grid">
          <label>De<input type="date" value={from} onChange={(event) => { setFrom(event.target.value); setAuditPage(1) }} /></label>
          <label>Até<input type="date" value={to} onChange={(event) => { setTo(event.target.value); setAuditPage(1) }} /></label>
          <label>Usuário
            <input value={userFilter} onChange={(event) => { setUserFilter(event.target.value); setAuditPage(1) }} placeholder="Nome da pessoa" />
          </label>
          <label>Tipo
            <select value={action} onChange={(event) => { setAction(event.target.value); setAuditPage(1) }}>
              <option value="">Todos</option>
              <option value="movement">Movimentações</option>
              <option value="inventory">Inventário</option>
              <option value="products">Produtos</option>
              <option value="promote">Promoções</option>
              <option value="deactivate">Desativações</option>
              <option value="rotate">Troca de código</option>
              <option value="sales">Vendas</option>
              <option value="stock">Estoque</option>
            </select>
          </label>
          <label className="audit-search">Buscar
            <input value={search} onChange={(event) => { setSearch(event.target.value); setAuditPage(1) }} placeholder="Usuário, produto, ação ou ambiente" />
          </label>
        </div>
        <div className="audit-filter-actions">
          <ActionButton className="primary-button" onAction={() => load(1)} disabled={loading} busyLabel="Carregando...">Aplicar filtros</ActionButton>
          <ActionButton className="secondary-button" onAction={exportCsv} disabled={loading || filtered.length === 0} busyLabel="Exportando...">Exportar CSV</ActionButton>
        </div>
      </Card>
      {loading && <p className="page-state">Carregando auditoria...</p>}
      {!loading && <Card>{filtered.length === 0 ? <p>Nenhum registro corresponde aos filtros. Amplie o período ou limpe a busca.</p> : (
        <>
        <div className="audit-timeline">
          {visibleAuditRows.map((row) => (
            <article className="audit-record" key={`${row.action}-${row.created_at}-${row.user_name}-${row.summary}`}>
              <button type="button" className="audit-record-main" onClick={() => setSelected(selected?.created_at === row.created_at ? null : row)}>
                <span className={`audit-record-mark ${row.acted_as_support ? 'support' : ''}`} aria-hidden="true"></span>
                <span className="audit-record-copy">
                  <strong>{getAuditActionLabel(row.action)}</strong>
                  <small>{row.user_name} • {row.object_name}</small>
                </span>
                <time>{new Date(row.created_at).toLocaleString('pt-BR')}</time>
              </button>
              {selected?.created_at === row.created_at && (
                <div className="audit-record-detail">
                  <div><span>Ação</span><strong>{getAuditActionLabel(row.action)}</strong></div>
                  <div><span>Objeto</span><strong>{row.object_name}</strong></div>
                  <div><span>Responsável</span><strong>{row.user_name}</strong></div>
                  <div><span>Data e hora</span><strong>{new Date(row.created_at).toLocaleString('pt-BR', { dateStyle: 'full', timeStyle: 'short' })}</strong></div>
                  {row.acted_as_support && <div><span>Modo</span><strong>Ação registrada como suporte</strong></div>}
                </div>
              )}
            </article>
          ))}
        </div>
        <div className="pagination-controls" aria-label="Paginação da auditoria">
          <button type="button" className="secondary-button" disabled={auditPage <= 1 || loading} onClick={() => void load(auditPage - 1)}>Anterior</button>
          <span>Página {auditPage} de {auditPageCount} • {auditTotal} registros</span>
          <button type="button" className="secondary-button" disabled={auditPage >= auditPageCount || loading} onClick={() => void load(auditPage + 1)}>Próxima</button>
        </div>
        </>
      )}</Card>}
    </Container>
  )
}
