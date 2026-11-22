import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useCompanies } from '../features/company/company-context'
import { listProductData, saveCategory, saveProduct, updateCategory } from '../features/products/productService'
import { tryGetSupabaseClient } from '../lib/supabase'
import { friendlySupabaseError } from '../lib/errors'
import { canManageCompany } from '../lib/uiPermissions'
import { formatBRL } from '../features/products/import/formatCurrency'
import { Container, Card, PhotoPicker, Avatar, ActionButton } from '../components'
import { useNavigate } from 'react-router-dom'
import type { Tables } from '../lib/database.types'
import { validateStockRange } from '../features/management/rules'
import { getStockSuggestions, type StockSuggestion } from '../features/management/stockSuggestions'
import { traduzirErro } from '../lib/errors'

type Product = Tables<'products'>
type Category = Tables<'product_categories'>
type ProductCost = Tables<'product_costs'>

export function ProductsPage() {
  const { activeCompany, role, isAdmin } = useCompanies()
  const activeCompanyId = activeCompany?.id
  const navigate = useNavigate()
  const canManage = canManageCompany(role, isAdmin)
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
  const [unit, setUnit] = useState<'un'|'kg'|'g'|'l'|'ml'|'cx'|'pct'>('un')
  const [minStock, setMinStock] = useState<number | null>(0)
  const [maxStock, setMaxStock] = useState<number | null>(null)
  const [volumeMl, setVolumeMl] = useState<number | null>(null)
  const [doseMl, setDoseMl] = useState<number | null>(null)
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

  const load = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const data = await listProductData(activeCompanyId, canManage)
      setProducts(data.products)
      setCategories(data.categories)
      setCosts(data.costs)
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível carregar produtos.'))
    }
  }, [activeCompanyId, canManage])

  useEffect(() => {
    if (activeCompanyId) queueMicrotask(() => { void load() })
  }, [activeCompanyId, load])

  const reset = () => {
    setEditingId(null); setName(''); setSku(''); setCategoryId(''); setInlineCategory('')
    setUnit('un'); setMinStock(0); setMaxStock(null); setUnitCost(0); setPhotoBlob(null); setPhotoPreview(''); setPhotoPath(null)
    setVolumeMl(null); setDoseMl(null)
  }

  const openSuggestions = async () => {
    if (!activeCompanyId) return
    setSuggestionOpen(true)
    setSuggestionLoading(true)
    setError('')
    try {
      setSuggestions(await getStockSuggestions(activeCompanyId, null, 90))
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
      await load()
    }
  }

  const acceptAllSuggestions = async () => {
    for (const suggestion of suggestions) await acceptSuggestion(suggestion)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!activeCompany) return
    setError('')
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
        photo_path: nextPhotoPath,
        active: true,
      }, canManage ? unitCost : undefined)
      reset()
      await load()
    } catch (caught) {
      setError(friendlySupabaseError(caught))
    }
  }

  const edit = (product: Product) => {
    setEditingId(product.id); setName(product.name); setSku(product.sku ?? '')
    setCategoryId(product.category_id ?? ''); setUnit(product.unit); setMinStock(product.min_stock === null ? null : Number(product.min_stock))
    setMaxStock(product.max_stock === null ? null : Number(product.max_stock))
    setVolumeMl(product.volume_ml === null ? null : Number(product.volume_ml))
    setDoseMl(product.dose_ml === null ? null : Number(product.dose_ml))
    setPhotoPath(product.photo_path); setPhotoPreview('')
    const cost = costs.find((item) => item.product_id === product.id)
    setUnitCost(cost ? Number(cost.unit_cost) : 0)
  }

  const toggleActive = async (product: Product) => {
    const supabase = tryGetSupabaseClient()
    if (!supabase) return
    const { error: actionError } = await supabase
      .from('products')
      .update({ active: !product.active })
      .eq('id', product.id)
    if (actionError) setError(friendlySupabaseError(actionError))
    else await load()
  }

  const filtered = products.filter((product) =>
    (!showInactive ? product.active : true)
    && (!categoryFilter || product.category_id === categoryFilter)
    && (!search || `${product.name} ${product.sku ?? ''}`.toLowerCase().includes(search.toLowerCase())),
  )

  return (
    <Container>
      <h1>Produtos</h1>
      {canManage && <button className="secondary-button" type="button" onClick={() => navigate('/produtos/importar')}>Importar planilha</button>}
      {canManage && <ActionButton className="secondary-button" busyLabel="Calculando..." onAction={openSuggestions}>Sugerir mínimo e máximo</ActionButton>}
      {canManage && <p className="field-help">Usa as movimentações dos últimos 90 dias para sugerir níveis de estoque. Revise as sugestões antes de aplicá-las.</p>}
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
                    <div><strong>{suggestion.product_name}</strong><span>{suggestion.environment_name} • atual {suggestion.current_min ?? '-'} / {suggestion.current_max ?? '-'} • sugerido {suggestion.suggested_min} / {suggestion.suggested_max}</span></div>
                    <div className="member-actions">
                      <ActionButton className="primary-button" busyLabel="Aplicando..." onAction={() => acceptSuggestion(suggestion)}>Aceitar</ActionButton>
                      <button className="secondary-button" type="button" onClick={() => setSuggestions((current) => current.filter((item) => item !== suggestion))}>Ignorar</button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
          {canManage && (
            <Card>
              <h2>Categorias</h2>
              <div className="form-grid">
                <label>Categoria<input value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Ex.: Destilados" /></label>
                <ActionButton className="primary-button" busyLabel="Salvando..." disabled={!categoryName.trim()} onAction={async () => {
                  if (categoryEditingId) await updateCategory(categoryEditingId, categoryName)
                  else if (activeCompany) await saveCategory(activeCompany.id, categoryName)
                  setCategoryName('')
                  setCategoryEditingId(null)
                  await load()
                }}>{categoryEditingId ? 'Salvar categoria' : 'Criar categoria'}</ActionButton>
              </div>
              {categories.length === 0 && <p>Nenhuma categoria cadastrada. Crie a primeira categoria.</p>}
              <div className="member-list">
                {categories.map((category) => (
                  <article className="member-row" key={category.id}>
                    <strong>{category.name}</strong>
                    <div className="member-actions">
                      <button className="secondary-button" type="button" onClick={() => { setCategoryEditingId(category.id); setCategoryName(category.name) }}>Editar</button>
                      <ActionButton className="danger-button" busyLabel="Alterando..." confirmMessage={category.active ? 'Desativar esta categoria?' : undefined} onAction={async () => { await updateCategory(category.id, category.name, !category.active); await load() }}>
                        {category.active ? 'Desativar' : 'Reativar'}
                      </ActionButton>
                    </div>
                  </article>
                ))}
              </div>
            </Card>
          )}
        </Card>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
      <Card>
        <div className="form-grid">
          <label>Buscar<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ex.: vodka, cerveja ou código" /></label>
          <label>Categoria
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
              <option value="">Todas</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label className="check-label"><input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} /> Mostrar inativos</label>
        </div>
      </Card>
      {canManage && (
        <Card>
          <h2>{editingId ? 'Editar produto' : 'Novo produto'}</h2>
          <form className="form-stack" onSubmit={(event) => event.preventDefault()}>
            <label>Nome<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: Vodka Premium 1 L" required /></label>
            <label>Código/SKU
              <input value={sku} onChange={(event) => setSku(event.target.value)} placeholder="Ex.: VOD-001" aria-describedby="product-sku-help" />
              <span className="field-help" id="product-sku-help">Código próprio para identificar e localizar o produto.</span>
            </label>
            <label>Categoria
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">Sem categoria</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label>Nova categoria (opcional)
              <input value={inlineCategory} onChange={(event) => setInlineCategory(event.target.value)} placeholder="Ex.: Destilados" aria-describedby="inline-category-help" />
              <span className="field-help" id="inline-category-help">Digite um nome para criar e atribuir uma categoria ao produto ao salvar. Se deixar vazio, será usada a categoria escolhida acima.</span>
            </label>
            <label>Unidade
              <select value={unit} onChange={(event) => setUnit(event.target.value as typeof unit)}>
                <option value="un">Unidade</option><option value="kg">kg</option><option value="g">g</option><option value="l">l</option><option value="ml">ml</option><option value="cx">Caixa</option><option value="pct">Pacote</option>
              </select>
            </label>
            <label>Estoque mínimo
              <input type="number" min="0" step="0.001" value={minStock ?? ''} onChange={(event) => setMinStock(event.target.value === '' ? null : Number(event.target.value))} placeholder="Ex.: 5" aria-describedby="min-stock-help" />
              <span className="field-help" id="min-stock-help">Gera um alerta quando o saldo atingir ou ficar abaixo deste valor.</span>
            </label>
            <label>Estoque máximo
              <input type="number" min="0" step="0.001" value={maxStock ?? ''} onChange={(event) => setMaxStock(event.target.value === '' ? null : Number(event.target.value))} placeholder="Ex.: 12" aria-describedby="max-stock-help" />
              <span className="field-help" id="max-stock-help">Limite desejado usado como referência para recomendações de estoque.</span>
            </label>
            <label>Volume da unidade (ml)
              <input type="number" min="0" step="0.001" value={volumeMl ?? ''} onChange={(event) => setVolumeMl(event.target.value === '' ? null : Number(event.target.value))} placeholder="Ex.: 998" aria-describedby="volume-help" />
              <span className="field-help" id="volume-help">Conteúdo total da embalagem, em mililitros.</span>
            </label>
            <label>Dose (ml)
              <input type="number" min="0" step="0.001" value={doseMl ?? ''} onChange={(event) => setDoseMl(event.target.value === '' ? null : Number(event.target.value))} placeholder="Ex.: 50" aria-describedby="dose-help" />
              <span className="field-help" id="dose-help">Quantidade servida por dose. Informe também o volume para calcular equivalências em doses.</span>
            </label>
            {volumeMl !== null && doseMl !== null && doseMl > 0 && <p>Doses por unidade: {Math.floor(volumeMl / doseMl)}</p>}
            {canManage && (
              <label>Custo unitário (R$)
                <input type="number" min="0" step="0.01" value={unitCost} onChange={(event) => setUnitCost(Number(event.target.value))} placeholder="Ex.: 89,90" aria-describedby="unit-cost-help" />
                <span className="field-help" id="unit-cost-help">Usado para estimar o valor do estoque e das compras.</span>
              </label>
            )}
            <PhotoPicker shape="square" label="Foto do produto" onConfirm={(blob, previewUrl) => { setPhotoBlob(blob); setPhotoPreview(previewUrl) }} />
            {(photoPreview || photoPath) && <Avatar name={name} uploadedUrl={photoPreview || undefined} storageBucket="company-photos" storagePath={photoPreview ? null : photoPath} shape="square" size={96} companyLogoFallback />}
            <ActionButton className="primary-button" busyLabel="Salvando..." onAction={() => submit({ preventDefault: () => undefined } as FormEvent)}>{editingId ? 'Salvar produto' : 'Criar produto'}</ActionButton>
          </form>
        </Card>
      )}
      <Card>
        {filtered.length === 0 && <p>Nenhum produto cadastrado ainda. Cadastre o primeiro produto no formulário acima.</p>}
        <div className="member-list">
          {filtered.map((product) => {
            const cost = costs.find((item) => item.product_id === product.id)
            return (
              <article className="member-row" key={product.id}>
                <div className="member-identity">
                  <Avatar name={product.name} storageBucket="company-photos" storagePath={product.photo_path} shape="square" size={48} companyLogoFallback />
                  <span><strong>{product.name}</strong><small>{product.sku || 'Sem código'} • {product.unit}{canManage && cost ? ` • ${formatBRL(Number(cost.unit_cost))}` : ''}</small></span>
                </div>
                {canManage && (
                  <div className="member-actions">
                    <button className="secondary-button" type="button" onClick={() => edit(product)}>Editar</button>
                    <ActionButton className="danger-button" busyLabel="Alterando..." confirmMessage={product.active ? 'Desativar este produto?' : undefined} onAction={() => toggleActive(product)}>{product.active ? 'Desativar' : 'Reativar'}</ActionButton>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </Card>
    </Container>
  )
}
