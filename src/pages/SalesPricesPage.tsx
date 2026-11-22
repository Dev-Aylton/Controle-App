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
import { Container, Card } from '../components'

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
      <Card>
        <p>Defina o custo e os preços de cada produto neste ambiente. O custo é usado no CMV; preços por unidade ou dose calculam o faturamento das importações.</p>
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
                        <button
                          type="button"
                          className="primary-button"
                          disabled={savingProductId !== ''}
                          onClick={() => void saveRow(row)}
                        >
                          {savingProductId === row.product_id ? 'Salvando...' : 'Salvar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </Container>
  )
}
