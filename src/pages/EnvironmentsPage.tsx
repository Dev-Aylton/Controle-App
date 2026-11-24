import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useCompanies } from '../features/company/company-context'
import { listEnvironments, saveEnvironment } from '../features/environments/environmentService'
import { canManageCompany } from '../lib/uiPermissions'
import { Container, Card, ActionButton, PageGuide } from '../components'
import { traduzirErro } from '../lib/errors'
import { getStockBalance } from '../services/movements'
import { tryGetSupabaseClient } from '../lib/supabase'
import { listProductEnvironmentPricing } from '../features/sales/salesService'
import { formatBRL } from '../features/products/import/formatCurrency'
import { useNavigate } from 'react-router-dom'

type EnvironmentDetail = {
  productId: string
  productName: string
  sku: string | null
  categoryName: string
  unit: string
  balance: number
  unitCost: number | null
  unitPrice: number | null
  dosePrice: number | null
  stockValue: number | null
}

export function EnvironmentsPage() {
  const { activeCompany, role, isAdmin } = useCompanies()
  const navigate = useNavigate()
  const activeCompanyId = activeCompany?.id
  const canManage = canManageCompany(role, isAdmin)
  const [items, setItems] = useState<Array<{ id: string; name: string; description: string | null; active: boolean }>>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingActive, setEditingActive] = useState(true)
  const [detailsOpen, setDetailsOpen] = useState<string | null>(null)
  const [detailsLoading, setDetailsLoading] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, EnvironmentDetail[]>>({})

  const load = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      setItems(await listEnvironments(activeCompanyId))
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível carregar ambientes.'))
    }
  }, [activeCompanyId])

  useEffect(() => {
    if (activeCompanyId) queueMicrotask(() => { void load() })
  }, [activeCompanyId, load])

  const save = async (event: FormEvent) => {
    event.preventDefault()
    if (!activeCompany || !name.trim()) return
    try {
      await saveEnvironment(activeCompany.id, editingId, name, description, editingActive)
      setName('')
      setDescription('')
      setEditingId(null)
      setEditingActive(true)
      setEditorOpen(false)
      await load()
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível salvar o ambiente. Confira o nome e tente novamente.'))
    }
  }

    const edit = (item: { id: string; name: string; description: string | null; active: boolean }) => {
      setEditingId(item.id)
      setName(item.name)
      setDescription(item.description ?? '')
      setEditingActive(item.active)
      setEditorOpen(true)
      window.requestAnimationFrame(() => document.getElementById('environment-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }

    const resetEditor = () => {
      setEditingId(null)
      setName('')
      setDescription('')
      setEditingActive(true)
      setEditorOpen(false)
    }

    const toggleStatus = async (itemId: string) => {
      if (!activeCompany) return
      try {
        await saveEnvironment(activeCompany.id, itemId, name, description, !editingActive)
        setEditingActive((current) => !current)
        await load()
      } catch (caught) {
        setError(traduzirErro(caught, 'Não foi possível alterar o status do ambiente.'))
      }
    }

    const openDetails = async (itemId: string) => {
      if (detailsOpen === itemId) {
        setDetailsOpen(null)
        return
      }
      setDetailsOpen(itemId)
      if (!activeCompany || details[itemId]) return
      setDetailsLoading(itemId)
      setError('')
      try {
        const supabase = tryGetSupabaseClient()
        if (!supabase) throw new Error('Supabase não configurado.')
        const [balances, productsResult, categoriesResult, pricingResult] = await Promise.all([
          getStockBalance(activeCompany.id, itemId),
          supabase.from('products').select('id,name,sku,unit,category_id,active').eq('company_id', activeCompany.id).eq('active', true).order('name'),
          supabase.from('product_categories').select('id,name').eq('company_id', activeCompany.id).order('name'),
          canManage ? listProductEnvironmentPricing(activeCompany.id, itemId).catch(() => []) : Promise.resolve([]),
        ])
        if (productsResult.error) throw productsResult.error
        if (categoriesResult.error) throw categoriesResult.error
        const balanceMap = new Map(balances.map((row) => [row.product_id, Number(row.balance)]))
        const categoryMap = new Map((categoriesResult.data ?? []).map((category) => [category.id, category.name]))
        const pricingMap = new Map(pricingResult.map((pricing) => [pricing.product_id, pricing]))
        const nextDetails = (productsResult.data ?? []).map((product) => {
          const balance = balanceMap.get(product.id) ?? 0
          const pricing = pricingMap.get(product.id)
          const effectiveCost = pricing?.unit_cost ?? pricing?.base_unit_cost ?? null
          return {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            categoryName: categoryMap.get(product.category_id) ?? 'Sem categoria',
            unit: product.unit,
            balance,
            unitCost: effectiveCost,
            unitPrice: pricing?.unit_price ?? null,
            dosePrice: pricing?.dose_price ?? null,
            stockValue: effectiveCost == null ? null : Number((balance * effectiveCost).toFixed(2)),
          }
        }).sort((left, right) => left.productName.localeCompare(right.productName, 'pt-BR'))
        setDetails((current) => ({ ...current, [itemId]: nextDetails }))
      } catch (caught) {
        setDetailsOpen(null)
        setError(traduzirErro(caught, 'Não foi possível carregar os produtos deste ambiente.'))
      } finally {
        setDetailsLoading(null)
      }
    }

  return (
    <Container>
      <div className="environment-page-header">
        <div>
          <h1>Ambientes</h1>
          <p>Locais físicos, saldos, produtos e ações operacionais da empresa.</p>
        </div>
        {canManage && <button className="primary-button" type="button" onClick={() => {
          resetEditor()
          setEditorOpen(true)
          window.requestAnimationFrame(() => document.getElementById('environment-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
        }}>Novo ambiente</button>}
      </div>
      <PageGuide
        purpose="Representar os locais físicos que guardam, usam ou vendem estoque."
        doNext="Escolha um ambiente para conferir produtos e saldos ou use Novo ambiente para criar outro local."
        result="Você entende onde está cada quantidade, quem pode operar o local e qual é seu valor estimado."
        roleNote={canManage ? 'Você pode cadastrar, editar e inativar ambientes.' : 'Você pode consultar ambientes e saldos, mas não alterar o cadastro.'}
      />
      {!canManage && (
        <Card><p><strong>Consulta operacional:</strong> confira ambientes, produtos e saldos. O cadastro e o status só podem ser alterados por proprietário, gerente ou administrador.</p></Card>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      {canManage && editorOpen && (
        <Card><section id="environment-editor" tabIndex={-1}>
          <div className="environment-editor-heading">
            <h2>{editingId ? 'Editar ambiente' : 'Novo ambiente'}</h2>
            <button className="secondary-button" type="button" onClick={resetEditor}>Fechar</button>
          </div>
          <form className="form-stack environment-editor-form" onSubmit={(event) => event.preventDefault()}>
            <label>Nome<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Ambiente de destino" required /></label>
            <label>Descrição<input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Opcional: estoque de saída direta" /></label>
            {editingId && (
              <section className="environment-status-control" aria-label="Status do ambiente">
                <div>
                  <strong>{editingActive ? 'Ambiente ativo' : 'Ambiente inativo'}</strong>
                  <p>{editingActive
                    ? 'Inativar impede novos lançamentos e contagens neste ambiente. O histórico e os saldos anteriores continuam disponíveis.'
                    : 'Reativar permite novos lançamentos e contagens neste ambiente.'}</p>
                </div>
                <ActionButton
                  className={editingActive ? 'danger-button' : 'secondary-button'}
                  busyLabel="Alterando..."
                  confirmMessage={editingActive
                    ? `Inativar "${name.trim()}"? O ambiente continuará consultável no histórico, mas não poderá receber novos lançamentos.`
                    : `Reativar "${name.trim()}"? O ambiente voltará a aceitar lançamentos e contagens.`}
                  onAction={() => toggleStatus(editingId)}
                >
                  {editingActive ? 'Inativar ambiente' : 'Reativar ambiente'}
                </ActionButton>
              </section>
            )}
            <ActionButton
              className="primary-button"
              busyLabel="Salvando..."
              confirmMessage={editingId ? 'Confirmar a alteração deste ambiente?' : `Criar o ambiente "${name.trim()}"?`}
              onAction={() => save({ preventDefault: () => undefined } as FormEvent)}
            >
              {editingId ? 'Salvar ambiente' : 'Criar ambiente'}
            </ActionButton>
          </form>
        </section></Card>
      )}
      <Card>
        {items.length === 0 && <p>Nenhum ambiente cadastrado ainda. Crie o primeiro ambiente.</p>}
        <div className="environment-list">
          {items.map((item) => (
            <article className={`environment-card${item.active ? '' : ' is-inactive'}`} key={item.id}>
              <header>
                <div>
                  <h2>{item.name}</h2>
                  <p>{item.description || 'Sem descrição cadastrada.'}</p>
                </div>
                <div className="environment-card-actions">
                  <span className={`environment-status ${item.active ? 'active' : 'inactive'}`}>{item.active ? 'Ativo' : 'Inativo'}</span>
                  {canManage && <button className="secondary-button" type="button" onClick={() => edit(item)}>Editar ambiente</button>}
                </div>
              </header>
              <div className="environment-card-actions">
                <button className="secondary-button" type="button" disabled={detailsLoading === item.id} onClick={() => void openDetails(item.id)}>
                  {detailsLoading === item.id ? 'Carregando...' : detailsOpen === item.id ? 'Fechar produtos e saldos' : 'Ver produtos e saldos'}
                </button>
                <button className="secondary-button" type="button" onClick={() => navigate('/movimentacoes')}>Registrar movimentação</button>
                <button className="secondary-button" type="button" onClick={() => navigate('/inventario')}>Contar inventário</button>
              </div>
              {detailsOpen === item.id && (
                <section className="environment-details" aria-label={`Produtos e saldos de ${item.name}`}>
                  {!details[item.id] && detailsLoading !== item.id && <p>Nenhuma informação carregada.</p>}
                  {detailsLoading === item.id && <p>Consultando produtos e saldos...</p>}
                  {details[item.id] && (
                    <>
                      <div className="environment-total">
                        <div><small>Produtos ativos</small><strong>{details[item.id].length}</strong></div>
                        <div><small>Valor estimado</small><strong>{details[item.id].every((row) => row.stockValue !== null)
                          ? formatBRL(details[item.id].reduce((sum, row) => sum + (row.stockValue ?? 0), 0))
                          : 'Custo não definido'}</strong></div>
                      </div>
                      <div className="environment-product-list">
                        {details[item.id].map((row) => (
                          <article key={row.productId}>
                            <div>
                              <strong>{row.productName}</strong>
                              <span>{row.sku || 'Sem código'} • {row.categoryName} • {row.unit}</span>
                            </div>
                            <div>
                              <strong>{new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(row.balance)} disponível</strong>
                              {canManage && (
                                <small>
                                  {row.stockValue == null ? 'Valor: custo não definido' : `Valor: ${formatBRL(row.stockValue)}`}
                                  {row.unitPrice != null ? ` • Venda: ${formatBRL(row.unitPrice)}` : ''}
                                  {row.dosePrice != null ? ` • Dose: ${formatBRL(row.dosePrice)}` : ''}
                                </small>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    </>
                  )}
                </section>
              )}
            </article>
          ))}
        </div>
      </Card>
    </Container>
  )
}
