import { useEffect, useState, type ChangeEvent } from 'react'
import { useCompanies } from '../features/company/company-context'
import { tryGetSupabaseClient } from '../lib/supabase'
import { applyInventoryCountBatch, finishInventory, getStockBalance, openInventory, submitInventoryCount, zeroStock } from '../services/movements'
import { Container, Card, ActionButton, ContextHelp, PageGuide } from '../components'
import { traduzirErro } from '../lib/errors'
import {
  downloadInventoryCountTemplate,
  downloadInventoryCountCsvTemplate,
  findInventoryCountProduct,
  parseInventoryCountFile,
  suggestInventoryCountProducts,
} from '../features/movements/inventoryCountTemplate'
import { analyzeStockGap, type StockGapAnalysis, type StockGapMovement } from '../features/management/stockGapAnalysis'
import { calculateBoatCycleFromMovements, type BoatCycleAnalysis } from '../features/management/boatCycle'

type SimpleItem = {
  id: string
  name: string
  sku?: string | null
  category_id?: string | null
  unit?: string | null
  volume_ml?: number | null
  dose_ml?: number | null
  weight_g?: number | null
}
type DifferenceRow = { product_id: string; productName: string; counted: number; balanceBefore: number; difference: number; differenceDoses?: number }
type CountImportPreviewRow = {
  line: number
  code: string
  name: string
  quantity: number
  productId: string | null
  valid: boolean
  message: string
  suggestions: Array<{ id: string; name: string; sku: string | null }>
  unit: string
  measure: string
}

