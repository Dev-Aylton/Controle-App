import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useCompanies } from '../features/company/company-context'
import { listPagedProductData, listProductCategories, saveCategory, saveProduct, updateCategory } from '../features/products/productService'
import { tryGetSupabaseClient } from '../lib/supabase'
import { friendlySupabaseError } from '../lib/errors'
import { canCreateProduct, canManageCompany } from '../lib/uiPermissions'
import { formatBRL } from '../features/products/import/formatCurrency'
import { Container, Card, PhotoPicker, Avatar, ActionButton, PageGuide } from '../components'
import { useNavigate } from 'react-router-dom'
import type { Tables } from '../lib/database.types'
import { validateStockRange } from '../features/management/rules'
import { analyzeReplenishmentPattern, getStockSuggestions, type StockSuggestion } from '../features/management/stockSuggestions'
import { traduzirErro } from '../lib/errors'
import { searchProductCatalog, type ProductCatalogSuggestion } from '../features/products/productCatalog'
import { getStockBalance } from '../services/movements'
import { listProductEnvironmentPricing } from '../features/sales/salesService'
import { formatBrazilianCurrencyInput, parseBrazilianCurrency } from '../features/management/currency'

type Product = Tables<'products'>
type Category = Tables<'product_categories'>
type ProductCost = Tables<'product_costs'>
type ProductStockDetail = {
  total: number
  baseUnitCost: number | null
  totalStockValue: number | null
  environments: Array<{ id: string; name: string; balance: number; unitCost: number | null; unitPrice: number | null; dosePrice: number | null; stockValue: number | null }>
  movements: Array<{ id: string; type: string; quantity: number; signedQuantity: number; createdAt: string; environmentName: string; note: string | null }>
}

