import { useCallback, useEffect, useRef, useState } from 'react'
import { useCompanies } from '../features/company/company-context'
import {
  listProductEnvironmentPricing,
  saveProductEnvironmentPricing,
  type ProductEnvironmentPricing,
} from '../features/sales/salesService'
import { tryGetSupabaseClient } from '../lib/supabase'
import { traduzirErro } from '../lib/errors'
import { canManageCompany } from '../lib/uiPermissions'
import { Container, Card, ContextHelp, ActionButton, PageGuide } from '../components'
import { calculateRecipeCost, calculateRecipeMargin, type SaleRecipe } from '../features/sales/saleRecipe'
import { calculateAutomaticDosePrice } from '../features/sales/salesRules'
import { formatBrazilianCurrencyInput, parseBrazilianCurrency } from '../features/management/currency'

type Environment = { id: string; name: string }
type EditablePricingField = 'unit_cost' | 'unit_price' | 'dose_price'

function readAmount(value: string) {
  if (value === '') return null
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : null
}

export function SalesPricesPage() {
  const { activeCompany, role, isAdmin } = useCompanies()
  const canManage = canManageCompany(role, isAdmin)
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [environmentsCompanyId, setEnvironmentsCompanyId] = useState<string | null>(null)
  const [environmentId, setEnvironmentId] = useState('')
  const [rows, setRows] = useState<ProductEnvironmentPricing[]>([])
  const [loadingEnvironments, setLoadingEnvironments] = useState(false)
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [savingProductId, setSavingProductId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [recipeName, setRecipeName] = useState('')
  const [recipeCategory, setRecipeCategory] = useState<'bebida' | 'prato' | 'porcao'>('bebida')
  const [recipePrice, setRecipePrice] = useState(0)
  const [recipeProductId, setRecipeProductId] = useState('')
  const [recipeQuantity, setRecipeQuantity] = useState(1)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [productSearch, setProductSearch] = useState('')
  const [productPage, setProductPage] = useState(1)
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [categoryByProduct, setCategoryByProduct] = useState<Record<string, string>>({})
  const [manualDoseOverrides, setManualDoseOverrides] = useState<Set<string>>(new Set())
  const productPageSize = 25

  useEffect(() => {
    let cancelled = false
    const loadEnvironments = async () => {
      if (!activeCompany || !canManage) {
        return
      }
      setLoadingEnvironments(true)
      setError('')
      try {
        const supabase = tryGetSupabaseClient()
        if (!supabase) throw new Error('Supabase não configurado.')
        const result = await supabase
          .from('environments')
          .select('id,name')
          .eq('company_id', activeCompany.id)
          .eq('active', true)
          .order('name')
        if (result.error) throw result.error
        if (cancelled) return
        const nextEnvironments = result.data ?? []
        setEnvironments(nextEnvironments)
        const [categoryResult, productResult] = await Promise.all([
          supabase.from('product_categories').select('id,name').eq('company_id', activeCompany.id).eq('active', true).order('name'),
          supabase.from('products').select('id,category_id').eq('company_id', activeCompany.id).eq('active', true),
        ])
        if (!cancelled) {
          setCategories((categoryResult.data ?? []).map((item) => ({ id: item.id, name: item.name })))
          setCategoryByProduct(Object.fromEntries((productResult.data ?? []).map((item) => [item.id, item.category_id ?? ''])))
        }
        setEnvironmentsCompanyId(activeCompany.id)
        setEnvironmentId((current) => nextEnvironments.some((item) => item.id === current)
          ? current
          : nextEnvironments[0]?.id ?? '')
      } catch (caught) {
        if (!cancelled) setError(traduzirErro(caught, 'Não foi possível carregar os ambientes.'))
      } finally {
        if (!cancelled) setLoadingEnvironments(false)
      }
    }
    queueMicrotask(() => {
      if (cancelled) return
      setEnvironments([])
      setEnvironmentsCompanyId(null)
      setRows([])
      setEnvironmentId('')
      setLoadingEnvironments(false)
      void loadEnvironments()
    })
    return () => { cancelled = true }
  }, [activeCompany, canManage])

  const pricingRequest = useRef(0)
  const loadPrices = useCallback(async () => {
    const requestId = ++pricingRequest.current
    if (!activeCompany || environmentsCompanyId !== activeCompany.id
      || !environmentId || !environments.some((item) => item.id === environmentId)) {
      setRows([])
      setLoadingPrices(false)
      return
    }
    setLoadingPrices(true)
    setError('')
    try {
      const nextRows = await listProductEnvironmentPricing(activeCompany.id, environmentId)
      if (requestId === pricingRequest.current) {
        setRows(nextRows.map((row) => {
          if (row.dose_price != null || manualDoseOverrides.has(row.product_id)) return row
          return {
            ...row,
            dose_price: calculateAutomaticDosePrice(row.unit_price, row.unit_cost ?? row.base_unit_cost, row.volume_ml, row.dose_ml),
          }
        }))
      }
    } catch (caught) {
      if (requestId === pricingRequest.current) {
        setError(traduzirErro(caught, 'Não foi possível carregar custos e preços.'))
      }
    } finally {
      if (requestId === pricingRequest.current) setLoadingPrices(false)
    }
  }, [activeCompany, environmentId, environments, environmentsCompanyId, manualDoseOverrides])

  useEffect(() => {
    queueMicrotask(() => { void loadPrices() })
  }, [loadPrices])

  const updateRow = (productId: string, field: EditablePricingField, value: string) => {
    const amount = readAmount(value)
    setRows((current) => current.map((row) => {
      if (row.product_id !== productId) return row
      const next = { ...row, [field]: amount }
      if (field === 'dose_price') {
        setManualDoseOverrides((currentOverrides) => new Set(currentOverrides).add(productId))
      }
      if (field === 'unit_price' && !manualDoseOverrides.has(productId)) {
        next.dose_price = calculateAutomaticDosePrice(amount, next.unit_cost ?? next.base_unit_cost, next.volume_ml, next.dose_ml)
      }
      if (field === 'unit_cost' && !manualDoseOverrides.has(productId) && next.unit_price == null) {
        next.dose_price = calculateAutomaticDosePrice(null, amount, next.volume_ml, next.dose_ml)
      }
      return next
    }))
  }

  const getDosePriceLabel = (row: ProductEnvironmentPricing) => {
    if (manualDoseOverrides.has(row.product_id)) return 'Editado manualmente'
    if (row.dose_price != null) return 'Calculado pelo app'
    return 'Cadastre volume/dose'
  }

  const saveRow = async (row: ProductEnvironmentPricing) => {
    if (!activeCompany || !environmentId) return
    setSavingProductId(row.product_id)
    setError('')
    setMessage('')
    try {
      await saveProductEnvironmentPricing(activeCompany.id, environmentId, row)
      await loadPrices()
      setMessage(`Custos e preços de ${row.product_name} salvos.`)
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível salvar custos e preços.'))
    } finally {
      setSavingProductId('')
    }
  }

  if (!canManage) {
    return <Container><h1>Preços de venda</h1><Card><p>Acesso restrito a proprietários e gerentes.</p></Card></Container>
  }
  const filteredRows = rows.filter((row) => {
    const matchesCategory = !categoryFilter || categoryByProduct[row.product_id] === categoryFilter
    const search = productSearch.trim().toLowerCase()
    const matchesSearch = !search
      || row.product_name.toLowerCase().includes(search)
      || String(row.sku ?? '').toLowerCase().includes(search)
    return matchesCategory && matchesSearch
  })
  const salesPricePageCount = Math.max(1, Math.ceil(filteredRows.length / productPageSize))
  const visibleRows = filteredRows.slice((productPage - 1) * productPageSize, productPage * productPageSize)

  return (
    <Container>
      <h1>Preços de venda</h1>
      <PageGuide
        purpose="Definir custo de compra, preço por unidade e preço por dose em cada ambiente."
        doNext="Selecione o ambiente e configure somente os campos que correspondem às formas de venda."
        result="Vendas calculam faturamento, custo da mercadoria vendida e lucro com base no preço efetivo."
        roleNote="Somente proprietários, gerentes e administradores podem alterar custos e preços."
      />
      <ContextHelp
        title="Por que cadastrar custos e preços?"
        description="Custos ajudam a calcular o quanto o estoque consumido custou. Preços por unidade ou dose ajudam a calcular faturamento e lucro das vendas."
        steps={[
          'Selecione o ambiente.',
          'Informe o custo real ou use o custo base.',
          'Cadastre preço por unidade para garrafas, pratos e caixas.',
          'Cadastre preço por dose apenas em produtos com volume e dose válidos.',
        ]}
        result="Relatórios e importações de vendas passam a estimar faturamento, custo da mercadoria vendida e lucro bruto."
      />
      <Card>
        <p>Defina o custo e os preços de cada produto neste ambiente. O custo é usado no custo da mercadoria vendida; preços por unidade ou dose calculam o faturamento das importações.</p>
        <p className="field-help">Se o custo do ambiente ficar em branco, será usado o custo base do produto. Para vender por dose, cadastre volume e dose no produto.</p>
        <div className="sales-pricing-toolbar">
          <label>Ambiente
            <select
              value={environmentId}
              onChange={(event) => { setEnvironmentId(event.target.value); setProductPage(1) }}
              disabled={loadingEnvironments || environments.length === 0}
            >
              <option value="">Selecione</option>
              {environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>Categoria
            <select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setProductPage(1) }}>
              <option value="">Todas</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <label>Buscar produto
            <input value={productSearch} onChange={(event) => { setProductSearch(event.target.value); setProductPage(1) }} placeholder="Nome ou código" />
          </label>
        </div>
      </Card>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      {loadingPrices && <p className="page-state">Carregando produtos e preços...</p>}
      {!loadingEnvironments && environments.length === 0 && (
        <Card><p>Cadastre um ambiente antes de configurar custos e preços por local.</p></Card>
      )}
      {!loadingPrices && environmentId && (
        <Card>
          {rows.length === 0 ? <p>Nenhum produto ativo cadastrado neste ambiente.</p> : (
            <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Produto</th><th>Custo por unidade</th><th>Preço por unidade</th><th>Preço por dose</th><th>Ação</th></tr>
                </thead>
                <tbody>
                  {visibleRows.map((row) => (
                    <tr key={row.product_id}>
                      <td><strong>{row.product_name}</strong><br /><small>{row.sku || 'Sem código'} • {row.unit}</small></td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.unit_cost == null ? '' : formatBrazilianCurrencyInput(row.unit_cost)}
                          placeholder={row.base_unit_cost === null ? 'R$ 0,00' : `Base: ${formatBrazilianCurrencyInput(row.base_unit_cost)}`}
                          aria-label={`Custo neste ambiente para ${row.product_name}`}
                          onChange={(event) => updateRow(row.product_id, 'unit_cost', String(parseBrazilianCurrency(event.target.value) ?? ''))}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.unit_price == null ? '' : formatBrazilianCurrencyInput(row.unit_price)}
                          placeholder="R$ 0,00"
                          aria-label={`Preço por unidade para ${row.product_name}`}
                          onChange={(event) => updateRow(row.product_id, 'unit_price', String(parseBrazilianCurrency(event.target.value) ?? ''))}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.dose_price == null ? '' : formatBrazilianCurrencyInput(row.dose_price)}
                          placeholder="R$ 0,00"
                          aria-label={`Preço por dose para ${row.product_name}`}
                          onChange={(event) => updateRow(row.product_id, 'dose_price', String(parseBrazilianCurrency(event.target.value) ?? ''))}
                        />
                        <small>{getDosePriceLabel(row)}</small>
                      </td>
                      <td>
                        <ActionButton
                          className="primary-button"
                          disabled={savingProductId !== ''}
                          busyLabel="Salvando..."
                          confirmMessage={`Salvar custos e preços de "${row.product_name}" neste ambiente?`}
                          onAction={() => saveRow(row)}
                        >
                          Salvar
                        </ActionButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredRows.length > productPageSize && (
              <div className="pagination-controls">
                <button type="button" className="secondary-button" disabled={productPage <= 1} onClick={() => setProductPage((page) => Math.max(1, page - 1))}>Anterior</button>
                <span>Página {productPage} de {salesPricePageCount}</span>
                <button type="button" className="secondary-button" disabled={productPage >= salesPricePageCount} onClick={() => setProductPage((page) => Math.min(salesPricePageCount, page + 1))}>Próxima</button>
              </div>
            )}
            </>
          )}
        </Card>
      )}
      {environmentId && (
        <Card>
          <h2>Ficha técnica opcional</h2>
          <p className="field-help">Use somente quando precisar estimar o custo de uma receita ou drink. Esta tela não baixa insumos nem cria uma venda automaticamente.</p>
          <div className="form-grid">
            <label>Nome do item vendido
              <input value={recipeName} onChange={(event) => setRecipeName(event.target.value)} placeholder="Ex.: Caipirinha de limão" />
            </label>
            <label>Categoria
              <select value={recipeCategory} onChange={(event) => setRecipeCategory(event.target.value as typeof recipeCategory)}>
                <option value="bebida">Bebida</option>
                <option value="prato">Prato</option>
                <option value="porcao">Porção</option>
              </select>
            </label>
            <label>Preço de venda
              <input
                type="text"
                inputMode="decimal"
                value={formatBrazilianCurrencyInput(recipePrice)}
                placeholder="R$ 0,00"
                onChange={(event) => setRecipePrice(parseBrazilianCurrency(event.target.value) ?? 0)}
              />
            </label>
          </div>
          <div className="form-grid">
            <label>Insumo da ficha técnica
              <select value={recipeProductId} onChange={(event) => setRecipeProductId(event.target.value)}>
                <option value="">Selecione</option>
                {rows.map((row) => <option key={row.product_id} value={row.product_id}>{row.product_name}</option>)}
              </select>
            </label>
            <label>Quantidade usada
              <input type="number" min="0.001" step="0.001" value={recipeQuantity} onChange={(event) => setRecipeQuantity(Number(event.target.value))} />
            </label>
          </div>
          {recipeName && recipeProductId && recipeQuantity > 0 && (() => {
            const product = rows.find((row) => row.product_id === recipeProductId)
            if (!product) return null
            const unitCost = product.unit_cost ?? product.base_unit_cost
            const recipe: SaleRecipe = {
              id: 'preview',
              name: recipeName,
              category: recipeCategory,
              salePrice: recipePrice,
              yieldQuantity: 1,
              active: true,
              ingredients: [{
                productId: product.product_id,
                productName: product.product_name,
                quantity: recipeQuantity,
                unit: product.unit,
                unitCost,
              }],
            }
            const cost = calculateRecipeCost(recipe)
            const margin = calculateRecipeMargin(recipe)
            return (
              <div className="stock-gap-result ok">
                <div><small>Custo do insumo</small><strong>{cost.totalCost}</strong></div>
                <div><small>Custo por venda</small><strong>{cost.costPerYield ?? '-'}</strong></div>
                <div><small>Lucro bruto</small><strong>{margin?.grossProfit ?? '-'}</strong></div>
                <p>{margin?.marginPercent == null ? 'Informe preço e custo para calcular a margem.' : `Margem estimada: ${margin.marginPercent}%`}</p>
              </div>
            )
          })()}
          <p className="field-help">A ficha técnica registra os ingredientes e suas quantidades. Esta prévia não altera estoque nem vendas até a confirmação de uma operação relacionada.</p>
        </Card>
      )}
    </Container>
  )
}
