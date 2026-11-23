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
      if (requestId === pricingRequest.current) setRows(nextRows)
    } catch (caught) {
      if (requestId === pricingRequest.current) {
        setError(traduzirErro(caught, 'Não foi possível carregar custos e preços.'))
      }
    } finally {
      if (requestId === pricingRequest.current) setLoadingPrices(false)
    }
  }, [activeCompany, environmentId, environments, environmentsCompanyId])

  useEffect(() => {
    queueMicrotask(() => { void loadPrices() })
  }, [loadPrices])

  const updateRow = (productId: string, field: EditablePricingField, value: string) => {
    const amount = readAmount(value)
    setRows((current) => current.map((row) => row.product_id === productId
      ? { ...row, [field]: amount }
      : row))
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
        <label>Ambiente
          <select
            value={environmentId}
            onChange={(event) => setEnvironmentId(event.target.value)}
            disabled={loadingEnvironments || environments.length === 0}
          >
            <option value="">Selecione</option>
            {environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
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
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Produto</th><th>Custo por unidade</th><th>Preço por unidade</th><th>Preço por dose</th><th>Ação</th></tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.product_id}>
                      <td><strong>{row.product_name}</strong><br /><small>{row.sku || 'Sem código'} • {row.unit}</small></td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.0001"
                          value={row.unit_cost ?? ''}
                          placeholder={row.base_unit_cost === null ? 'Não definido' : `Base: ${row.base_unit_cost}`}
                          aria-label={`Custo neste ambiente para ${row.product_name}`}
                          onChange={(event) => updateRow(row.product_id, 'unit_cost', event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.unit_price ?? ''}
                          placeholder="Não definido"
                          aria-label={`Preço por unidade para ${row.product_name}`}
                          onChange={(event) => updateRow(row.product_id, 'unit_price', event.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={row.dose_price ?? ''}
                          placeholder="Não definido"
                          aria-label={`Preço por dose para ${row.product_name}`}
                          onChange={(event) => updateRow(row.product_id, 'dose_price', event.target.value)}
                        />
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
          )}
        </Card>
      )}
      {environmentId && (
        <Card>
          <h2>Ficha técnica de prato ou drink</h2>
          <p className="field-help">Cadastre aqui o que compõe uma venda comercial. O preço é separado do custo dos insumos e pode variar por ambiente.</p>
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
              <input type="number" min="0" step="0.01" value={recipePrice} onChange={(event) => setRecipePrice(Number(event.target.value))} />
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
          <p className="field-help">Os ingredientes serão cadastrados pela ficha técnica completa depois da aplicação do patch SQL no ambiente de teste. Até lá, esta prévia não altera estoque nem vendas.</p>
        </Card>
      )}
    </Container>
  )
}