export function ProductsPage() {
  const { activeCompany, role, isAdmin } = useCompanies()
  const activeCompanyId = activeCompany?.id
  const navigate = useNavigate()
  const canManage = canManageCompany(role, isAdmin)
  const canCreate = canCreateProduct(role, isAdmin)
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [costs, setCosts] = useState<ProductCost[]>([])
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [inlineCategory, setInlineCategory] = useState('')
  const [unit, setUnit] = useState<'un'|'kg'|'g'|'l'|'ml'|'cx'|'pct'|'garrafa'|'lata'|'maço'|'porcao'|'duzia'|'bandeja'|'pacote'|'saco'|'ramo'|'peca'|'fardo'|'frasco'>('un')
  const [minStock, setMinStock] = useState<number | null>(0)
  const [maxStock, setMaxStock] = useState<number | null>(null)
  const [volumeMl, setVolumeMl] = useState<number | null>(null)
  const [doseMl, setDoseMl] = useState<number | null>(null)
  const [weightG, setWeightG] = useState<number | null>(null)
  const [unitCost, setUnitCost] = useState(0)
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([])
  const [suggestionOpen, setSuggestionOpen] = useState(false)
  const [suggestionLoading, setSuggestionLoading] = useState(false)
  const [categoryName, setCategoryName] = useState('')
  const [categoryEditingId, setCategoryEditingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalProducts, setTotalProducts] = useState(0)
  const [loadingList, setLoadingList] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false)
  const [resultsOpen, setResultsOpen] = useState(false)
  const [appliedSearch, setAppliedSearch] = useState('')
  const [appliedCategory, setAppliedCategory] = useState('')
  const [appliedInactive, setAppliedInactive] = useState(false)
  const [stockDetailsOpen, setStockDetailsOpen] = useState<string | null>(null)
  const [stockDetails, setStockDetails] = useState<Record<string, ProductStockDetail>>({})
  const [stockDetailsLoading, setStockDetailsLoading] = useState<string | null>(null)
  const [editingActive, setEditingActive] = useState(true)
  const pageSize = 50

  const catalogSuggestions = name.trim().length >= 2
    ? searchProductCatalog(name)
    : []

  const applyCatalogSuggestion = (suggestion: ProductCatalogSuggestion) => {
    setName(suggestion.name)
    setUnit(suggestion.unit)
    setVolumeMl(suggestion.volumeMl ?? null)
    setDoseMl(suggestion.doseMl ?? null)
    const existingCategory = categories.find((item) =>
      item.name.trim().toLowerCase() === suggestion.category.trim().toLowerCase(),
    )
    if (existingCategory) {
      setCategoryId(existingCategory.id)
      setInlineCategory('')
    } else {
      setCategoryId('')
      setInlineCategory(suggestion.category)
    }
  }

  const loadResults = useCallback(async (
    searchValue = appliedSearch,
    categoryValue = appliedCategory,
    inactiveValue = appliedInactive,
    targetPage = page,
  ) => {
    if (!activeCompanyId) return
    setLoadingList(true)
    try {
      const data = await listPagedProductData({
        companyId: activeCompanyId,
        canManage,
        search: searchValue,
        categoryId: categoryValue,
        showInactive: inactiveValue,
        page: targetPage,
        pageSize,
      })
      setProducts(data.products)
      setCategories(data.categories)
      setCosts(data.costs)
      setTotalProducts(data.total)
      setError(data.categoryError ? `Categorias: ${data.categoryError}` : '')
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível carregar produtos.'))
    } finally {
      setLoadingList(false)
    }
  }, [activeCompanyId, canManage, appliedSearch, appliedCategory, appliedInactive, page])

  const refreshCategories = useCallback(async () => {
    if (!activeCompanyId) return
    await listProductCategories(activeCompanyId)
      .then((items) => {
        setCategories(items)
        setError('')
      })
      .catch((caught) => setError(traduzirErro(caught, 'Não foi possível carregar categorias.')))
  }, [activeCompanyId])

  useEffect(() => {
    if (activeCompanyId) void refreshCategories()
  }, [activeCompanyId, refreshCategories])

  const reset = () => {
    setEditingId(null); setName(''); setSku(''); setCategoryId(''); setInlineCategory('')
    setUnit('un'); setMinStock(0); setMaxStock(null); setUnitCost(0); setPhotoBlob(null); setPhotoPreview(''); setPhotoPath(null)
    setVolumeMl(null); setDoseMl(null); setWeightG(null)
    setEditorOpen(false)
    setEditingActive(true)
  }

  const runSearch = () => {
    setAppliedSearch(search)
    setAppliedCategory(categoryFilter)
    setAppliedInactive(showInactive)
    setPage(1)
    setResultsOpen(true)
    void loadResults(search, categoryFilter, showInactive, 1)
  }

  const clearSearch = () => {
    setSearch('')
    setCategoryFilter('')
    setShowInactive(false)
    setAppliedSearch('')
    setAppliedCategory('')
    setAppliedInactive(false)
    setPage(1)
    setResultsOpen(false)
  }

  const openSuggestions = async () => {
    if (!activeCompanyId) return
    setSuggestionOpen(true)
    setSuggestionLoading(true)
    setError('')
    try {
      const baseSuggestions = await getStockSuggestions(activeCompanyId, null, 90)
      const supabase = tryGetSupabaseClient()
      if (!supabase) throw new Error('Supabase não configurado.')
      const cutoff = new Date(Date.now() - 90 * 86400000).toISOString()
      const productIds = [...new Set(baseSuggestions.map((item) => item.product_id))]
      if (productIds.length === 0) {
        setSuggestions([])
        return
      }
      const movementsResult = await supabase
        .from('stock_movements')
        .select('product_id,environment_id,type,quantity,created_at')
        .eq('company_id', activeCompanyId)
        .in('product_id', productIds)
        .gte('created_at', cutoff)
      if (movementsResult.error) throw movementsResult.error
      const movements = movementsResult.data ?? []
      const enriched = baseSuggestions.map((suggestion) => {
        const category = categories.find((item) => item.id === products.find((product) => product.id === suggestion.product_id)?.category_id)
        const pattern = analyzeReplenishmentPattern(
          suggestion.product_name,
          category?.name ?? '',
          movements
            .filter((item) => item.product_id === suggestion.product_id && item.environment_id === suggestion.environment_id)
            .map((item) => ({
              type: item.type as 'entrada' | 'saida' | 'perda',
              quantity: Number(item.quantity),
              created_at: item.created_at,
            })),
          suggestion.current_min,
          suggestion.current_max,
        )
        return {
          ...suggestion,
          purchase_count: pattern.purchaseCount,
          purchase_interval_days: pattern.purchaseIntervalDays ?? undefined,
          average_purchase_qty: pattern.averagePurchase,
          recommended_action: pattern.action,
          confidence: pattern.confidence,
          reason: pattern.reason,
          perishability: pattern.perishable ? 'perecivel' as const : 'conservavel' as const,
          suggested_min: pattern.action === 'keep' ? suggestion.suggested_min : pattern.suggestedMin,
          suggested_max: pattern.action === 'keep' ? suggestion.suggested_max : pattern.suggestedMax,
        }
      })
      setSuggestions(enriched)
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível calcular sugestões.'))
    } finally {
      setSuggestionLoading(false)
    }
  }

  const acceptSuggestion = async (suggestion: StockSuggestion) => {
    if (!activeCompanyId) return
    const supabase = tryGetSupabaseClient()
    if (!supabase) return
    const result = await supabase.from('products')
      .update({ min_stock: suggestion.suggested_min, max_stock: suggestion.suggested_max })
      .eq('id', suggestion.product_id)
    if (result.error) setError(friendlySupabaseError(result.error))
    else {
      setSuggestions((current) => current.filter((item) => item.product_id !== suggestion.product_id))
      if (resultsOpen) await loadResults()
    }
  }

  const acceptAllSuggestions = async () => {
    for (const suggestion of suggestions) {
      if (suggestion.recommended_action === 'keep') continue
      await acceptSuggestion(suggestion)
    }
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!activeCompany) return
    setError('')
    const cleanSku = sku.trim().toLowerCase()
    if (cleanSku) {
      const skuConflict = products.find((product) =>
        product.id !== editingId
        && product.sku?.trim().toLowerCase() === cleanSku,
      )
      if (skuConflict) {
        setError(`O código/SKU "${sku.trim()}" já pertence ao produto "${skuConflict.name}". Use um código diferente para esta embalagem ou variante.`)
        return
      }
    }
    const variantConflict = products.find((product) =>
      product.id !== editingId
      && product.name.trim().toLowerCase() === name.trim().toLowerCase()
      && product.unit === unit
      && Number(product.volume_ml ?? 0) === Number(volumeMl ?? 0)
      && Number(product.dose_ml ?? 0) === Number(doseMl ?? 0),
    )
    if (variantConflict) {
      setError(`Esta mesma variante já existe: ${variantConflict.name}, ${variantConflict.unit}${variantConflict.volume_ml ? `, ${variantConflict.volume_ml} ml` : ''}. Altere o tamanho, volume ou código para cadastrar uma variante diferente.`)
      return
    }
    const stockValidation = validateStockRange(minStock, maxStock)
    if (stockValidation) {
      setError(stockValidation)
      return
    }
    if ((volumeMl !== null && volumeMl <= 0) || (doseMl !== null && doseMl <= 0)) {
      setError('Volume e dose devem ser maiores que zero.')
      return
    }
    if (doseMl !== null && volumeMl !== null && doseMl > volumeMl) {
      setError('A dose não pode ser maior que o volume da unidade.')
      return
    }
    if (weightG !== null && weightG <= 0) {
      setError('O peso da unidade deve ser maior que zero.')
      return
    }
    try {
      let selectedCategory = categoryId || null
      if (inlineCategory.trim()) {
        const category = await saveCategory(activeCompany.id, inlineCategory)
        selectedCategory = category.id
      }
      let nextPhotoPath = photoPath
      if (photoBlob) {
        const supabase = tryGetSupabaseClient()
        if (!supabase) throw new Error('Supabase não configurado.')
        nextPhotoPath = `companies/${activeCompany.id}/products/${editingId || crypto.randomUUID()}.webp`
        const upload = await supabase.storage.from('company-photos').upload(nextPhotoPath, photoBlob, { upsert: true, contentType: 'image/webp' })
        if (upload.error) throw upload.error
      }
      await saveProduct(activeCompany.id, editingId, {
        name,
        sku: sku || null,
        category_id: selectedCategory,
        unit,
        min_stock: minStock,
        max_stock: maxStock,
        volume_ml: volumeMl,
        dose_ml: doseMl,
        weight_g: weightG,
        photo_path: nextPhotoPath,
        active: editingId ? editingActive : true,
      }, canManage ? unitCost : undefined)
      reset()
      await refreshCategories()
      if (resultsOpen) await loadResults()
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível salvar o produto. Confira os dados e tente novamente.'))
    }
  }

  const edit = (product: Product) => {
    setEditingId(product.id); setName(product.name); setSku(product.sku ?? '')
    setEditorOpen(true)
    setEditingActive(product.active)
    setCategoryId(product.category_id ?? ''); setUnit(product.unit); setMinStock(product.min_stock === null ? null : Number(product.min_stock))
    setMaxStock(product.max_stock === null ? null : Number(product.max_stock))
    setVolumeMl(product.volume_ml === null ? null : Number(product.volume_ml))
    setDoseMl(product.dose_ml === null ? null : Number(product.dose_ml))
    setWeightG(product.weight_g == null ? null : Number(product.weight_g))
    setPhotoPath(product.photo_path); setPhotoPreview('')
    const cost = costs.find((item) => item.product_id === product.id)
    setUnitCost(cost ? Number(cost.unit_cost) : 0)
  }

  const toggleEditingActive = async () => {
    if (!editingId) return
    const supabase = tryGetSupabaseClient()
    if (!supabase) return
    const nextActive = !editingActive
    const { error: actionError } = await supabase
      .from('products')
      .update({ active: nextActive })
      .eq('id', editingId)
    if (actionError) {
      setError(friendlySupabaseError(actionError))
      return
    }
    setEditingActive(nextActive)
    if (resultsOpen) await loadResults()
  }

  const openStockDetails = async (product: Product) => {
    if (stockDetailsOpen === product.id) {
      setStockDetailsOpen(null)
      return
    }
    setStockDetailsOpen(product.id)
    if (stockDetails[product.id]) return
    if (!activeCompanyId) return
    setStockDetailsLoading(product.id)
    setError('')
    try {
      const supabase = tryGetSupabaseClient()
      if (!supabase) throw new Error('Supabase não configurado.')
      const [balances, environmentsResult, movementsResult] = await Promise.all([
        getStockBalance(activeCompanyId),
        supabase.from('environments').select('id,name').eq('company_id', activeCompanyId).eq('active', true).order('name'),
        supabase.from('stock_movements')
          .select('id,type,quantity,signed_quantity,created_at,note,environment_id')
          .eq('company_id', activeCompanyId)
          .eq('product_id', product.id)
          .order('created_at', { ascending: false })
          .limit(8),
      ])
      if (environmentsResult.error) throw environmentsResult.error
      if (movementsResult.error) throw movementsResult.error
      const environmentMap = new Map((environmentsResult.data ?? []).map((item) => [item.id, item.name]))
      const balancesByEnvironment = new Map(
        (balances as Array<{ product_id: string; environment_id: string; balance: number }>)
          .filter((row) => row.product_id === product.id)
          .map((row) => [row.environment_id, Number(row.balance)]),
      )
      const environmentRows = (environmentsResult.data ?? []).map((environment) => ({
        id: environment.id,
        name: environment.name,
        balance: balancesByEnvironment.get(environment.id) ?? 0,
        unitCost: null as number | null,
        unitPrice: null as number | null,
        dosePrice: null as number | null,
        stockValue: null as number | null,
      }))
        .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
      const total = environmentRows.reduce((sum, row) => sum + row.balance, 0)
      const baseUnitCost = costs.find((item) => item.product_id === product.id)
        ? Number(costs.find((item) => item.product_id === product.id)?.unit_cost)
        : null
      if (canManage) {
        await Promise.all(environmentRows.map(async (environmentRow) => {
          try {
            const pricingRows = await listProductEnvironmentPricing(activeCompanyId, environmentRow.id)
            const pricing = pricingRows.find((row) => row.product_id === product.id)
            const effectiveCost = pricing?.unit_cost ?? pricing?.base_unit_cost ?? baseUnitCost
            environmentRow.unitCost = effectiveCost
            environmentRow.unitPrice = pricing?.unit_price ?? null
            environmentRow.dosePrice = pricing?.dose_price ?? null
            environmentRow.stockValue = effectiveCost == null
              ? null
              : Number((environmentRow.balance * effectiveCost).toFixed(2))
          } catch {
            environmentRow.unitCost = baseUnitCost
            environmentRow.stockValue = baseUnitCost == null
              ? null
              : Number((environmentRow.balance * baseUnitCost).toFixed(2))
          }
        }))
      }
      const totalStockValue = environmentRows.every((row) => row.stockValue !== null)
        ? Number(environmentRows.reduce((sum, row) => sum + (row.stockValue ?? 0), 0).toFixed(2))
        : null
      setStockDetails((current) => ({
        ...current,
        [product.id]: {
          total,
          baseUnitCost,
          totalStockValue,
          environments: environmentRows,
          movements: (movementsResult.data ?? []).map((movement) => ({
            id: movement.id,
            type: String(movement.type),
            quantity: Number(movement.quantity),
            signedQuantity: Number(movement.signed_quantity),
            createdAt: movement.created_at,
            environmentName: environmentMap.get(movement.environment_id) ?? 'Ambiente',
            note: movement.note,
          })),
        },
      }))
    } catch (caught) {
      setStockDetailsOpen(null)
      setError(traduzirErro(caught, 'Não foi possível carregar o estoque deste produto.'))
    } finally {
      setStockDetailsLoading(null)
    }
  }

  return (
    <Container>
      <div className="product-page-header">
        <div>
          <h1>Produtos</h1>
          <p>Catálogo da empresa e cadastro mestre para todos os ambientes.</p>
        </div>
        <div className="product-page-actions">
          {canManage && <button className="secondary-button" type="button" onClick={() => navigate('/produtos/importar')}>Importar planilha</button>}
          {canManage && <button className="secondary-button" type="button" onClick={() => setCategoryPanelOpen((current) => !current)}>{categoryPanelOpen ? 'Fechar categorias' : 'Gerenciar categorias'}</button>}
          {canCreate && <button className="primary-button" type="button" onClick={() => { reset(); setEditorOpen(true) }}>Novo produto</button>}
        </div>
      </div>
      <PageGuide
        purpose="Manter o cadastro mestre dos produtos e insumos usados em todos os ambientes."
        doNext="Use pesquisa e categoria para localizar; use Novo produto para cadastrar ou Editar para alterar."
        result="O mesmo produto poderá ser usado em movimentações, inventários, vendas e relatórios."
        roleNote={!canManage ? 'Você pode localizar e cadastrar produtos novos; somente gestão altera ou inativa existentes.' : 'Você pode cadastrar, editar, importar e inativar produtos.'}
      />
      {!canManage && (
        <Card>
          <p><strong>Cadastro operacional:</strong> você pode localizar e cadastrar novos produtos. Produtos existentes só podem ser alterados por proprietário, gerente ou administrador.</p>
        </Card>
      )}
      {canManage && (
        <div className="product-toolbar-actions">
          <ActionButton className="secondary-button" busyLabel="Calculando..." onAction={openSuggestions}>Sugerir mínimo e máximo</ActionButton>
        </div>
      )}
      {suggestionOpen && (
        <Card>
          <h2>Sugestões de estoque</h2>
          {suggestionLoading && <p>Calculando sugestões...</p>}
          {!suggestionLoading && suggestions.length === 0 && <p>Nenhum histórico suficiente para sugerir.</p>}
          {!suggestionLoading && suggestions.length > 0 && (
            <>
              <ActionButton className="primary-button" busyLabel="Aplicando..." onAction={acceptAllSuggestions}>Aceitar todos</ActionButton>
              <div className="member-list">
                {suggestions.map((suggestion) => (
                  <article className="member-row" key={`${suggestion.product_id}-${suggestion.environment_id}`}>
                    <div>
                      <strong>{suggestion.product_name}</strong>
                      <span>
                        {suggestion.environment_name} • atual {suggestion.current_min ?? '-'} / {suggestion.current_max ?? '-'} • sugerido {suggestion.suggested_min} / {suggestion.suggested_max}
                      </span>
                      <small>
                        {suggestion.purchase_count ?? 0} compra(s) registradas
                        {suggestion.purchase_interval_days ? ` • intervalo médio de ${suggestion.purchase_interval_days} dia(s)` : ''}
                        {' • '}
                        {suggestion.perishability === 'perecivel' ? 'Item perecível' : 'Item de boa conservação'}
                        {' • confiança ' + (suggestion.confidence ?? 'baixa')}
                      </small>
                      {suggestion.reason && <p className="field-help">{suggestion.reason}</p>}
                    </div>
                    <div className="member-actions">
                      <ActionButton
                        className="primary-button"
                        busyLabel="Aplicando..."
                        disabled={suggestion.recommended_action === 'keep'}
                        confirmMessage={`Aplicar os níveis sugeridos para "${suggestion.product_name}" no ambiente ${suggestion.environment_name}?`}
                        onAction={() => acceptSuggestion(suggestion)}
                      >
                        {suggestion.recommended_action === 'keep'
                          ? suggestion.perishability === 'perecivel'
                            ? 'Perecível: manter ou revisar'
                            : 'Manter níveis atuais'
                          : 'Aceitar'}
                      </ActionButton>
                      <button className="secondary-button" type="button" onClick={() => setSuggestions((current) => current.filter((item) => item !== suggestion))}>Ignorar</button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </Card>
      )}
      {canManage && categoryPanelOpen && (
        <Card>
          <h2>Categorias</h2>
          <p className="field-help">Categoria organiza produtos com o mesmo propósito: facilita filtros, importação, inventário e relatórios. Use nomes simples e consistentes, como “Refrigerantes”, “Cervejas” ou “Carnes”.</p>
          <div className="form-grid">
            <label>Categoria<input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Ex.: Destilados" /></label>
            <ActionButton
              className="primary-button"
              busyLabel="Salvando..."
              disabled={!categoryName.trim()}
              confirmMessage={categoryEditingId ? `Confirmar a alteração da categoria "${categoryName.trim()}"?` : `Criar a categoria "${categoryName.trim()}"?`}
              onAction={async () => {
                if (categoryEditingId) await updateCategory(categoryEditingId, categoryName)
                else if (activeCompany) await saveCategory(activeCompany.id, categoryName)
                setCategoryName('')
                setCategoryEditingId(null)
                await refreshCategories()
              }}
            >{categoryEditingId ? 'Salvar categoria' : 'Criar categoria'}</ActionButton>
          </div>
          {categories.length === 0 && (
            <p>
              Nenhuma categoria cadastrada. Crie a primeira categoria acima.
              Produtos sem categoria ficam reunidos em “Sem categoria” até serem associados a uma categoria.
            </p>
          )}
          <div className="member-list">
            {categories.map((category) => (
              <article className="member-row" key={category.id}>
                <strong>{category.name}</strong>
                <div className="member-actions">
                  <button className="secondary-button" type="button" onClick={() => { setCategoryEditingId(category.id); setCategoryName(category.name) }}>Editar</button>
                  <ActionButton className="danger-button" busyLabel="Alterando..." confirmMessage={category.active ? 'Desativar esta categoria?' : undefined} onAction={async () => { await updateCategory(category.id, category.name, !category.active); await refreshCategories() }}>
                    {category.active ? 'Desativar' : 'Reativar'}
                  </ActionButton>
                </div>
              </article>
            ))}
          </div>
        </Card>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <Card>
        <div className="product-filter-toolbar">
          <label>Pesquisar
            <input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') runSearch() }} placeholder="Nome, marca, SKU ou tipo" aria-describedby="product-search-help" />
          </label>
          <label>Categoria
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-describedby="product-category-help">
              <option value="">Todas</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className="check-label"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} /> Mostrar inativos</label>
          <button className="primary-button" type="button" onClick={runSearch}>Pesquisar produtos</button>
          {resultsOpen && <button className="secondary-button" type="button" onClick={clearSearch}>Fechar resultados</button>}
        </div>
        <div className="product-filter-help">
          <p id="product-search-help"><strong>Pesquisar:</strong> encontra pelo nome comercial, marca ou código/SKU. Exemplo: “Coca-Cola”, “P001” ou “refrigerante”.</p>
          <p id="product-category-help"><strong>Categoria:</strong> refina a busca pelo tipo de controle. Exemplo: “Softs” reúne refrigerantes, “Cervejas” reúne bebidas desse tipo e “Carnes” reúne insumos relacionados.</p>
        </div>
      </Card>
      {canCreate && editorOpen && (
        <Card>
          <div className="product-editor-heading">
            <h2>{editingId && canManage ? 'Editar produto' : 'Novo produto'}</h2>
            <button className="secondary-button" type="button" onClick={reset}>Fechar</button>
          </div>
          <form className="form-stack product-editor-form" onSubmit={(event) => event.preventDefault()}>
            <label>Nome
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex.: Smirnoff, Heineken ou picanha"
                list="product-catalog-suggestions"
                autoComplete="off"
                required
              />
              <datalist id="product-catalog-suggestions">
                {catalogSuggestions.map((suggestion) => (
                  <option
                    key={`${suggestion.name}-${suggestion.unit}-${suggestion.volumeMl ?? ''}-${suggestion.doseMl ?? ''}`}
                    value={suggestion.name}
                  />
                ))}
              </datalist>
            </label>
            {catalogSuggestions.length > 0 && (
              <div className="product-catalog-suggestions" aria-label="Sugestões inteligentes">
                <span>Sugestões para o nome informado</span>
                <div>
                  {catalogSuggestions.map((suggestion) => (
                    <button
                      className="secondary-button"
                      type="button"
                      key={`${suggestion.name}-${suggestion.unit}-${suggestion.volumeMl ?? ''}-${suggestion.doseMl ?? ''}`}
                      onClick={() => applyCatalogSuggestion(suggestion)}
                    >
                      <strong>{suggestion.name}</strong>
                      <small>{suggestion.category} • {suggestion.unit}{suggestion.volumeMl ? ` • ${suggestion.volumeMl} ml` : ''}</small>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <label>Código/SKU
              <input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="Ex.: VOD-001" aria-describedby="product-sku-help" />
              <span className="field-help" id="product-sku-help">Código próprio para identificar e localizar o produto.</span>
            </label>
            <label>Categoria
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} aria-describedby="product-editor-category-help">
                <option value="">Sem categoria</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <p className="field-help" id="product-editor-category-help">A categoria define como o produto será localizado em filtros e agrupado em inventários e relatórios. Use “Refrigerantes” para Coca-Cola e “Cervejas” para Heineken.</p>
            {canManage && (
              <label>Nova categoria (opcional)
                <input value={inlineCategory} onChange={(event) => setInlineCategory(event.target.value)} placeholder="Ex.: Destilados" aria-describedby="inline-category-help" />
                <span className="field-help" id="inline-category-help">Digite um nome para criar e atribuir uma categoria ao produto ao salvar. Se deixar vazio, será usada a categoria escolhida acima.</span>
              </label>
            )}
            <label>Unidade
              <select value={unit} onChange={(event) => setUnit(event.target.value as typeof unit)}>
                <option value="un">Unidade</option>
                <option value="garrafa">Garrafa</option>
                <option value="lata">Lata</option>
                <option value="maço">Maço</option>
                <option value="porcao">Porção</option>
                <option value="duzia">Dúzia</option>
                <option value="bandeja">Bandeja</option>
                <option value="pacote">Pacote</option>
                <option value="saco">Saco</option>
                <option value="ramo">Ramo</option>
                <option value="peca">Peça</option>
                <option value="fardo">Fardo</option>
                <option value="frasco">Frasco</option>
                <option value="kg">kg</option>
                <option value="g">g</option>
                <option value="l">l</option>
                <option value="ml">ml</option>
                <option value="cx">Caixa</option>
                <option value="pct">Pacote</option>
              </select>
            </label>
            {canManage && (
              <>
                <label>Estoque mínimo
                  <input type="number" min="0" step="0.001" value={minStock ?? ''} onChange={(event) => setMinStock(event.target.value === '' ? null : Number(event.target.value))} placeholder="Ex.: 5" aria-describedby="min-stock-help" />
                  <span className="field-help" id="min-stock-help">Gera um alerta quando o saldo atingir ou ficar abaixo deste valor.</span>
                </label>
                <label>Estoque máximo
                  <input type="number" min="0" step="0.001" value={maxStock ?? ''} onChange={(event) => setMaxStock(event.target.value === '' ? null : Number(event.target.value))} placeholder="Ex.: 12" aria-describedby="max-stock-help" />
                  <span className="field-help" id="max-stock-help">Limite desejado usado como referência para recomendações de estoque.</span>
                </label>
              </>
            )}
            <label>Volume da unidade (ml)
              <input type="number" min="0" step="0.001" value={volumeMl ?? ''} onChange={(event) => setVolumeMl(event.target.value === '' ? null : Number(event.target.value))} placeholder="Ex.: 998" aria-describedby="volume-help" />
              <span className="field-help" id="volume-help">Conteúdo total da embalagem, em mililitros.</span>
            </label>
            <label>Dose (ml)
              <input type="number" min="0" step="0.001" value={doseMl ?? ''} onChange={(event) => setDoseMl(event.target.value === '' ? null : Number(event.target.value))} placeholder="Ex.: 50" aria-describedby="dose-help" />
              <span className="field-help" id="dose-help">Quantidade servida por dose. Informe também o volume para calcular equivalências em doses.</span>
            </label>
            {volumeMl !== null && doseMl !== null && doseMl > 0 && <p>Doses por unidade: {Math.floor(volumeMl / doseMl)}</p>}
            {['kg','g','porcao','duzia','bandeja','pacote','saco','ramo','peca','fardo'].includes(unit) && (
              <label>Peso da unidade (g)
                <input type="number" min="0" step="1" value={weightG ?? ''} onChange={(event) => setWeightG(event.target.value === '' ? null : Number(event.target.value))} placeholder="Ex.: 180" aria-describedby="weight-help" />
                <span className="field-help" id="weight-help">Peso aproximado de uma porção, peça, ramo ou embalagem.</span>
              </label>
            )}
            {canManage && (
              <label>Custo unitário (R$)
                <input
                  type="text"
                  inputMode="decimal"
                  value={formatBrazilianCurrencyInput(unitCost)}
                  onChange={(event) => setUnitCost(parseBrazilianCurrency(event.target.value) ?? 0)}
                  placeholder="R$ 89,90"
                  aria-describedby="unit-cost-help"
                />
                <span className="field-help" id="unit-cost-help">Usado para estimar o valor do estoque e das compras.</span>
              </label>
            )}
            <PhotoPicker shape="square" label="Foto do produto" onConfirm={(blob, previewUrl) => { setPhotoBlob(blob); setPhotoPreview(previewUrl) }} />
            {(photoPreview || photoPath) && <Avatar name={name} uploadedUrl={photoPreview || undefined} storageBucket="company-photos" storagePath={photoPreview ? null : photoPath} shape="square" size={96} companyLogoFallback />}
            {editingId && canManage && (
              <section className="product-status-control" aria-label="Status do produto">
                <div>
                  <strong>{editingActive ? 'Produto ativo' : 'Produto inativo'}</strong>
                  <p>
                    {editingActive
                      ? 'Inativar remove este produto das listas operacionais padrão, como movimentações e novos lançamentos. Ele continua registrado para consulta e pode ser reativado.'
                      : 'Reativar devolve este produto às listas operacionais padrão e permite novos lançamentos em todos os ambientes.'}
                  </p>
                </div>
                <ActionButton
                  className={editingActive ? 'danger-button' : 'secondary-button'}
                  busyLabel="Alterando..."
                  confirmMessage={editingActive
                    ? `Inativar "${name.trim()}"? Este produto deixará de aparecer nas listas operacionais padrão, mas não será excluído.`
                    : `Reativar "${name.trim()}"? Este produto voltará às listas operacionais padrão em todos os ambientes.`}
                  onAction={toggleEditingActive}
                >
                  {editingActive ? 'Inativar produto' : 'Reativar produto'}
                </ActionButton>
              </section>
            )}
            <ActionButton
              className="primary-button"
              busyLabel="Salvando..."
              confirmMessage={editingId ? `Confirmar as alterações do produto "${name.trim()}"?` : `Cadastrar o novo produto "${name.trim()}"?`}
              onAction={() => submit({ preventDefault: () => undefined } as FormEvent)}
            >
              {editingId ? 'Salvar produto' : 'Criar produto'}
            </ActionButton>
          </form>
        </Card>
      )}
      {resultsOpen && <Card>
        <div className="product-list-summary">
          <strong>{loadingList ? 'Carregando...' : `${totalProducts} produto(s) encontrado(s)`}</strong>
          <button className="secondary-button" type="button" onClick={clearSearch}>Limpar pesquisa</button>
        </div>
        {!loadingList && products.length === 0 && <p>Nenhum produto encontrado com estes filtros.</p>}
        <div className="product-management-list">
          {products.map((product) => {
            const cost = costs.find((item) => item.product_id === product.id)
            const category = categories.find((item) => item.id === product.category_id)
            const measurement = product.volume_ml
              ? `${product.volume_ml} ml`
              : product.unit === 'kg' || product.unit === 'g'
                ? product.unit
                : ''
            return (
              <article className={`product-management-row${product.active ? '' : ' is-inactive'}`} key={product.id}>
                <div className="member-identity">
                  <Avatar name={product.name} storageBucket="company-photos" storagePath={product.photo_path} shape="square" size={48} companyLogoFallback />
                  <span>
                    <strong>{product.name}</strong>
                    <small>{product.sku || 'Sem código'} • {category?.name ?? 'Sem categoria'} • {product.unit}{measurement ? ` • ${measurement}` : ''}</small>
                  </span>
                </div>
                <div className="product-management-details">
                  {canManage && cost && <span>Custo base de compra/un. <strong>{formatBRL(Number(cost.unit_cost))}</strong></span>}
                  <span>{product.active ? 'Ativo' : 'Inativo'}</span>
                </div>
                {canManage && (
                  <div className="member-actions">
                    <button className="secondary-button" type="button" onClick={() => { edit(product); window.scrollTo({ top: 0, behavior: 'smooth' }) }}>Editar</button>
                  </div>
                )}
                <div className="member-actions product-stock-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={stockDetailsLoading === product.id}
                    onClick={() => void openStockDetails(product)}
                  >
                    {stockDetailsLoading === product.id
                      ? 'Carregando estoque...'
                      : stockDetailsOpen === product.id
                        ? 'Fechar estoque'
                        : 'Ver estoque'}
                  </button>
                  {stockDetailsOpen === product.id && (
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => navigate('/movimentacoes')}
                    >
                      Movimentar
                    </button>
                  )}
                </div>
                {stockDetailsOpen === product.id && (
                  <section className="product-stock-detail" aria-label={`Estoque de ${product.name}`}>
                    {stockDetailsLoading === product.id && <p>Consultando saldo e últimos lançamentos...</p>}
                    {stockDetails[product.id] && (
                      <>
                        <div className="product-stock-summary">
                          <div>
                            <small>Saldo total na empresa</small>
                            <strong>{new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(stockDetails[product.id].total)} {product.unit}</strong>
                          </div>
                          {canManage && (
                            <>
                              <div>
                                <small>Custo base por unidade</small>
                                <strong>{stockDetails[product.id].baseUnitCost == null ? 'Não cadastrado' : formatBRL(stockDetails[product.id].baseUnitCost ?? 0)}</strong>
                              </div>
                              <div>
                                <small>Valor estimado do estoque</small>
                                <strong>{stockDetails[product.id].totalStockValue == null ? 'Custo não definido' : formatBRL(stockDetails[product.id].totalStockValue ?? 0)}</strong>
                              </div>
                            </>
                          )}
                          <button className="secondary-button" type="button" onClick={() => navigate('/estoque/saldo')}>Ver saldo por ambiente</button>
                          <button className="secondary-button" type="button" onClick={() => navigate('/inventario')}>Abrir inventário</button>
                        </div>
                        <div className="product-stock-environments">
                          <h3>Saldo por ambiente</h3>
                          {stockDetails[product.id].environments.length === 0
                            ? <p>Nenhum saldo registrado para este produto.</p>
                            : stockDetails[product.id].environments.map((environment) => (
                              <div className="product-stock-environment" key={environment.id}>
                                <span>{environment.name}</span>
                                <div>
                                  <strong>{new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(environment.balance)} {product.unit}</strong>
                                  {canManage && (
                                    <small>
                                      {environment.stockValue == null
                                        ? 'Valor: custo não definido'
                                        : `Valor: ${formatBRL(environment.stockValue)}`}
                                      {environment.unitPrice != null ? ` • Venda: ${formatBRL(environment.unitPrice)}/un.` : ''}
                                      {environment.dosePrice != null ? ` • Dose: ${formatBRL(environment.dosePrice)}` : ''}
                                    </small>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                        <div className="product-stock-movements">
                          <h3>Últimos lançamentos</h3>
                          {stockDetails[product.id].movements.length === 0
                            ? <p>Nenhum lançamento registrado para este produto.</p>
                            : stockDetails[product.id].movements.map((movement) => (
                              <div className="product-stock-movement" key={movement.id}>
                                <div>
                                  <strong>{movement.type}</strong>
                                  <span>{movement.environmentName} • {new Date(movement.createdAt).toLocaleString('pt-BR')}</span>
                                </div>
                                <strong>{movement.signedQuantity >= 0 ? '+' : ''}{new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(movement.signedQuantity)}</strong>
                              </div>
                            ))}
                        </div>
                      </>
                    )}
                  </section>
                )}
              </article>
            )
          })}
        </div>
        <div className="product-pagination" aria-label="Paginação de produtos">
          <button className="secondary-button" type="button" disabled={page <= 1 || loadingList} onClick={() => {
            const nextPage = Math.max(1, page - 1)
            setPage(nextPage)
            void loadResults(appliedSearch, appliedCategory, appliedInactive, nextPage)
          }}>Anterior</button>
          <span>Página {page} de {Math.max(1, Math.ceil(totalProducts / pageSize))}</span>
          <button className="secondary-button" type="button" disabled={page >= Math.ceil(totalProducts / pageSize) || loadingList} onClick={() => {
            const nextPage = page + 1
            setPage(nextPage)
            void loadResults(appliedSearch, appliedCategory, appliedInactive, nextPage)
          }}>Próxima</button>
        </div>
      </Card>}
    </Container>
  )
}