export function InventoryPage() {
  const { activeCompany, isAdmin, role } = useCompanies()
  const companyId = activeCompany?.id
  const [environments, setEnvironments] = useState<SimpleItem[]>([])
  const [products, setProducts] = useState<SimpleItem[]>([])
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([])
  const [environmentId, setEnvironmentId] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [counted, setCounted] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<DifferenceRow[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [zeroReason, setZeroReason] = useState('')
  const [zeroProductId, setZeroProductId] = useState('')
  const [countImportPreview, setCountImportPreview] = useState<CountImportPreviewRow[]>([])
  const [countImportName, setCountImportName] = useState('')
  const [message, setMessage] = useState('')
  const [templatePreviewOpen, setTemplatePreviewOpen] = useState(false)
  const [gapProductId, setGapProductId] = useState('')
  const [gapAnalysis, setGapAnalysis] = useState<StockGapAnalysis | null>(null)
  const [boatAnalysis, setBoatAnalysis] = useState<BoatCycleAnalysis | null>(null)
  const [destinationEnvironmentId, setDestinationEnvironmentId] = useState('')
  const [boatProductId, setBoatProductId] = useState('')
  const [boatInitialBalance, setBoatInitialBalance] = useState(0)
  const [boatFinalBalance, setBoatFinalBalance] = useState(0)

  useEffect(() => {
    if (!companyId) return
    const supabase = tryGetSupabaseClient()
    if (!supabase) return
    queueMicrotask(() => {
      void Promise.all([
        supabase.from('environments').select('*').eq('company_id', companyId).eq('active', true),
        supabase.from('products').select('id,name,sku,category_id,unit,volume_ml,dose_ml,weight_g').eq('company_id', companyId).eq('active', true),
        supabase.from('product_categories').select('id,name').eq('company_id', companyId).eq('active', true),
      ]).then(([environmentResult, productResult, categoryResult]) => {
        setEnvironments((environmentResult.data ?? []).map((item) => ({ id: item.id, name: item.name })))
        setCategories((categoryResult.data ?? []).map((item) => ({ id: item.id, name: item.name })))
        setProducts((productResult.data ?? []).map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          category_id: item.category_id,
          unit: item.unit,
          volume_ml: item.volume_ml,
          dose_ml: item.dose_ml,
          weight_g: item.weight_g,
        })))
      })
    })
  }, [companyId])

  const downloadTemplate = () => {
    const environmentName = environmentId
      ? environments.find((item) => item.id === environmentId)?.name ?? 'Todos os ambientes'
      : 'Todos os ambientes'
    downloadInventoryCountTemplate(environmentName, products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      categoryName: categories.find((category) => category.id === product.category_id)?.name ?? '',
      unit: product.unit,
      volumeMl: product.volume_ml,
      doseMl: product.dose_ml,
      weightG: product.weight_g,
    })))
  }

  const downloadCsvTemplate = () => {
    const environmentName = environmentId
      ? environments.find((item) => item.id === environmentId)?.name ?? 'Todos os ambientes'
      : 'Todos os ambientes'
    downloadInventoryCountCsvTemplate(environmentName, products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      categoryName: categories.find((category) => category.id === product.category_id)?.name ?? '',
      unit: product.unit,
      volumeMl: product.volume_ml,
      doseMl: product.dose_ml,
      weightG: product.weight_g,
    })))
  }

  const createMissingProducts = async () => {
    if (!companyId) return
    const missingRows = countImportPreview.filter((row) => !row.productId)
    if (missingRows.length === 0) return
    setError('')
    setLoading(true)
    try {
      const supabase = tryGetSupabaseClient()
      if (!supabase) throw new Error('Supabase não configurado.')
      const createdIds = new Map<string, string>()
      for (const row of missingRows) {
        const unit = (row.unit || 'un').trim().toLowerCase()
        const allowedUnits = ['un','kg','g','l','ml','cx','pct','garrafa','lata','maço','porcao','duzia','bandeja','pacote','saco','ramo','peca','fardo','frasco']
        const safeUnit = allowedUnits.includes(unit) ? unit : 'un'
        const measureText = row.measure.replace(',', '.').match(/[\d.]+/)
        const volumeMl = /ml/i.test(row.measure) ? Number(measureText?.[0] ?? '') : null
        const sku = row.code.trim() || null
        if (sku) {
          const { data: existingSku } = await supabase
            .from('products')
            .select('id')
            .eq('company_id', companyId)
            .ilike('sku', sku)
            .maybeSingle()
          if (existingSku) {
            createdIds.set(`${row.line}`, existingSku.id)
            continue
          }
        }
        const { data, error: createError } = await supabase
          .from('products')
          .insert({
            company_id: companyId,
            name: row.name.trim(),
            sku,
            unit: safeUnit,
            volume_ml: volumeMl && volumeMl > 0 ? volumeMl : null,
            min_stock: 0,
            active: true,
          })
          .select('id,name,sku,unit,volume_ml,dose_ml,weight_g')
          .single()
        if (createError) throw createError
        if (data) {
          createdIds.set(`${row.line}`, data.id)
          setProducts((current) => [...current, {
            id: data.id,
            name: data.name,
            sku: data.sku,
            category_id: null,
            unit: data.unit,
            volume_ml: data.volume_ml,
            dose_ml: data.dose_ml,
            weight_g: data.weight_g,
          }])
        }
      }
      setCountImportPreview((current) => current.map((row) => {
        const createdId = createdIds.get(`${row.line}`)
        if (!createdId) return row
        return {
          ...row,
          productId: createdId,
          valid: true,
          message: 'Produto criado e pronto para a contagem',
        }
      }))
      setMessage(`${createdIds.size} produto(s) ausente(s) foram cadastrados. Revise a prévia antes de aplicar a contagem.`)
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível cadastrar os produtos ausentes.'))
    } finally {
      setLoading(false)
    }
  }

  const readCountFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setCountImportName(file.name)
    try {
      const rows = await parseInventoryCountFile(file)
      const environment = environments.find((item) => item.id === environmentId)
      const previewRows: CountImportPreviewRow[] = rows.map((row) => {
        const environmentMatches = !row.environment || !environment || row.environment.toLowerCase() === environment.name.toLowerCase()
        const catalogProducts = products.map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          volumeMl: item.volume_ml,
          doseMl: item.dose_ml,
        }))
        const match = findInventoryCountProduct(row.code, row.name, row.unit, row.measure, catalogProducts)
        const product = match?.product
        const suggestions = suggestInventoryCountProducts(row.code, row.name, catalogProducts)
        const message = !environmentMatches
          ? 'Ambiente da linha não corresponde ao ambiente selecionado'
          : !product
            ? suggestions.length > 0
              ? `Produto não identificado. Possíveis correspondências: ${suggestions.map((item) => item.sku ? `${item.name} (${item.sku})` : item.name).join(', ')}`
              : 'Produto não encontrado. Confira o nome ou informe o SKU cadastrado.'
            : !Number.isFinite(row.quantity) || row.quantity < 0
              ? 'Quantidade inválida'
              : match?.kind === 'sku'
                ? `Pronto — identificado pelo SKU ${product.sku}`
                : match?.kind === 'variant'
                  ? `Pronto — variante identificada pelo nome e volume`
                  : `Pronto — identificado pelo nome`
        return {
          line: row.line,
          code: row.code,
          name: row.name,
          quantity: row.quantity,
          productId: product?.id ?? null,
          valid: environmentMatches && Boolean(product) && Number.isFinite(row.quantity) && row.quantity >= 0,
          message,
          suggestions: suggestions.map((item) => ({ id: item.id, name: item.name, sku: item.sku ?? null })),
          unit: row.unit,
          measure: row.measure,
        }

      })
      setCountImportPreview(previewRows)
    } catch (caught) {
      setCountImportPreview([])
      setError(traduzirErro(caught, 'Não foi possível ler a planilha de contagem.'))
    }
  }

  const applyCountImport = async () => {
    if (!companyId || !environmentId) return
    const validRows = countImportPreview.filter((row) => row.valid && row.productId)
    if (validRows.length === 0) {
      setError('Nenhuma linha válida foi encontrada. Confira o modelo e os dados da planilha.')
      return
    }
    if (validRows.length !== countImportPreview.length) {
      setError('Corrija todas as linhas da planilha antes de aplicar a contagem.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await applyInventoryCountBatch(
        companyId,
        environmentId,
        validRows.map((row) => ({ product_id: row.productId!, counted_quantity: row.quantity })),
      )
      setSessionId('')
      setCounted(new Set())
      setCounts({})
      setCountImportPreview([])
      setCountImportName('')
      setMessage('Contagens da planilha importadas. Revise a prévia antes de finalizar.')
      setPreview(null)
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível importar a contagem.'))
    } finally {
      setLoading(false)
    }
  }

  const open = async () => {
    if (!companyId || !environmentId) return
    setError('')
    setLoading(true)
    try {
      setSessionId(await openInventory(companyId, environmentId))
      setCounted(new Set())
      setPreview(null)
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível abrir o inventário.'))
    } finally {
      setLoading(false)
    }
  }

  const save = async (productId: string) => {
    if (!sessionId) return
    setError('')
    setLoading(true)
    try {
      await submitInventoryCount(sessionId, productId, counts[productId] ?? 0)
      setCounted((current) => new Set(current).add(productId))
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível salvar a contagem.'))
    } finally {
      setLoading(false)
    }
  }

  const previewDifferences = async () => {
    if (!companyId || !environmentId) return
    setError('')
    setLoading(true)
    try {
      const supabase = tryGetSupabaseClient()
      if (!supabase) throw new Error('Supabase não configurado.')
      const [balances, countResult] = await Promise.all([
        getStockBalance(companyId, environmentId),
        supabase.from('inventory_counts').select('product_id,counted_quantity').eq('session_id', sessionId),
      ])
      const countMap = new Map((countResult.data ?? []).map((count) => [count.product_id, Number(count.counted_quantity)]))
      const missing = products.filter((product) => !countMap.has(product.id))
      if (missing.length > 0) {
        setError(`Faltam contagens: ${missing.map((product) => product.name).join(', ')}.`)
        setLoading(false)
        return
      }
      const rows = products.map((product) => {
        const balanceBefore = Number(balances.find((balance) => balance.product_id === product.id)?.balance ?? 0)
        const countedQuantity = countMap.get(product.id) ?? 0
        return {
          product_id: product.id,
          productName: product.name,
          counted: countedQuantity,
          balanceBefore,
          difference: countedQuantity - balanceBefore,
          differenceDoses: (() => {
            if (!product?.volume_ml || !product.dose_ml || product.dose_ml <= 0) return undefined
            return Math.round((countedQuantity - balanceBefore) * Math.floor(product.volume_ml / product.dose_ml))
          })(),
        }
      })
      setPreview(rows)
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível preparar o resumo.'))
    } finally {
      setLoading(false)
    }
  }

  const confirmFinish = async () => {
    setError('')
    setLoading(true)
    try {
      await finishInventory(sessionId)
      setPreview(null)
      setSessionId('')
      setCounted(new Set())
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível finalizar o inventário.'))
    } finally {
      setLoading(false)
    }
  }

  const analyzeBoatDay = async () => {
    if (!companyId || !destinationEnvironmentId || !boatProductId) return
    setError('')
    setLoading(true)
    try {
      const supabase = tryGetSupabaseClient()
      if (!supabase) throw new Error('Supabase não configurado.')
      const today = new Date()
      const from = new Date(today)
      from.setHours(0, 0, 0, 0)
      const movementsResult = await supabase
        .from('stock_movements')
        .select('type,quantity,signed_quantity,created_at,note,environment_id,transfer_group_id')
        .eq('company_id', companyId)
        .eq('product_id', boatProductId)
        .gte('created_at', from.toISOString())
        .lte('created_at', today.toISOString())
      if (movementsResult.error) throw movementsResult.error
      setBoatAnalysis(calculateBoatCycleFromMovements(
        (movementsResult.data ?? []) as Parameters<typeof calculateBoatCycleFromMovements>[0],
        destinationEnvironmentId,
        boatInitialBalance,
        boatFinalBalance,
      ))
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível analisar o fechamento diário do ambiente de trabalho.'))
    } finally {
      setLoading(false)
    }
  }

  const analyzeGap = async () => {
    if (!companyId || !environmentId || !gapProductId) return
    setError('')
    setLoading(true)
    try {
      const supabase = tryGetSupabaseClient()
      if (!supabase) throw new Error('Supabase não configurado.')
      const sessionsResult = await supabase
        .from('inventory_sessions')
        .select('id,opened_at,finished_at,status')
        .eq('company_id', companyId)
        .eq('environment_id', environmentId)
        .eq('status', 'finalizada')
        .order('finished_at', { ascending: true })
      if (sessionsResult.error) throw sessionsResult.error
      const sessions = sessionsResult.data ?? []
      if (sessions.length < 2) {
        setGapAnalysis(null)
        setError('São necessárias pelo menos duas contagens finalizadas no ambiente para comparar o período.')
        return
      }
      const previous = sessions[sessions.length - 2]
      const latest = sessions[sessions.length - 1]
      const [previousCounts, latestCounts, movementsResult] = await Promise.all([
        supabase.from('inventory_counts').select('counted_quantity').eq('session_id', previous.id).eq('product_id', gapProductId).maybeSingle(),
        supabase.from('inventory_counts').select('counted_quantity').eq('session_id', latest.id).eq('product_id', gapProductId).maybeSingle(),
        supabase.from('stock_movements')
          .select('type,quantity,signed_quantity,created_at,note,environment_id')
          .eq('company_id', companyId)
          .eq('environment_id', environmentId)
          .eq('product_id', gapProductId)
          .gte('created_at', previous.finished_at ?? previous.opened_at)
          .lte('created_at', latest.finished_at ?? latest.opened_at),
      ])
      if (previousCounts.error) throw previousCounts.error
      if (latestCounts.error) throw latestCounts.error
      if (movementsResult.error) throw movementsResult.error
      if (!previousCounts.data || !latestCounts.data) {
        setGapAnalysis(null)
        setError('As duas contagens não possuem registro deste produto. Selecione outro produto ou confira as contagens.')
        return
      }
      const initialCount = Number(previousCounts.data.counted_quantity)
      const finalCount = Number(latestCounts.data.counted_quantity)
      const movements = (movementsResult.data ?? []) as StockGapMovement[]
      setGapAnalysis(analyzeStockGap(initialCount, finalCount, movements))
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível analisar o período entre contagens.'))
    } finally {
      setLoading(false)
    }
  }

  const zero = async () => {
    if (!companyId || !environmentId || !zeroReason.trim()) return
    setError('')
    setLoading(true)
    try {
      await zeroStock(companyId, environmentId, zeroProductId || null, zeroReason)
      setZeroReason('')
      setZeroProductId('')
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível zerar o estoque.'))
    } finally {
      setLoading(false)
    }
  }

  const canFinish = isAdmin || role === 'owner' || role === 'manager'

  return (
    <Container>
      <h1>Inventário cego</h1>
      <PageGuide
        purpose="Comparar a quantidade física com o saldo registrado sem depender da memória operacional."
        doNext="Selecione o ambiente, abra ou importe uma contagem e revise todas as diferenças."
        result="Somente gestores ou administradores aplicam ajustes rastreáveis no estoque."
        roleNote={canFinish ? 'Você pode contar, revisar, importar e finalizar.' : 'Você pode abrir sessões e registrar contagens.'}
      />
      <ContextHelp
        title="Por que fazer um inventário?"
        description="Inventário é a contagem física do que realmente existe em um ambiente. Serve para corrigir diferenças entre o saldo registrado e o estoque real."
        steps={[
          'Selecione o ambiente.',
          'Conte ou importe as quantidades físicas.',
          'Confira a prévia do saldo registrado e da diferença.',
          'Somente proprietário, gerente ou administrador finaliza.',
        ]}
        result="O sistema cria ajustes rastreáveis em vez de sobrescrever o saldo às cegas."
      />
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <Card>
        <h2>Modelo de contagem</h2>
        <p className="field-help">Baixe a planilha do ambiente selecionado, preencha a coluna “Quantidade contada” e importe o arquivo para revisar antes de finalizar.</p>
        <div className="inventory-template-actions">
          <button className="secondary-button" type="button" onClick={() => setTemplatePreviewOpen(true)}>Visualizar modelo</button>
          <a className="secondary-button" href={`${import.meta.env.BASE_URL}modelo-contagem.xlsx`} download="modelo-contagem.xlsx">Baixar modelo padrão XLSX</a>
          <a className="secondary-button" href={`${import.meta.env.BASE_URL}modelo-contagem.csv`} download="modelo-contagem.csv">Baixar modelo padrão CSV</a>
          <button className="secondary-button" type="button" onClick={downloadCsvTemplate}>Gerar CSV personalizado do ambiente</button>
          {canFinish && (
            <>
              <button className="secondary-button" type="button" onClick={downloadTemplate}>Gerar XLSX personalizado do ambiente</button>
              <label className="secondary-button inventory-template-import">Importar contagem
                <input type="file" accept=".xlsx,.xls,.csv,text/csv" onChange={(event) => void readCountFile(event)} disabled={!environmentId} />
              </label>
            </>
          )}
        </div>
        {countImportName && <p className="field-help">Arquivo selecionado: {countImportName}</p>}
        {countImportPreview.length > 0 && (
          <>
            {countImportPreview.some((row) => !row.productId) && (
              <div className="inventory-import-warning" role="alert">
                <strong>Produtos ausentes encontrados</strong>
                <p>O inventário não cria produtos automaticamente. Cadastre os itens ausentes somente após confirmar nome, unidade e medida. Você poderá revisar antes de aplicar.</p>
                <ActionButton
                  className="secondary-button"
                  busyLabel="Cadastrando..."
                  confirmMessage="Cadastrar automaticamente os produtos não encontrados nesta contagem com nome, código, unidade e medida informados?"
                  onAction={createMissingProducts}
                >
                  Cadastrar produtos ausentes
                </ActionButton>
              </div>
            )}
            <div className="table-wrap">
              <table>
                <thead><tr><th>Linha</th><th>Código</th><th>Produto</th><th>Quantidade</th><th>Resultado</th></tr></thead>
                <tbody>
                  {countImportPreview.map((row) => (
                    <tr key={`${row.line}-${row.code}-${row.name}`}>
                      <td>{row.line}</td><td>{row.code || '-'}</td><td>{row.name || '-'}</td><td>{Number.isFinite(row.quantity) ? row.quantity : '-'}</td><td>{row.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ActionButton
              className="primary-button"
              disabled={!countImportPreview.some((row) => row.valid)}
              busyLabel="Importando..."
              confirmMessage={`Aplicar todas as ${countImportPreview.filter((row) => row.valid).length} linha(s) desta contagem como uma única operação?`}
              onAction={applyCountImport}
            >
              Aplicar contagem
            </ActionButton>
          </>
        )}
      </Card>
      <Card>
        <h2>Fechamento diário de ambiente</h2>
        <p className="field-help">Informe o saldo físico inicial e final de um ambiente de trabalho. O app conciliará retiradas, entradas diretas, vendas, perdas e devoluções registradas no período.</p>
        <div className="form-grid">
          <label>Ambiente de destino
            <select value={destinationEnvironmentId} onChange={(event) => setDestinationEnvironmentId(event.target.value)}>
              <option value="">Selecione</option>
              {environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>Produto
            <select value={boatProductId} onChange={(event) => setBoatProductId(event.target.value)}>
              <option value="">Selecione</option>
              {products.map((item) => <option key={item.id} value={item.id}>{item.name}{item.sku ? ` • ${item.sku}` : ''}</option>)}
            </select>
          </label>
          <label>Saldo inicial do dia
            <input type="number" min="0" step="0.001" value={boatInitialBalance} onChange={(event) => setBoatInitialBalance(Number(event.target.value))} />
          </label>
          <label>Saldo físico final
            <input type="number" min="0" step="0.001" value={boatFinalBalance} onChange={(event) => setBoatFinalBalance(Number(event.target.value))} />
          </label>
          <ActionButton
            className="primary-button"
            onAction={analyzeBoatDay}
            disabled={loading || !destinationEnvironmentId || !boatProductId}
            busyLabel="Analisando..."
          >
            Conciliar dia
          </ActionButton>
        </div>
        {boatAnalysis && (
          <div className={`stock-gap-result ${boatAnalysis.status}`}>
            <div><small>Retirado</small><strong>{boatAnalysis.withdrawn}</strong></div>
            <div><small>Entrada direta no ambiente</small><strong>{boatAnalysis.directPurchase}</strong></div>
            <div><small>Vendido</small><strong>{boatAnalysis.sold}</strong></div>
            <div><small>Devolvido</small><strong>{boatAnalysis.returned}</strong></div>
            <div><small>Perdas</small><strong>{boatAnalysis.losses}</strong></div>
            <div><small>Saldo esperado</small><strong>{boatAnalysis.expectedDestinationBalance}</strong></div>
            <div><small>Diferença</small><strong>{boatAnalysis.unexplainedDifference}</strong></div>
            <p>{boatAnalysis.summary}</p>
            {boatAnalysis.directPurchase > 0 && (
              <p>Houve entrada direta no ambiente de destino. Essa quantidade não veio do ambiente de origem e deve ser considerada na devolução e nas vendas do dia.</p>
            )}
          </div>
        )}
      </Card>
      {templatePreviewOpen && (
        <div className="purchase-preview-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setTemplatePreviewOpen(false)
        }}>
          <section className="purchase-preview-modal inventory-template-preview" role="dialog" aria-modal="true" aria-labelledby="inventory-template-preview-title">
            <header className="purchase-preview-header">
              <div>
                <small>Visualização da planilha</small>
                <h2 id="inventory-template-preview-title">Modelo de contagem</h2>
                <p>{environmentId ? environments.find((item) => item.id === environmentId)?.name ?? 'Ambiente selecionado' : 'Todos os ambientes'} • {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())}</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => setTemplatePreviewOpen(false)}>Fechar</button>
            </header>
            <div className="inventory-template-sheet">
              <div className="inventory-template-brand">
                <img src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="" />
                <div><strong>Controle-App</strong><span>Controle de estoque e inventário</span></div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Código</th><th>Tipo/Categoria</th><th>Produto</th><th>Unidade</th><th>Volume/Peso</th><th>Dose (ml)</th><th>Ambiente</th><th>Quantidade contada</th><th>Observações</th></tr>
                  </thead>
                  <tbody>
                    {products.slice(0, 12).map((product) => (
                      <tr key={product.id}>
                        <td>{product.sku || '-'}</td>
                        <td>{categories.find((category) => category.id === product.category_id)?.name || '-'}</td>
                        <td>{product.name}</td>
                        <td>{product.unit || 'un'}</td>
                        <td>{product.volume_ml ?? '-'}</td>
                        <td>{product.dose_ml ?? '-'}</td>
                        <td>{environmentId ? environments.find((item) => item.id === environmentId)?.name ?? 'Ambiente' : 'Todos'}</td>
                        <td></td>
                        <td></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <footer className="purchase-preview-footer">
              <div><span>Modelo completo</span><strong>{products.length} produto(s)</strong></div>
              <div className="purchase-preview-actions">
                <button className="secondary-button" type="button" onClick={() => setTemplatePreviewOpen(false)}>Fechar</button>
                <button className="primary-button" type="button" onClick={downloadTemplate}>Baixar XLSX</button>
              </div>
            </footer>
          </section>
        </div>
      )}
      <Card>
        <h2>Encontrar furo entre contagens</h2>
        <p className="field-help">Compare as duas últimas contagens finalizadas de um produto e veja quanto do saldo pode ser explicado por entradas, vendas, perdas, transferências e ajustes.</p>
        <div className="form-grid">
          <label>Ambiente
            <select value={environmentId} onChange={(event) => setEnvironmentId(event.target.value)}>
              <option value="">Selecione</option>
              {environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label>Produto
            <select value={gapProductId} onChange={(event) => setGapProductId(event.target.value)}>
              <option value="">Selecione</option>
              {products.map((item) => <option key={item.id} value={item.id}>{item.name}{item.sku ? ` • ${item.sku}` : ''}</option>)}
            </select>
          </label>
          <ActionButton className="primary-button" onAction={analyzeGap} disabled={loading || !environmentId || !gapProductId} busyLabel="Analisando...">Analisar período</ActionButton>
        </div>
        {gapAnalysis && (
          <div className={`stock-gap-result ${gapAnalysis.status}`}>
            <div>
              <small>Saldo esperado</small>
              <strong>{gapAnalysis.expectedFinal}</strong>
            </div>
            <div>
              <small>Contado no fim</small>
              <strong>{gapAnalysis.finalCount}</strong>
            </div>
            <div>
              <small>Furo não explicado</small>
              <strong>{gapAnalysis.unexplainedGap}</strong>
            </div>
            <p>{gapAnalysis.summary}</p>
            <dl>
              <div><dt>Contagem inicial</dt><dd>{gapAnalysis.initialCount}</dd></div>
              <div><dt>Entradas</dt><dd>{gapAnalysis.entradas}</dd></div>
              <div><dt>Saídas</dt><dd>{gapAnalysis.saidas}</dd></div>
              <div><dt>Vendas</dt><dd>{gapAnalysis.sales}</dd></div>
              <div><dt>Perdas</dt><dd>{gapAnalysis.losses}</dd></div>
              <div><dt>Transferências</dt><dd>{gapAnalysis.transferenciasSaida} saída / {gapAnalysis.transferenciasEntrada} entrada</dd></div>
              <div><dt>Ajustes</dt><dd>{gapAnalysis.ajustes}</dd></div>
              <div><dt>Estornos</dt><dd>{gapAnalysis.estornos}</dd></div>
            </dl>
          </div>
        )}
      </Card>
      {canFinish && (
        <Card>
          <h2>Zerar estoque</h2>
          <p className="field-help">Zera o saldo no ambiente selecionado. Escolha um produto específico ou “Todos os produtos” para aplicar a todos.</p>
          <div className="form-grid">
            <label>Ambiente
              <select value={environmentId} onChange={(event) => setEnvironmentId(event.target.value)}>
                <option value="">Selecione</option>
                {environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>Produto
              <select value={zeroProductId} onChange={(event) => setZeroProductId(event.target.value)}>
                <option value="">Todos os produtos</option>
                {products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>Motivo<input value={zeroReason} onChange={(event) => setZeroReason(event.target.value)} placeholder="Ex.: acerto físico de contagem" /></label>
          </div>
          <ActionButton className="danger-button" disabled={!environmentId || !zeroReason.trim()} disabledReason={!environmentId ? 'Selecione o ambiente' : 'Informe o motivo da zeragem'} busyLabel="Zerando..." confirmMessage="Confirma zerar o estoque selecionado?" onAction={zero}>Confirmar zeragem</ActionButton>
        </Card>
      )}
      <Card>
        <p className="field-help">Inicie uma sessão para registrar a contagem física dos produtos neste ambiente.</p>
        <label>Ambiente
          <select value={environmentId} onChange={(event) => setEnvironmentId(event.target.value)}>
            <option value="">Selecione</option>
            {environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <ActionButton className="primary-button" onAction={open} disabled={loading || !environmentId} disabledReason={loading ? 'Aguarde a operação atual' : 'Selecione o ambiente'} busyLabel="Abrindo...">Abrir sessão</ActionButton>
      </Card>
      {sessionId && (
        <Card>
          <h2>Contagem</h2>
          {products.map((item) => (
            <div className="member-row" key={item.id}>
              <strong>{item.name}</strong>
              <span>{counted.has(item.id) ? 'Contado' : 'Não contado'}</span>
              <input
                type="number"
                min="0"
                step="0.001"
                value={counts[item.id] ?? ''}
                onChange={(event) => setCounts({ ...counts, [item.id]: Number(event.target.value) })}
                placeholder="Quantidade contada"
              />
              <ActionButton
                className="secondary-button"
                onAction={() => save(item.id)}
                busyLabel="Salvando..."
                confirmMessage={`Confirmar a contagem de "${item.name}" como ${counts[item.id] ?? 0}?`}
              >
                Salvar
              </ActionButton>
            </div>
          ))}
        </Card>
      )}
      {sessionId && canFinish && preview === null && (
        <Card>
          <ActionButton className="primary-button" onAction={previewDifferences} disabled={loading} busyLabel="Calculando...">Prévia das diferenças</ActionButton>
        </Card>
      )}
      {sessionId && canFinish && preview !== null && (
        <Card>
          <h2>Confirmar diferenças</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Produto</th><th>Contado</th><th>Saldo anterior</th><th>Diferença</th><th>Diferença em doses</th></tr></thead>
              <tbody>
                {preview.map((row) => (
                  <tr key={row.product_id}>
                    <td>{row.productName}</td><td>{row.counted}</td><td>{row.balanceBefore}</td><td>{row.difference}</td><td>{row.differenceDoses ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="member-actions">
            <button className="secondary-button" type="button" onClick={() => setPreview(null)}>Voltar</button>
            <ActionButton className="primary-button" onAction={confirmFinish} disabled={loading} busyLabel="Finalizando..." confirmMessage="Confirmar e aplicar as diferenças do inventário?">Confirmar finalização</ActionButton>
          </div>
        </Card>
      )}
    </Container>
  )
}
