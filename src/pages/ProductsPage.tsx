import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useCompanies } from '../features/company/company-context'
import { listProductData, saveCategory, saveProduct } from '../features/products/productService'
import { tryGetSupabaseClient } from '../lib/supabase'
import { friendlySupabaseError } from '../lib/errors'
import { canManageCompany } from '../lib/uiPermissions'
import { formatBRL } from '../features/products/import/formatCurrency'
import { Container, Card, PhotoPicker, Avatar } from '../components'
import { useNavigate } from 'react-router-dom'
import type { Tables } from '../lib/database.types'

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
  const [minStock, setMinStock] = useState(0)
  const [unitCost, setUnitCost] = useState(0)
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [photoPath, setPhotoPath] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!activeCompanyId) return
    try {
      const data = await listProductData(activeCompanyId)
      setProducts(data.products)
      setCategories(data.categories)
      setCosts(data.costs)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível carregar produtos.')
    }
  }, [activeCompanyId])

  useEffect(() => {
    if (activeCompanyId) queueMicrotask(() => { void load() })
  }, [activeCompanyId, load])

  const reset = () => {
    setEditingId(null); setName(''); setSku(''); setCategoryId(''); setInlineCategory('')
    setUnit('un'); setMinStock(0); setUnitCost(0); setPhotoBlob(null); setPhotoPreview(''); setPhotoPath(null)
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!activeCompany) return
    setError('')
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
    setCategoryId(product.category_id ?? ''); setUnit(product.unit); setMinStock(Number(product.min_stock))
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
      {error && <p className="form-error" role="alert">{error}</p>}
      <Card>
        <div className="form-grid">
          <label>Buscar<input value={search} onChange={(event) => setSearch(event.target.value)} /></label>
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
          <form className="form-stack" onSubmit={submit}>
            <label>Nome<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
            <label>Código/SKU<input value={sku} onChange={(event) => setSku(event.target.value)} /></label>
            <label>Categoria
              <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
                <option value="">Sem categoria</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label>Nova categoria inline<input value={inlineCategory} onChange={(event) => setInlineCategory(event.target.value)} placeholder="Opcional" /></label>
            <label>Unidade
              <select value={unit} onChange={(event) => setUnit(event.target.value as typeof unit)}>
                <option value="un">Unidade</option><option value="kg">kg</option><option value="g">g</option><option value="l">l</option><option value="ml">ml</option><option value="cx">Caixa</option><option value="pct">Pacote</option>
              </select>
            </label>
            <label>Estoque mínimo<input type="number" min="0" step="0.01" value={minStock} onChange={(event) => setMinStock(Number(event.target.value))} /></label>
            {canManage && (
              <label>Custo unitário (R$)<input type="number" min="0" step="0.01" value={unitCost} onChange={(event) => setUnitCost(Number(event.target.value))} /></label>
            )}
            <PhotoPicker shape="square" label="Foto do produto" onConfirm={(blob, previewUrl) => { setPhotoBlob(blob); setPhotoPreview(previewUrl) }} />
            {(photoPreview || photoPath) && <Avatar name={name} uploadedUrl={photoPreview || undefined} storageBucket="company-photos" storagePath={photoPreview ? null : photoPath} shape="square" size={96} companyLogoFallback />}
            <button className="primary-button" type="submit">{editingId ? 'Salvar produto' : 'Criar produto'}</button>
          </form>
        </Card>
      )}
      <Card>
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
                    <button className="danger-button" type="button" onClick={() => toggleActive(product)}>{product.active ? 'Desativar' : 'Reativar'}</button>
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
