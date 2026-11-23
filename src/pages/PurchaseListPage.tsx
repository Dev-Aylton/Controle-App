import { useCallback, useEffect, useState } from 'react'
import { useCompanies } from '../features/company/company-context'
import { Container, Card, ActionButton, ContextHelp } from '../components'
import { tryGetSupabaseClient } from '../lib/supabase'
import { getPurchaseList } from '../features/management/management'
import type { PurchaseItem } from '../features/management/types'
import { downloadCsv } from '../features/management/csv'
import { traduzirErro } from '../lib/errors'
import { NavLink } from 'react-router-dom'
import type { PurchaseDraftItem } from '../features/management/purchaseListDraft'
import { calculatePurchaseDraftEstimated, calculatePurchaseDraftTotal } from '../features/management/purchaseListDraft'
import { downloadBlankPurchaseListPdf, downloadPurchaseListPdf } from '../features/management/purchaseListPdf'

export function PurchaseListPage() {
  const { activeCompany, role, isAdmin } = useCompanies()
  const [rows, setRows] = useState<PurchaseItem[]>([])
  const [environments, setEnvironments] = useState<Array<{ id: string; name: string }>>([])
  const [environmentId, setEnvironmentId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [draftItems, setDraftItems] = useState<PurchaseDraftItem[]>([])
  const [previewOpen, setPreviewOpen] = useState(false)
  const [manualName, setManualName] = useState('')
  const [manualEnvironment, setManualEnvironment] = useState('')
  const [manualQuantity, setManualQuantity] = useState(1)
  const [manualCost, setManualCost] = useState<number | null>(null)

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
      const nextRows = await getPurchaseList(activeCompany.id, environmentId || null)
      setRows(nextRows)
      setDraftItems(nextRows.map((row) => ({
        key: `${row.product_id}-${row.environment_id}`,
        productName: row.product_name,
        environmentName: row.environment_name,
        quantity: row.suggested_qty,
        unitCost: row.unit_cost,
        manual: false,
      })))
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
    const csvItems = draftItems.filter((item) => item.quantity > 0)
    if (csvItems.length === 0) {
      setError('Adicione ao menos um item com quantidade maior que zero.')
      return
    }
    const totalDraft = calculatePurchaseDraftTotal(csvItems)
    downloadCsv(
      `${activeCompany?.name ?? 'empresa'}-compras-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        ['Produto', 'Ambiente', 'Quantidade', 'Custo unitário', 'Custo estimado', 'Tipo'],
        ...csvItems.map((item) => [
          item.productName,
          item.environmentName,
          item.quantity,
          item.unitCost,
          calculatePurchaseDraftEstimated(item),
          item.manual ? 'Adicionado manualmente' : 'Sugestão do estoque',
        ]),
        ['Total', '', '', '', totalDraft.hasMissingCost ? 'Custo ausente em itens' : totalDraft.total, ''],
      ],
    )
  }

  const updateDraftQuantity = (key: string, quantity: number) => {
    setDraftItems((current) => current.map((item) =>
      item.key === key ? { ...item, quantity: Math.max(0, quantity) } : item,
    ))
  }

  const updateDraftCost = (key: string, cost: number | null) => {
    setDraftItems((current) => current.map((item) =>
      item.key === key ? { ...item, unitCost: cost } : item,
    ))
  }

  const removeDraftItem = (key: string) => {
    setDraftItems((current) => current.filter((item) => item.key !== key))
  }

  const addManualItem = () => {
    if (!manualName.trim()) {
      setError('Informe o nome do item que deseja adicionar.')
      return
    }
    setDraftItems((current) => [
      ...current,
      {
        key: `manual-${crypto.randomUUID()}`,
        productName: manualName.trim(),
        environmentName: manualEnvironment.trim() || 'Não informado',
        quantity: Math.max(1, manualQuantity),
        unitCost: manualCost,
        manual: true,
      },
    ])
    setManualName('')
    setManualEnvironment('')
    setManualQuantity(1)
    setManualCost(null)
    setError('')
  }

  const downloadPdf = async () => {
    const visibleItems = draftItems.filter((item) => item.quantity > 0)
    if (visibleItems.length === 0) {
      setError('Adicione ao menos um item com quantidade maior que zero.')
      return
    }
    setError('')
    await downloadPurchaseListPdf(
      activeCompany?.name ?? 'Empresa',
      environmentId
        ? environments.find((item) => item.id === environmentId)?.name ?? 'Ambiente'
        : 'Todos',
      visibleItems,
    )
  }

  const downloadBlankPdf = async () => {
    setError('')
    await downloadBlankPurchaseListPdf(
      activeCompany?.name ?? 'Empresa',
      environmentId
        ? environments.find((item) => item.id === environmentId)?.name ?? 'Ambiente'
        : 'Todos',
    )
  }

  return (
    <Container>
      <h1>Lista de compras</h1>
      <ContextHelp
        title="Como é criada a lista de compras?"
        description="A lista compara saldo atual, estoque mínimo e máximo. Ela sugere quanto repor, mas não faz pedidos automaticamente."
        steps={[
          'Selecione todos os ambientes ou um ambiente específico.',
          'Revise as sugestões geradas pelo estoque.',
          'Adicione itens manualmente se necessário.',
          'Edite quantidade e custo antes de gerar o PDF ou CSV.',
        ]}
        result="Você obtém uma lista de reposição imprimível ou editável, sem alterar o estoque."
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      <Card>
        <label>Ambiente
          <select value={environmentId} onChange={(event) => setEnvironmentId(event.target.value)}>
            <option value="">Todos</option>
            {environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <div className="purchase-list-actions">
          <ActionButton className="secondary-button" onAction={exportCsv} disabled={loading} busyLabel="Exportando...">Exportar CSV</ActionButton>
          <ActionButton className="secondary-button" onAction={downloadBlankPdf} disabled={loading} busyLabel="Gerando...">Gerar modelo vazio em PDF</ActionButton>
          <button className="primary-button" type="button" disabled={loading} onClick={() => setPreviewOpen(true)}>Prévia da compra</button>
        </div>
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
      {previewOpen && (
        <div className="purchase-preview-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPreviewOpen(false)
        }}>
          <section className="purchase-preview-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-preview-title">
            <header className="purchase-preview-header">
              <div>
                <small>Prévia editável</small>
                <h2 id="purchase-preview-title">Lista de compras</h2>
                <p>{activeCompany?.name ?? 'Empresa'} • {environmentId ? environments.find((item) => item.id === environmentId)?.name ?? 'Ambiente' : 'Todos os ambientes'}</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => setPreviewOpen(false)}>Fechar</button>
            </header>
            <div className="purchase-preview-body">
              <div className="purchase-preview-section">
                <h3>Itens da lista</h3>
                {draftItems.filter((item) => item.quantity > 0).length === 0 ? (
                  <p className="field-help">Nenhum item com quantidade maior que zero.</p>
                ) : (
                  <div className="purchase-draft-list">
                    {draftItems.map((item) => (
                      <article className="purchase-draft-row" key={item.key}>
                        <div className="purchase-draft-name">
                          <strong>{item.productName}</strong>
                          <span>{item.environmentName}</span>
                        </div>
                        <label>Quantidade
                          <input type="number" min="0" step="1" value={item.quantity} onChange={(event) => updateDraftQuantity(item.key, Number(event.target.value))} />
                        </label>
                        <label>Custo unitário
                          <input type="number" min="0" step="0.01" value={item.unitCost ?? ''} placeholder="Não informado" onChange={(event) => updateDraftCost(item.key, event.target.value === '' ? null : Number(event.target.value))} />
                        </label>
                        <strong className="purchase-draft-estimated">{calculatePurchaseDraftEstimated(item) === null ? '-' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatePurchaseDraftEstimated(item)!)} </strong>
                        <button className="purchase-draft-remove" type="button" onClick={() => removeDraftItem(item.key)} aria-label={`Remover ${item.productName}`}>Remover</button>
                      </article>
                    ))}
                  </div>
                )}
              </div>
              <aside className="purchase-preview-add">
                <h3>Adicionar item</h3>
                <label>Produto
                  <input value={manualName} onChange={(event) => setManualName(event.target.value)} placeholder="Ex.: Gelo 5 kg" />
                </label>
                <label>Ambiente
                  <input value={manualEnvironment} onChange={(event) => setManualEnvironment(event.target.value)} placeholder="Ex.: Bar Principal" />
                </label>
                <div className="purchase-preview-add-grid">
                  <label>Quantidade
                    <input type="number" min="1" step="1" value={manualQuantity} onChange={(event) => setManualQuantity(Math.max(1, Number(event.target.value)))} />
                  </label>
                  <label>Custo unitário
                    <input type="number" min="0" step="0.01" value={manualCost ?? ''} onChange={(event) => setManualCost(event.target.value === '' ? null : Number(event.target.value))} />
                  </label>
                </div>
                <button className="secondary-button" type="button" onClick={addManualItem}>Adicionar à lista</button>
              </aside>
            </div>
            <footer className="purchase-preview-footer">
              <div>
                <span>Total estimado</span>
                <strong>{(() => {
                  const totalInfo = calculatePurchaseDraftTotal(draftItems)
                  return totalInfo.hasMissingCost
                    ? 'Há itens sem custo'
                    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalInfo.total)
                })()}</strong>
              </div>
              <div className="purchase-preview-actions">
                <button className="secondary-button" type="button" onClick={() => setPreviewOpen(false)}>Continuar editando</button>
                <button className="primary-button" type="button" onClick={() => void downloadPdf()}>Gerar PDF</button>
              </div>
            </footer>
          </section>
        </div>
      )}
    </Container>
  )
}
