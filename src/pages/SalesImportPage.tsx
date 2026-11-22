import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { NavLink } from 'react-router-dom'
import { useCompanies } from '../features/company/company-context'
import { Container, Card, ActionButton } from '../components'
import { tryGetSupabaseClient } from '../lib/supabase'
import {
  hashSalesFile,
  calculateSalesFinancials,
  parseSalesFile,
  parseSalesRows,
  validateSalesPricing,
  validateSalesPreview,
  type SalesPreviewItem,
} from '../features/sales/salesRules'
import {
  importSalesBatch,
  listProductEnvironmentPricing,
  listSalesImports,
  listSalesMap,
  removeSalesMap,
  saveSalesMap,
  undoSalesImport,
  type ProductEnvironmentPricing,
  type SalesImportBatchRow,
  type SalesMapRow,
} from '../features/sales/salesService'
import { normalizeExternalName } from '../features/sales/salesRules'
import { traduzirErro } from '../lib/errors'

function formatCurrency(value: number | null) {
  return value == null
    ? 'Não disponível'
    : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function SalesImportPage() {
  const { activeCompany, role, isAdmin } = useCompanies()
  const [tab, setTab] = useState<'importar' | 'mapa' | 'historico'>('importar')
  const [environments, setEnvironments] = useState<Array<{ id: string; name: string }>>([])
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([])
  const [environmentId, setEnvironmentId] = useState('')
  const [environmentsCompanyId, setEnvironmentsCompanyId] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [columns, setColumns] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([])
  const [mapping, setMapping] = useState({ name: '', quantity: '', saleType: '' })
  const [preview, setPreview] = useState<SalesPreviewItem[]>([])
  const [pricing, setPricing] = useState<ProductEnvironmentPricing[]>([])
  const [pricingLoading, setPricingLoading] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [mapRows, setMapRows] = useState<SalesMapRow[]>([])
  const [history, setHistory] = useState<SalesImportBatchRow[]>([])
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [fileHashes, setFileHashes] = useState<Set<string>>(new Set())
  const [undoStep, setUndoStep] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!activeCompany) return
    const supabase = tryGetSupabaseClient()
    if (!supabase) return
    const [envResult, productResult] = await Promise.all([
      supabase.from('environments').select('id,name').eq('company_id', activeCompany.id).eq('active', true),
      supabase.from('products').select('id,name').eq('company_id', activeCompany.id).eq('active', true),
    ])
    const nextEnvironments = (envResult.data ?? []).map((item) => ({ id: item.id, name: item.name }))
    setEnvironments(nextEnvironments)
    setEnvironmentsCompanyId(activeCompany.id)
    setEnvironmentId((current) => nextEnvironments.some((item) => item.id === current)
      ? current
      : nextEnvironments[0]?.id ?? '')
    setProducts((productResult.data ?? []).map((item) => ({ id: item.id, name: item.name })))
    try {
      setMapRows(await listSalesMap(activeCompany.id))
      setHistory(await listSalesImports(activeCompany.id))
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível carregar vendas.'))
    }
  }, [activeCompany])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      setEnvironments([])
      setEnvironmentsCompanyId(null)
      setEnvironmentId('')
      setPricing([])
      if (activeCompany) void load()
    })
    return () => { cancelled = true }
  }, [activeCompany, load])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      if (!activeCompany || environmentsCompanyId !== activeCompany.id
        || !environmentId || !environments.some((item) => item.id === environmentId)) {
        setPricing([])
        setPricingLoading(false)
        return
      }
      setPricingLoading(true)
      setError('')
      void listProductEnvironmentPricing(activeCompany.id, environmentId)
        .then((result) => { if (!cancelled) setPricing(result) })
        .catch((caught) => {
          if (!cancelled) setError(traduzirErro(caught, 'Não foi possível carregar os preços deste ambiente.'))
        })
        .finally(() => { if (!cancelled) setPricingLoading(false) })
    })
    return () => { cancelled = true }
  }, [activeCompany, environmentId, environments, environmentsCompanyId])

  if (!isAdmin && role !== 'owner' && role !== 'manager') {
    return <Container><h1>Importar vendas</h1><Card><p>Acesso restrito a proprietários e gerentes.</p></Card></Container>
  }

  const readFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    try {
      const hash = await hashSalesFile(file)
      if (fileHashes.has(hash)) setMessage('Este arquivo já foi usado nesta sessão. Confirme novamente apenas se deseja repetir.')
      setFileHashes((current) => new Set(current).add(hash))
      const rows = await parseSalesFile(file)
      setRawRows(rows)
      const names = rows[0] ? Object.keys(rows[0]) : []
      setColumns(names)
      setMapping({
        name: names.find((name) => /nome|item|produto/i.test(name)) ?? '',
        quantity: names.find((name) => /quant|qtd|valor/i.test(name)) ?? '',
        saleType: names.find((name) => /tipo|dose|unidade/i.test(name)) ?? '',
      })
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível ler o arquivo.'))
    }
  }

  const buildPreview = () => {
    const items = parseSalesRows(rawRows, mapping)
    const normalizedMap = new Map(mapRows.map((row) => [normalizeExternalName(row.external_name), row.product_id]))
    setPreview(items.map((item) => ({
      ...item,
      productId: normalizedMap.get(normalizeExternalName(item.externalName)) ?? null,
    })))
    setPreviewOpen(true)
  }

  const rememberLink = async (index: number) => {
    if (!activeCompany || !environmentId) return
    const item = preview[index]
    if (!item.productId) return
    await saveSalesMap(activeCompany.id, item.externalName, item.productId, environmentId)
    setMapRows(await listSalesMap(activeCompany.id))
  }

  const confirmImport = async () => {
    if (!activeCompany || !environmentId) {
      setError('Selecione o ambiente.')
      return
    }
    const validation = validateSalesPreview(preview)
    if (validation) {
      setError(validation)
      return
    }
    if (pricingLoading) {
      setError('Aguarde o carregamento dos preços antes de confirmar.')
      return
    }
    const priceValidation = validateSalesPricing(
      preview,
      new Map(pricing.map((item) => [item.product_id, item])),
    )
    if (priceValidation) {
      setError(priceValidation)
      return
    }
    setError('')
    try {
      await importSalesBatch(
        activeCompany.id,
        environmentId,
        label || 'Importação de vendas',
        preview.filter((item) => !item.ignored && item.productId).map((item) => ({
          product_id: item.productId!,
          quantity: item.quantity,
          sale_type: item.saleType,
        })),
      )
      setMessage('Importação aplicada.')
      setPreviewOpen(false)
      await load()
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível importar as vendas.'))
    }
  }

  const undo = async (batchId: string) => {
    if (undoStep !== batchId) {
      setUndoStep(batchId)
      return
    }
    setError('')
    try {
      await undoSalesImport(batchId)
      setUndoStep(null)
      setMessage('Importação desfeita.')
      await load()
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível desfazer.'))
    }
  }

  return (
    <Container>
      <h1>Importar vendas</h1>
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      <Card>
        <div className="sales-view-switch" role="group" aria-label="Seções da importação de vendas">
          <button type="button" className={tab === 'importar' ? 'primary-button' : 'secondary-button'} aria-pressed={tab === 'importar'} onClick={() => setTab('importar')}>Importar</button>
          <button type="button" className={tab === 'mapa' ? 'primary-button' : 'secondary-button'} aria-pressed={tab === 'mapa'} onClick={() => setTab('mapa')}>Mapa</button>
          <button type="button" className={tab === 'historico' ? 'primary-button' : 'secondary-button'} aria-pressed={tab === 'historico'} onClick={() => setTab('historico')}>Histórico</button>
        </div>
      </Card>
      {tab === 'importar' && (
        <Card>
          <div className="form-grid">
            <label>Ambiente
              <select value={environmentId} onChange={(event) => setEnvironmentId(event.target.value)}>
                <option value="">Selecione</option>
                {environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <label>Rótulo / evento<input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Ex.: Bar VIP — 21/11" aria-describedby="sales-import-help" /></label>
            <label>Arquivo CSV ou XLSX<input type="file" accept=".csv,.xlsx,.xls" onChange={(event) => void readFile(event)} /></label>
          </div>
          <p className="field-help" id="sales-import-help">O rótulo identifica esta importação no histórico. Depois de selecionar o arquivo, confira as colunas e gere uma prévia antes de confirmar.</p>
          {columns.length > 0 && (
            <div className="form-grid">
              <label>Nome do item<select value={mapping.name} onChange={(event) => setMapping({ ...mapping, name: event.target.value })}>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label>
              <label>Quantidade<select value={mapping.quantity} onChange={(event) => setMapping({ ...mapping, quantity: event.target.value })}>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label>
              <label>Tipo<select value={mapping.saleType} onChange={(event) => setMapping({ ...mapping, saleType: event.target.value })}><option value="">Detectar unidade</option>{columns.map((column) => <option key={column} value={column}>{column}</option>)}</select></label>
            </div>
          )}
          {columns.length > 0 && <p className="field-help">Associe cada campo à coluna correspondente do arquivo. Em Tipo, “Detectar unidade” deixa o sistema interpretar a unidade automaticamente.</p>}
          {rawRows.length > 0 && <button className="primary-button" type="button" onClick={buildPreview}>Prévia</button>}
        </Card>
      )}
      {previewOpen && (
        <Card>
          <h2>Prévia da venda</h2>
          <p className="field-help">
            Confira faturamento e CMV estimados com os preços cadastrados para o ambiente selecionado.
            Se faltar um preço, configure-o em <NavLink to="/vendas/precos">Preços de venda</NavLink>.
            {pricingLoading && ' Carregando preços...'}
          </p>
          {(() => {
            const selectedItems = preview.filter((item) => !item.ignored)
            const totals = selectedItems.map((item) => calculateSalesFinancials(
              item,
              item.productId ? pricing.find((row) => row.product_id === item.productId) : undefined,
            ))
            const sumIfComplete = (values: Array<number | null>) => values.some((value) => value == null)
              ? null
              : values.reduce<number>((total, value) => total + (value ?? 0), 0)
            const revenue = sumIfComplete(totals.map((item) => item.revenue))
            const cogs = sumIfComplete(totals.map((item) => item.costOfGoodsSold))
            const grossProfit = revenue == null || cogs == null
              ? null
              : Math.round((revenue - cogs + Number.EPSILON) * 100) / 100
            return <p><strong>Faturamento:</strong> {formatCurrency(revenue)} <span aria-hidden="true"> • </span><strong>CMV:</strong> {formatCurrency(cogs)} <span aria-hidden="true"> • </span><strong>Lucro bruto:</strong> {formatCurrency(grossProfit)}</p>
          })()}
          {preview.map((item, index) => (
            <article className="member-row" key={`${item.externalName}-${index}`}>
              <div>
                <strong>{item.externalName}</strong>
                <span>{item.quantity} • {item.saleType}</span>
                {!item.ignored && (() => {
                  const financials = calculateSalesFinancials(
                    item,
                    item.productId ? pricing.find((row) => row.product_id === item.productId) : undefined,
                  )
                  return <small>
                    Faturamento: {formatCurrency(financials.revenue)} • CMV: {formatCurrency(financials.costOfGoodsSold)}
                  </small>
                })()}
              </div>
              <label>Produto
                <select value={item.productId ?? ''} onChange={(event) => setPreview((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, productId: event.target.value || null } : row))}>
                  <option value="">Sem correspondência</option>
                  {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
              </label>
              <label className="check-label"><input type="checkbox" checked={item.ignored} onChange={(event) => setPreview((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ignored: event.target.checked } : row))} /> Ignorar</label>
              {item.productId && <ActionButton className="secondary-button" busyLabel="Salvando..." onAction={() => rememberLink(index)}>Lembrar vínculo</ActionButton>}
            </article>
          ))}
          <ActionButton className="primary-button" onAction={confirmImport} busyLabel="Importando..." confirmMessage="Confirmar esta importação de vendas?">Confirmar importação</ActionButton>
        </Card>
      )}
      {tab === 'mapa' && (
        <Card>
          <h2>Mapa de produtos</h2>
          {mapRows.length === 0 ? <p>Nenhum vínculo cadastrado. Ao importar, selecione um produto e use “Lembrar vínculo”.</p> : mapRows.map((row) => (
            <article className="member-row" key={row.map_id}>
              <div><strong>{row.external_name}</strong><span>{row.product_name}</span></div>
              {activeCompany && <ActionButton className="danger-button" busyLabel="Removendo..." confirmMessage="Remover este vínculo de produto?" onAction={async () => { await removeSalesMap(activeCompany.id, row.map_id); await load() }}>Remover</ActionButton>}
            </article>
          ))}
        </Card>
      )}
      {tab === 'historico' && (
        <Card>
          <h2>Histórico de importações</h2>
          {history.length === 0 ? <p>Nenhuma importação encontrada. Use a aba Importar para enviar o primeiro arquivo.</p> : history.map((item) => (
            <article className="member-row" key={item.batch_id}>
              <div>
                <strong>{item.label}</strong>
                <span>{item.status === 'applied' ? 'Aplicada' : 'Desfeita'} • {item.total_items} itens • {item.total_quantity}</span>
                <small>
                  {item.total_revenue == null
                    ? 'Dados financeiros indisponíveis para esta importação.'
                    : `Faturamento: ${formatCurrency(item.total_revenue)} • CMV: ${item.total_cogs == null ? 'não calculado (custo ausente)' : formatCurrency(item.total_cogs)} • Lucro bruto: ${formatCurrency(item.total_gross_profit)}`}
                </small>
                <small>{item.imported_by_name} • {new Date(item.imported_at).toLocaleString('pt-BR')}</small>
              </div>
              {item.status === 'applied' && <ActionButton className="danger-button" busyLabel="Desfazendo..." onAction={() => undo(item.batch_id)} confirmMessage="Desfazer a importação inteira?">{undoStep === item.batch_id ? 'Confirmar desfazer' : 'Desfazer importação'}</ActionButton>}
            </article>
          ))}
        </Card>
      )}
    </Container>
  )
}
