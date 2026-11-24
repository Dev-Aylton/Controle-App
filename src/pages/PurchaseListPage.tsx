import { useCallback, useEffect, useRef, useState } from 'react'
import { useCompanies } from '../features/company/company-context'
import { useAuth } from '../features/auth/auth-context'
import { Container, Card, ActionButton, ContextHelp, PageGuide } from '../components'
import { tryGetSupabaseClient } from '../lib/supabase'
import { getPurchaseList } from '../features/management/management'
import { downloadCsv } from '../features/management/csv'
import { traduzirErro } from '../lib/errors'
import type { PurchaseDraftItem } from '../features/management/purchaseListDraft'
import {
  calculatePurchaseDraftEstimated,
  calculatePurchaseDraftTotal,
  clearPurchaseDraft,
  loadPurchaseDraft,
  savePurchaseDraft,
  validatePurchaseDraft,
} from '../features/management/purchaseListDraft'
import { downloadBlankPurchaseListPdf, downloadPurchaseListPdf } from '../features/management/purchaseListPdf'
import {
  createPurchaseRequest,
  fulfillPurchaseRequest,
  listPurchaseRequests,
  resolvePurchaseRequest,
  type PurchaseRequest,
} from '../features/management/purchaseRequests'
import { paginatePurchasePlans, planPurchaseRows, type PurchaseProductPlan } from '../features/management/purchasePlanning'
import { useNavigate } from 'react-router-dom'
import { getCheapestSupplierPrice, listSuppliers, listSupplierPrices, saveSupplier, saveSupplierPrice, type Supplier, type SupplierPrice } from '../features/management/suppliers'
import { canReviewPurchase } from '../lib/uiPermissions'
import { formatBrazilianCurrency, formatBrazilianCurrencyInput, parseBrazilianCurrency } from '../features/management/currency'

export function PurchaseListPage() {
  const { activeCompany, role, isAdmin } = useCompanies()
  const { user } = useAuth()
  const userId = user?.id ?? null
  const navigate = useNavigate()
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
  const [manualSupplierName, setManualSupplierName] = useState('')
  const [manualPurchaseUnit, setManualPurchaseUnit] = useState('un')
  const canManage = isAdmin || role === 'owner' || role === 'manager'
  const canReview = canReviewPurchase(role, isAdmin)
  const [requests, setRequests] = useState<PurchaseRequest[]>([])
  const [requestDestinationId, setRequestDestinationId] = useState('')
  const [requestProductId, setRequestProductId] = useState('')
  const [requestQuantity, setRequestQuantity] = useState(1)
  const [requestNote, setRequestNote] = useState('')
  const [requestItems, setRequestItems] = useState<Array<{ product_id: string; quantity: number }>>([])
  const [requestSourceId, setRequestSourceId] = useState('')
  const [requestReviewNote, setRequestReviewNote] = useState('')
  const [requestProducts, setRequestProducts] = useState<Array<{ id: string; name: string; sku: string | null }>>([])
  const [message, setMessage] = useState('')
  const [purchasePlans, setPurchasePlans] = useState<PurchaseProductPlan[]>([])
  const [purchaseSearch, setPurchaseSearch] = useState('')
  const [purchaseMode, setPurchaseMode] = useState<'todos' | 'comprar' | 'transferir'>('todos')
  const [purchaseCategory, setPurchaseCategory] = useState('')
  const [purchaseSupplier, setPurchaseSupplier] = useState('')
  const [purchaseCategories, setPurchaseCategories] = useState<Array<{ id: string; name: string }>>([])
  const [purchaseCategoryByProduct, setPurchaseCategoryByProduct] = useState<Record<string, string>>({})
  const [purchasePage, setPurchasePage] = useState(1)
  const purchasePageSize = 25
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierPrices, setSupplierPrices] = useState<SupplierPrice[]>([])
  const [supplierPanelOpen, setSupplierPanelOpen] = useState(false)
  const [supplierEditingId, setSupplierEditingId] = useState<string | null>(null)
  const [supplierName, setSupplierName] = useState('')
  const [supplierContact, setSupplierContact] = useState('')
  const [supplierPhone, setSupplierPhone] = useState('')
  const [supplierEmail, setSupplierEmail] = useState('')
  const [supplierNotes, setSupplierNotes] = useState('')
  const [priceProductId, setPriceProductId] = useState('')
  const [priceSupplierId, setPriceSupplierId] = useState('')
  const [supplierUnitPrice, setSupplierUnitPrice] = useState<number | null>(null)
  const [purchaseUnit, setPurchaseUnit] = useState('un')
  const [unitsPerPurchase, setUnitsPerPurchase] = useState<number | null>(null)
  const [draftStep, setDraftStep] = useState<1 | 2 | 3>(1)
  const draftHydratedCompany = useRef('')

  const load = useCallback(async () => {
    if (!activeCompany) return
    setLoading(true)
    setError('')
    try {
      const supabase = tryGetSupabaseClient()
      if (!supabase) throw new Error('Supabase não configurado.')
      let nextSuppliers: Supplier[] = []
      let nextSupplierPrices: SupplierPrice[] = []
      const envResult = await supabase.from('environments').select('id,name').eq('company_id', activeCompany.id).eq('active', true)
      if (envResult.error) throw envResult.error
      setEnvironments((envResult.data ?? []).map((item) => ({ id: item.id, name: item.name })))
      if (canManage) {
        nextSuppliers = await listSuppliers(activeCompany.id)
        nextSupplierPrices = await listSupplierPrices(activeCompany.id)
        setSuppliers(nextSuppliers)
        setSupplierPrices(nextSupplierPrices)
        const categoryResult = await supabase
          .from('product_categories')
          .select('id,name')
          .eq('company_id', activeCompany.id)
          .eq('active', true)
          .order('name')
        if (!categoryResult.error) {
          setPurchaseCategories((categoryResult.data ?? []).map((item) => ({ id: item.id, name: item.name })))
        }
        if (requestDestinationId) {
          setSuppliers(nextSuppliers)
        }
      }
      const productResult = await supabase
        .from('products')
        .select('id,name,sku,category_id')
        .eq('company_id', activeCompany.id)
        .eq('active', true)
        .order('name')
      if (productResult.error) throw productResult.error
      setPurchaseCategoryByProduct(Object.fromEntries((productResult.data ?? []).map((item) => [item.id, item.category_id ?? ''])))
      setRequestProducts((productResult.data ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        sku: item.sku,
      })))
      const requestRows = await listPurchaseRequests(activeCompany.id)
      setRequests(requestRows)
      if (!requestDestinationId) {
        setRequestDestinationId(envResult.data?.[0]?.id ?? '')
      }
      if (!canManage) {
        setDraftItems([])
        setLoading(false)
        return
      }
      const nextRows = await getPurchaseList(activeCompany.id, null)
      const plans = planPurchaseRows(nextRows)
      setPurchasePlans(plans)
      setDraftItems((current) => {
        let base = current
        if (draftHydratedCompany.current !== activeCompany.id && userId) {
          base = loadPurchaseDraft(activeCompany.id, userId)
          draftHydratedCompany.current = activeCompany.id
        }
        const preservedManual = base.filter((item) =>
          item.manual || plans.some((plan) => plan.productId === item.key),
        )
        const suggested = plans.filter((plan) => plan.purchaseQuantity > 0).map((plan) => {
          const existing = preservedManual.find((item) => item.key === plan.productId)
          if (existing) return existing
          const cheapest = getCheapestSupplierPrice(nextSupplierPrices, plan.productId)
          const supplier = cheapest ? nextSuppliers.find((item) => item.id === cheapest.supplierId) : null
          return {
            key: plan.productId,
            productId: plan.productId,
            productName: plan.productName,
            environmentName: 'Todos os ambientes',
            quantity: plan.purchaseQuantity,
            unitCost: cheapest?.unitPrice ?? plan.unitCost,
            supplierId: cheapest?.supplierId,
            supplierName: supplier?.name,
            purchaseUnit: cheapest?.purchaseUnit ?? 'un',
            draftAction: 'comprar' as const,
            manual: false,
          }
        })
        return [...preservedManual.filter((item) => item.manual), ...suggested]
      })
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível carregar a lista de compras.'))
    } finally {
      setLoading(false)
    }
  }, [activeCompany, canManage, requestDestinationId, userId])

  useEffect(() => {
    if (activeCompany) queueMicrotask(() => { void load() })
  }, [activeCompany, environmentId, load])

  useEffect(() => {
    if (!activeCompany || !userId) return
    if (draftItems.length > 0) savePurchaseDraft(activeCompany.id, userId, draftItems)
  }, [activeCompany, draftItems, userId])

  const exportCsv = async () => {
    const csvItems = draftItems.filter((item) =>
      item.quantity > 0 && item.draftAction !== 'fora',
    )
    if (csvItems.length === 0) {
      setError('Adicione ao menos um item com quantidade maior que zero.')
      return
    }
    try {
      await persistDraftSupplierData()
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível salvar o fornecedor ou preço informado.'))
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
          item.draftAction === 'transferir'
            ? 'Transferir entre ambientes'
            : item.manual
              ? 'Adicionado manualmente'
              : 'Sugestão do estoque',
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

  const updateDraftSupplier = (key: string, supplierName: string, supplierId?: string) => {
    setDraftItems((current) => current.map((item) =>
      item.key === key
        ? { ...item, supplierName: supplierName.trim() || undefined, supplierId: supplierName.trim() ? supplierId : undefined }
        : item,
    ))
  }

  const updateDraftPurchaseUnit = (key: string, purchaseUnit: string) => {
    setDraftItems((current) => current.map((item) =>
      item.key === key ? { ...item, purchaseUnit } : item,
    ))
  }

  const removeDraftItem = (key: string) => {
    setDraftItems((current) => current.filter((item) => item.key !== key))
  }

  const persistDraftSupplierData = async () => {
    if (!activeCompany) return
    for (const item of draftItems) {
      if (!item.supplierName?.trim()) continue
      let supplierId = item.supplierId
      const existing = suppliers.find((supplier) =>
        supplier.id === supplierId
        || supplier.name.trim().toLowerCase() === item.supplierName?.trim().toLowerCase(),
      )
      if (!existing) {
        supplierId = await saveSupplier(activeCompany.id, null, {
          name: item.supplierName.trim(),
          contactName: null,
          phone: null,
          email: null,
          notes: null,
        })
      } else {
        supplierId = existing.id
      }

      if (item.productId && supplierId && item.unitCost != null) {
        await saveSupplierPrice(
          activeCompany.id,
          item.productId,
          supplierId,
          item.unitCost,
          item.purchaseUnit ?? 'un',
          null,
        )
      }
    }
  }

  const includePlanInDraft = (plan: PurchaseProductPlan) => {
    setDraftItems((current) => {
      const existing = current.find((item) => item.key === plan.productId)
      if (existing) {
        return current.map((item) => item.key === plan.productId
          ? { ...item, quantity: plan.purchaseQuantity, environmentName: 'Todos os ambientes' }
          : item)
      }
      const cheapest = getCheapestSupplierPrice(supplierPrices, plan.productId)
      const supplier = cheapest ? suppliers.find((item) => item.id === cheapest.supplierId) : null
      return [
        ...current,
        {
          key: plan.productId,
          productId: plan.productId,
          productName: plan.productName,
          environmentName: 'Todos os ambientes',
          quantity: plan.purchaseQuantity,
          unitCost: cheapest?.unitPrice ?? plan.unitCost,
          supplierId: cheapest?.supplierId,
          supplierName: supplier?.name,
          purchaseUnit: cheapest?.purchaseUnit ?? 'un',
          draftAction: 'comprar',
          manual: false,
        },
      ]
    })
    setPreviewOpen(true)
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
        supplierName: manualSupplierName.trim() || undefined,
        purchaseUnit: manualPurchaseUnit,
        draftAction: 'comprar',
        manual: true,
      },
    ])
    setManualName('')
    setManualEnvironment('')
    setManualQuantity(1)
    setManualCost(null)
    setManualSupplierName('')
    setManualPurchaseUnit('un')
  }

  const updateDraftAction = (key: string, draftAction: 'comprar' | 'transferir' | 'fora') => {
    setDraftItems((current) => current.map((item) =>
      item.key === key ? { ...item, draftAction } : item,
    ))
  }

  const saveDraft = () => {
    if (!activeCompany || !userId) {
      setError('Entre na sua conta antes de salvar o rascunho.')
      return
    }
    savePurchaseDraft(activeCompany.id, userId, draftItems)
    setMessage('Rascunho da lista salvo neste aparelho.')
  }

  const restoreDraft = () => {
    if (!activeCompany || !userId) return
    const restored = loadPurchaseDraft(activeCompany.id, userId)
    setDraftItems(restored)
    setDraftStep(1)
    setMessage(restored.length ? 'Rascunho restaurado.' : 'Nenhum rascunho salvo foi encontrado.')
  }

  const clearDraft = () => {
    if (!activeCompany || !userId) return
    clearPurchaseDraft(activeCompany.id, userId)
    setDraftItems([])
    setDraftStep(1)
    setMessage('Rascunho removido.')
    setError('')
  }

  const downloadPdf = async () => {
    const visibleItems = draftItems.filter((item) =>
      item.quantity > 0 && item.draftAction !== 'fora',
    )
    if (visibleItems.length === 0) {
      setError('Adicione ao menos um item com quantidade maior que zero.')
      return
    }
    setError('')
    try {
      await persistDraftSupplierData()
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível salvar o fornecedor ou preço informado.'))
      return
    }
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

  const addRequestItem = () => {
    if (!requestProductId) return
    if (requestQuantity <= 0) {
        setError('Informe uma quantidade maior que zero.')
        return
    }
    setRequestItems((current) => {
        const existing = current.find((item) => item.product_id === requestProductId)
        if (existing) {
          return current.map((item) => item.product_id === requestProductId
            ? { ...item, quantity: item.quantity + requestQuantity }
            : item)
        }
        return [...current, { product_id: requestProductId, quantity: requestQuantity }]
    })
    setRequestQuantity(1)
  }

  const submitRequest = async () => {
    if (!activeCompany || !requestDestinationId || requestItems.length === 0) {
        setError('Selecione o ambiente de destino e adicione ao menos um produto.')
        return
    }
    setError('')
    try {
        await createPurchaseRequest(activeCompany.id, requestDestinationId, requestItems, requestNote)
        setRequestItems([])
        setRequestNote('')
        setMessage('Solicitação enviada. Você pode continuar usando o aplicativo normalmente enquanto aguarda a revisão.')
        await load()
    } catch (caught) {
        setError(traduzirErro(caught, 'Não foi possível enviar a solicitação.'))
    }
  }

  const reviewRequest = async (requestId: string, action: 'aprovar' | 'rejeitar') => {
    try {
        await resolvePurchaseRequest(requestId, action, requestReviewNote)
        setRequestReviewNote('')
        setMessage(action === 'aprovar' ? 'Solicitação aprovada.' : 'Solicitação rejeitada.')
        await load()
    } catch (caught) {
        setError(traduzirErro(caught, 'Não foi possível revisar a solicitação.'))
    }
  }

  const resetSupplierEditor = () => {
    setSupplierEditingId(null)
    setSupplierName('')
    setSupplierContact('')
    setSupplierPhone('')
    setSupplierEmail('')
    setSupplierNotes('')
  }

  const submitSupplier = async () => {
    if (!activeCompany || !supplierName.trim()) {
      setError('Informe o nome do fornecedor.')
      return
    }
    try {
      await saveSupplier(activeCompany.id, supplierEditingId, {
        name: supplierName,
        contactName: supplierContact || null,
        phone: supplierPhone || null,
        email: supplierEmail || null,
        notes: supplierNotes || null,
      })
      resetSupplierEditor()
      setSuppliers(await listSuppliers(activeCompany.id))
      setMessage('Fornecedor salvo.')
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível salvar o fornecedor.'))
    }
  }

  const submitSupplierPrice = async () => {
    if (!activeCompany || !priceProductId || !priceSupplierId || supplierUnitPrice == null) {
      setError('Selecione produto e fornecedor e informe o preço pago.')
      return
    }
    try {
      await saveSupplierPrice(
        activeCompany.id,
        priceProductId,
        priceSupplierId,
        supplierUnitPrice,
        purchaseUnit,
        unitsPerPurchase,
      )
      setSupplierUnitPrice(null)
      setUnitsPerPurchase(null)
      setSupplierPrices(await listSupplierPrices(activeCompany.id, priceProductId))
      setMessage('Preço do fornecedor registrado no histórico.')
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível salvar o preço do fornecedor.'))
    }
  }

  const fulfillRequest = async (requestId: string) => {
    if (!requestSourceId) {
        setError('Selecione o ambiente de origem para efetuar a transferência.')
        return
    }
    try {
        await fulfillPurchaseRequest(requestId, requestSourceId, requestReviewNote)
        setRequestReviewNote('')
        setMessage('Solicitação atendida e produtos transferidos.')
        await load()
    } catch (caught) {
        setError(traduzirErro(caught, 'Não foi possível efetuar a transferência da solicitação.'))
    }
  }

  return (
    <Container>
      <h1>Lista de compras</h1>
      <PageGuide
        purpose={canManage ? 'Decidir se falta comprar e se o estoque existente pode ser transferido entre ambientes.' : 'Solicitar reposição de produtos para o ambiente onde você trabalha.'}
        doNext={canManage ? 'Confira saldo total, excedentes e déficits por ambiente antes de incluir uma compra.' : 'Escolha ambiente, produto e quantidade e envie a solicitação para a gestão.'}
        result={canManage ? 'A lista separa compra necessária de transferência interna.' : 'A gestão revisa e pode aprovar, rejeitar ou transferir os itens.'}
        roleNote={canManage ? 'Você pode aprovar solicitações, revisar compras e efetuar transferências.' : 'Você pode criar e acompanhar suas solicitações de reposição.'}
      />
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
      {canManage && (
        <Card>
          <div className="supplier-panel-heading">
            <div>
              <h2>Fornecedores e preços de compra</h2>
              <p className="field-help">Cadastre o fornecedor e registre o preço efetivamente pago. O histórico ajuda a comparar compras e não substitui o custo de estoque configurado no produto.</p>
            </div>
            <button className="secondary-button" type="button" onClick={() => {
              if (supplierPanelOpen) {
                setSupplierPanelOpen(false)
              } else {
                setSupplierPanelOpen(true)
                window.requestAnimationFrame(() => document.getElementById('supplier-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
              }
            }}>
              {supplierPanelOpen ? 'Fechar fornecedores' : 'Gerenciar fornecedores'}
            </button>
          </div>
          {supplierPanelOpen && (
            <div className="supplier-panel">
              <div className="supplier-editor" id="supplier-editor" tabIndex={-1}>
                <h3>{supplierEditingId ? 'Editar fornecedor' : 'Novo fornecedor'}</h3>
                <div className="form-grid">
                  <label>Nome<input value={supplierName} onChange={(event) => setSupplierName(event.target.value)} placeholder="Ex.: Distribuidora Central" /></label>
                  <label>Contato<input value={supplierContact} onChange={(event) => setSupplierContact(event.target.value)} placeholder="Pessoa responsável" /></label>
                  <label>Telefone<input value={supplierPhone} onChange={(event) => setSupplierPhone(event.target.value)} placeholder="(11) 99999-9999" /></label>
                  <label>E-mail<input value={supplierEmail} onChange={(event) => setSupplierEmail(event.target.value)} placeholder="compras@fornecedor.com" /></label>
                </div>
                <label>Observações
                  <input value={supplierNotes} onChange={(event) => setSupplierNotes(event.target.value)} placeholder="Prazo, condições, pedido mínimo..." />
                </label>
                <div className="member-actions">
                  {supplierEditingId && <button className="secondary-button" type="button" onClick={resetSupplierEditor}>Cancelar edição</button>}
                  <ActionButton className="primary-button" busyLabel="Salvando..." disabled={!supplierName.trim()} onAction={submitSupplier}>{supplierEditingId ? 'Salvar fornecedor' : 'Cadastrar fornecedor'}</ActionButton>
                </div>
              </div>
              <div className="supplier-list">
                {suppliers.length === 0 && <p>Nenhum fornecedor cadastrado.</p>}
                {suppliers.map((supplier) => (
                  <article className="member-row" key={supplier.id}>
                    <div><strong>{supplier.name}</strong><span>{supplier.phone || supplier.email || 'Sem contato informado'}</span></div>
                    <button className="secondary-button" type="button" onClick={() => {
                      setSupplierEditingId(supplier.id)
                      setSupplierName(supplier.name)
                      setSupplierContact(supplier.contactName ?? '')
                      setSupplierPhone(supplier.phone ?? '')
                      setSupplierEmail(supplier.email ?? '')
                      setSupplierNotes(supplier.notes ?? '')
                      window.requestAnimationFrame(() => document.getElementById('supplier-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
                    }}>Editar</button>
                  </article>
                ))}
              </div>
              <div className="supplier-price-editor">
                <h3>Registrar preço pago</h3>
                <div className="form-grid">
                  <label>Produto
                    <select value={priceProductId} onChange={(event) => {
                      setPriceProductId(event.target.value)
                      if (event.target.value && activeCompany) void listSupplierPrices(activeCompany.id, event.target.value).then(setSupplierPrices).catch((caught) => setError(traduzirErro(caught)))
                    }}>
                      <option value="">Selecione</option>
                      {requestProducts.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                    </select>
                  </label>
                  <label>Fornecedor
                    <select value={priceSupplierId} onChange={(event) => setPriceSupplierId(event.target.value)}>
                      <option value="">Selecione</option>
                      {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                    </select>
                  </label>
                  <label>Preço pago
                    <input
                      type="text"
                      inputMode="decimal"
                      value={supplierUnitPrice == null ? '' : formatBrazilianCurrencyInput(supplierUnitPrice)}
                      placeholder="R$ 0,00"
                      onChange={(event) => setSupplierUnitPrice(parseBrazilianCurrency(event.target.value))}
                    />
                  </label>
                  <label>Unidade de compra
                    <select value={purchaseUnit} onChange={(event) => setPurchaseUnit(event.target.value)}>
                      <option value="un">Unidade</option>
                      <option value="cx">Caixa</option>
                      <option value="pct">Pacote</option>
                      <option value="kg">Quilograma</option>
                      <option value="l">Litro</option>
                    </select>
                  </label>
                  <label>Unidades por compra
                    <input type="number" min="0.001" step="0.001" value={unitsPerPurchase ?? ''} onChange={(event) => setUnitsPerPurchase(event.target.value === '' ? null : Number(event.target.value))} placeholder="Ex.: 12 unidades por caixa" />
                  </label>
                </div>
                <ActionButton className="primary-button" busyLabel="Registrando..." disabled={!priceProductId || !priceSupplierId || supplierUnitPrice == null} onAction={submitSupplierPrice}>Registrar preço pago</ActionButton>
                {supplierPrices.filter((price) => !priceProductId || price.productId === priceProductId).length > 0 && (
                  <div className="supplier-price-history">
                    <h4>Histórico de preços</h4>
                    {supplierPrices.filter((price) => !priceProductId || price.productId === priceProductId).map((price) => (
                      <div key={price.id}>
                        <span>{suppliers.find((supplier) => supplier.id === price.supplierId)?.name ?? 'Fornecedor'} • {new Date(price.validFrom).toLocaleDateString('pt-BR')}</span>
                        <strong>{formatBrazilianCurrency(price.unitPrice)} / {price.purchaseUnit}{price.unitsPerPurchase ? ` • ${price.unitsPerPurchase} unidades` : ''}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      )}
      <Card>
        <h2>Solicitar reposição para um ambiente</h2>
        <p className="field-help">Use esta opção quando faltar material em seu ambiente. A solicitação não altera o estoque nem interrompe suas outras tarefas; qualquer gerente ou proprietário habilitado pode revisar a solicitação.</p>
        <div className="form-grid">
          <label>Ambiente de destino
            <select value={requestDestinationId} onChange={(event) => setRequestDestinationId(event.target.value)}>
              <option value="">Selecione</option>
              {environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>Produto
            <select value={requestProductId} onChange={(event) => setRequestProductId(event.target.value)}>
              <option value="">Selecione</option>
              {requestProducts.map((item) => <option key={item.id} value={item.id}>{item.name}{item.sku ? ` • ${item.sku}` : ''}</option>)}
            </select>
          </label>
          <label>Quantidade
            <input type="number" min="0.001" step="0.001" value={requestQuantity} onChange={(event) => setRequestQuantity(Number(event.target.value))} />
          </label>
        </div>
        <button className="secondary-button" type="button" disabled={!requestProductId} onClick={addRequestItem}>Adicionar à solicitação</button>
        {requestItems.length > 0 && (
          <div className="member-list">
            {requestItems.map((item) => {
              const product = requestProducts.find((row) => row.id === item.product_id)
              return (
                <article className="member-row" key={item.product_id}>
                  <div><strong>{product?.name ?? item.product_id}</strong><span>Quantidade solicitada: {item.quantity}</span></div>
                  <button className="secondary-button" type="button" onClick={() => setRequestItems((current) => current.filter((row) => row.product_id !== item.product_id))}>Remover</button>
                </article>
              )
            })}
          </div>
        )}
        <label>Observação
          <input value={requestNote} onChange={(event) => setRequestNote(event.target.value)} placeholder="Ex.: preparar o bar para o turno da noite" />
        </label>
        <ActionButton className="primary-button" busyLabel="Enviando..." disabled={!requestDestinationId || requestItems.length === 0} onAction={submitRequest}>Enviar solicitação</ActionButton>
      </Card>
      <Card>
        <h2>Solicitações de reposição</h2>
        {requests.length === 0 && <p>Nenhuma solicitação registrada.</p>}
        <div className="member-list">
          {requests.map((request) => (
            <article className="member-row" key={request.id}>
              <div>
                <strong>{request.destination_environment_name}</strong>
                <span>{new Date(request.created_at).toLocaleString('pt-BR')} • {request.status}</span>
                <small>{request.items.map((item) => `${item.product_name}: ${item.quantity}`).join(' • ')}</small>
                {request.note && <small>Observação: {request.note}</small>}
                {request.review_note && <small>Resposta da gestão: {request.review_note}</small>}
              </div>
              {canReview && request.status === 'pendente' && (
                <div className="purchase-request-actions">
                  <input value={requestReviewNote} onChange={(event) => setRequestReviewNote(event.target.value)} placeholder="Observação da revisão" />
                  <button className="secondary-button" type="button" onClick={() => void reviewRequest(request.id, 'rejeitar')}>Rejeitar</button>
                  <ActionButton className="primary-button" busyLabel="Aprovando..." onAction={() => reviewRequest(request.id, 'aprovar')}>Aprovar</ActionButton>
                </div>
              )}
              {canReview && request.status === 'aprovada' && (
                <div className="purchase-request-actions">
                  <select value={requestSourceId} onChange={(event) => setRequestSourceId(event.target.value)}>
                    <option value="">Ambiente de origem</option>
                    {environments.filter((item) => item.id !== request.destination_environment_id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <input value={requestReviewNote} onChange={(event) => setRequestReviewNote(event.target.value)} placeholder="Observação da transferência" />
                  <ActionButton className="primary-button" busyLabel="Transferindo..." disabled={!requestSourceId} onAction={() => fulfillRequest(request.id)}>Transferir itens</ActionButton>
                </div>
              )}
            </article>
          ))}
        </div>
      </Card>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      {canManage && <Card>
        <label>Ambiente
          <select value={environmentId} onChange={(event) => { setEnvironmentId(event.target.value); setPurchasePage(1) }}>
            <option value="">Todos</option>
            {environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <div className="purchase-list-actions">
          <button className="secondary-button" type="button" onClick={saveDraft}>Salvar rascunho</button>
          <button className="secondary-button" type="button" onClick={restoreDraft}>Restaurar rascunho</button>
          <button className="secondary-button" type="button" onClick={clearDraft}>Limpar rascunho</button>
          <ActionButton className="secondary-button" onAction={exportCsv} disabled={loading} busyLabel="Exportando...">Exportar CSV</ActionButton>
          <ActionButton className="secondary-button" onAction={downloadBlankPdf} disabled={loading} busyLabel="Gerando...">Gerar modelo vazio em PDF</ActionButton>
          <button className="primary-button" type="button" disabled={loading} onClick={() => setPreviewOpen(true)}>Prévia da compra</button>
        </div>
      </Card>}
      {canManage && loading && <p className="page-state">Carregando lista de compras...</p>}
      {canManage && !loading && (
        <Card>
          <div className="purchase-plan-toolbar">
            <label>Buscar produto
              <input value={purchaseSearch} onChange={(event) => { setPurchaseSearch(event.target.value); setPurchasePage(1) }} placeholder="Nome ou SKU" />
            </label>
            <label>Necessidade
              <select value={purchaseMode} onChange={(event) => { setPurchaseMode(event.target.value as typeof purchaseMode); setPurchasePage(1) }}>
                <option value="todos">Todos</option>
                <option value="comprar">Comprar do fornecedor</option>
                <option value="transferir">Transferir entre ambientes</option>
              </select>
            </label>
            <label>Categoria
              <select value={purchaseCategory} onChange={(event) => { setPurchaseCategory(event.target.value); setPurchasePage(1) }}>
                <option value="">Todas</option>
                {purchaseCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label>Fornecedor
              <select value={purchaseSupplier} onChange={(event) => { setPurchaseSupplier(event.target.value); setPurchasePage(1) }}>
                <option value="">Todos</option>
                {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </label>
          </div>
          {(() => {
            const visiblePlans = purchasePlans.filter((plan) => {
              const matchesText = `${plan.productName}`.toLowerCase().includes(purchaseSearch.trim().toLowerCase())
              const matchesEnvironment = !environmentId || plan.environments.some((environment) => environment.id === environmentId)
              const matchesCategory = !purchaseCategory || purchaseCategoryByProduct[plan.productId] === purchaseCategory
              const draftSupplier = draftItems.find((item) => item.productId === plan.productId || item.key === plan.productId)
              const cheapestSupplier = getCheapestSupplierPrice(supplierPrices, plan.productId)
              const matchesSupplier = !purchaseSupplier
                || draftSupplier?.supplierId === purchaseSupplier
                || cheapestSupplier?.supplierId === purchaseSupplier
              const matchesMode = purchaseMode === 'todos'
                || (purchaseMode === 'comprar' && plan.purchaseQuantity > 0)
                || (purchaseMode === 'transferir' && plan.transferable > 0)
              return matchesText && matchesEnvironment && matchesCategory && matchesSupplier && matchesMode
            })
            const purchasePageData = paginatePurchasePlans(visiblePlans, purchasePage, purchasePageSize)
            const purchasePageCount = purchasePageData.pageCount
            const pagedPlans = purchasePageData.items
            return pagedPlans.length === 0
              ? <p>Nenhum produto atende aos filtros selecionados.</p>
              : <>
                <div className="purchase-plan-list">
                {pagedPlans.map((plan) => {
                  const totalEstimated = plan.unitCost == null ? null : plan.purchaseQuantity * plan.unitCost
                  const environmentRows = environmentId
                    ? plan.environments.filter((environment) => environment.id === environmentId)
                    : plan.environments
                  return (
                    <article className="purchase-plan-card" key={plan.productId}>
                      <header>
                        <div>
                          <h2>{plan.productName}</h2>
                          <p>Saldo total na empresa: <strong>{new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(plan.companyBalance)}</strong></p>
                        </div>
                        <div className="purchase-plan-actions">
                          {plan.transferable > 0 && (
                            <button className="secondary-button" type="button" onClick={() => navigate('/movimentacoes')}>Transferir</button>
                          )}
                          {plan.purchaseQuantity > 0 && (
                            <button className="primary-button" type="button" onClick={() => includePlanInDraft(plan)}>Incluir na compra</button>
                          )}
                        </div>
                      </header>
                      <div className="purchase-plan-metrics">
                        <div><small>Necessidade total</small><strong>{new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(plan.totalNeed)}</strong></div>
                        <div><small>Disponível para transferir</small><strong>{new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(plan.transferable)}</strong></div>
                        <div><small>Sugerido comprar</small><strong>{new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(plan.purchaseQuantity)}</strong></div>
                        <div><small>{plan.perishable ? 'Compra recomendada em lotes menores' : 'Quantidade de reposição'}</small><strong>{new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(plan.recommendedOrderQuantity)}</strong></div>
                        <div><small>Custo estimado</small><strong>{totalEstimated == null ? 'Sem custo' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalEstimated)}</strong></div>
                      </div>
                      <div className="purchase-plan-environments">
                        {environmentRows.map((environment) => (
                          <div key={environment.id}>
                            <span>{environment.name}</span>
                            <strong>{new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(environment.balance)} disponível</strong>
                            <small>Mín. {environment.minStock} • Máx. {environment.maxStock ?? '-'}</small>
                            {environment.need > 0
                              ? <em>Falta {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(environment.need)}</em>
                              : environment.surplus > 0
                                ? <em>Tem {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(environment.surplus)} excedente</em>
                                : <em>Dentro do nível definido</em>}
                          </div>
                        ))}
                      </div>
                    </article>
                  )
                })}
              </div>
                {visiblePlans.length > purchasePageSize && (
                  <div className="pagination-controls">
                    <button type="button" className="secondary-button" disabled={purchasePage <= 1} onClick={() => setPurchasePage((page) => Math.max(1, page - 1))}>Anterior</button>
                    <span>Página {purchasePage} de {purchasePageCount}</span>
                    <button type="button" className="secondary-button" disabled={purchasePage >= purchasePageCount} onClick={() => setPurchasePage((page) => Math.min(purchasePageCount, page + 1))}>Próxima</button>
                  </div>
                )}
              </>
          })()}
        </Card>
      )}
      {canManage && previewOpen && (
        <div className="purchase-preview-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setPreviewOpen(false)
        }}>
          <section className="purchase-preview-modal" role="dialog" aria-modal="true" aria-labelledby="purchase-preview-title">
            <header className="purchase-preview-header">
              <div>
                <small>Prévia editável • Etapa {draftStep} de 3</small>
                <h2 id="purchase-preview-title">Lista de compras</h2>
                <p>{activeCompany?.name ?? 'Empresa'} • {environmentId ? environments.find((item) => item.id === environmentId)?.name ?? 'Ambiente' : 'Todos os ambientes'}</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => setPreviewOpen(false)}>Fechar</button>
            </header>
            <nav className="purchase-stepper" aria-label="Etapas da lista de compras">
              <button type="button" className={draftStep === 1 ? 'active' : ''} onClick={() => setDraftStep(1)}>1. Itens</button>
              <button type="button" className={draftStep === 2 ? 'active' : ''} onClick={() => setDraftStep(2)}>2. Ambiente e ação</button>
              <button type="button" className={draftStep === 3 ? 'active' : ''} onClick={() => setDraftStep(3)}>3. Confirmar</button>
            </nav>
            <div className="purchase-preview-body">
              {draftStep === 1 && (
              <>
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
                          <input
                            type="text"
                            inputMode="decimal"
                            value={item.unitCost == null ? '' : formatBrazilianCurrencyInput(item.unitCost)}
                            placeholder="R$ 0,00"
                            onChange={(event) => updateDraftCost(item.key, parseBrazilianCurrency(event.target.value))}
                          />
                        </label>
                        <label>Fornecedor
                          <input
                            list={`suppliers-${item.key}`}
                            value={item.supplierName ?? ''}
                            placeholder="Digite ou escolha"
                            onChange={(event) => {
                              const supplier = suppliers.find((row) => row.name.toLowerCase() === event.target.value.trim().toLowerCase())
                              updateDraftSupplier(item.key, event.target.value, supplier?.id)
                            }}
                          />
                          <datalist id={`suppliers-${item.key}`}>
                            {suppliers.map((supplier) => <option key={supplier.id} value={supplier.name} />)}
                          </datalist>
                        </label>
                        <label>Unidade
                          <select value={item.purchaseUnit ?? 'un'} onChange={(event) => updateDraftPurchaseUnit(item.key, event.target.value)}>
                            <option value="un">Unidade</option>
                            <option value="cx">Caixa</option>
                            <option value="pct">Pacote</option>
                            <option value="kg">Quilograma</option>
                            <option value="l">Litro</option>
                          </select>
                        </label>
                        <label>Ação
                          <select value={item.draftAction ?? 'comprar'} onChange={(event) => updateDraftAction(item.key, event.target.value as 'comprar' | 'transferir' | 'fora')}>
                            <option value="comprar">Comprar do fornecedor</option>
                            <option value="transferir">Transferir entre ambientes</option>
                            <option value="fora">Ficar fora da lista</option>
                          </select>
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
                    <input
                      type="text"
                      inputMode="decimal"
                      value={manualCost == null ? '' : formatBrazilianCurrencyInput(manualCost)}
                      placeholder="R$ 0,00"
                      onChange={(event) => setManualCost(parseBrazilianCurrency(event.target.value))}
                    />
                  </label>
                  <label>Fornecedor
                    <input list="purchase-manual-suppliers" value={manualSupplierName} onChange={(event) => setManualSupplierName(event.target.value)} placeholder="Digite ou escolha" />
                    <datalist id="purchase-manual-suppliers">
                      {suppliers.map((supplier) => <option key={supplier.id} value={supplier.name} />)}
                    </datalist>
                  </label>
                  <label>Unidade
                    <select value={manualPurchaseUnit} onChange={(event) => setManualPurchaseUnit(event.target.value)}>
                      <option value="un">Unidade</option>
                      <option value="cx">Caixa</option>
                      <option value="pct">Pacote</option>
                      <option value="kg">Quilograma</option>
                      <option value="l">Litro</option>
                    </select>
                  </label>
                </div>
                <button className="secondary-button" type="button" onClick={addManualItem}>Adicionar à lista</button>
              </aside>
              </>
              )}
              {draftStep === 2 && (
                <div className="purchase-preview-section">
                  <h3>Ambiente e forma de atendimento</h3>
                  <p className="field-help">Confira se cada item será comprado ou transferido. Itens marcados como fora da lista não entram no PDF nem no CSV.</p>
                  <div className="purchase-draft-list">
                    {draftItems.map((item) => (
                      <article className="purchase-draft-row" key={`step2-${item.key}`}>
                        <div className="purchase-draft-name"><strong>{item.productName}</strong><span>Quantidade {item.quantity}</span></div>
                        <label>Ambiente
                          <input value={item.environmentName} onChange={(event) => setDraftItems((current) => current.map((row) =>
                            row.key === item.key ? { ...row, environmentName: event.target.value } : row,
                          ))} />
                        </label>
                        <label>Ação
                          <select value={item.draftAction ?? 'comprar'} onChange={(event) => updateDraftAction(item.key, event.target.value as 'comprar' | 'transferir' | 'fora')}>
                            <option value="comprar">Comprar</option>
                            <option value="transferir">Transferir</option>
                            <option value="fora">Fora da lista</option>
                          </select>
                        </label>
                      </article>
                    ))}
                  </div>
                </div>
              )}
              {draftStep === 3 && (
                <div className="purchase-preview-section">
                  <h3>Confirmar lista final</h3>
                  {(() => {
                    const validation = validatePurchaseDraft(draftItems)
                    return validation.valid ? (
                      <>
                        <p className="field-help">Revise o total e confirme. Os itens marcados como fora da lista não serão incluídos.</p>
                        <div className="purchase-draft-list">
                          {draftItems.filter((item) => item.quantity > 0 && item.draftAction !== 'fora').map((item) => (
                            <article className="purchase-draft-row" key={`step3-${item.key}`}>
                              <div className="purchase-draft-name"><strong>{item.productName}</strong><span>{item.environmentName}</span></div>
                              <div><small>Quantidade</small><strong>{item.quantity}</strong></div>
                              <div><small>Ação</small><strong>{item.draftAction === 'transferir' ? 'Transferir' : 'Comprar'}</strong></div>
                              <div><small>Fornecedor</small><strong>{item.supplierName || 'Não informado'}</strong></div>
                              <strong>{calculatePurchaseDraftEstimated(item) === null ? '-' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculatePurchaseDraftEstimated(item)!)}</strong>
                            </article>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="form-error">{validation.message}</p>
                    )
                  })()}
                </div>
              )}
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
                {draftStep > 1 && (
                  <button className="secondary-button" type="button" onClick={() => setDraftStep((draftStep - 1) as 1 | 2)}>Voltar</button>
                )}
                {draftStep < 3 ? (
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => {
                      const validation = validatePurchaseDraft(draftItems)
                      if (!validation.valid) {
                        setError(validation.message ?? 'Corrija os itens da lista antes de continuar.')
                        return
                      }
                      setError('')
                      setDraftStep((draftStep + 1) as 2 | 3)
                    }}
                  >
                    Próxima etapa
                  </button>
                ) : (
                  <button
                    className="primary-button"
                    type="button"
                    disabled={!validatePurchaseDraft(draftItems).valid}
                    onClick={() => void downloadPdf()}
                  >
                    Confirmar e gerar PDF
                  </button>
                )}
              </div>
            </footer>
          </section>
        </div>
      )}
    </Container>
  )
}
