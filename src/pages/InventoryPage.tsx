import { useEffect, useState } from 'react'
import { useCompanies } from '../features/company/company-context'
import { tryGetSupabaseClient } from '../lib/supabase'
import { finishInventory, getStockBalance, openInventory, submitInventoryCount, zeroStock } from '../services/movements'
import { Container, Card, ActionButton } from '../components'
import { traduzirErro } from '../lib/errors'

type SimpleItem = { id: string; name: string; volume_ml?: number | null; dose_ml?: number | null }
type DifferenceRow = { product_id: string; productName: string; counted: number; balanceBefore: number; difference: number; differenceDoses?: number }

export function InventoryPage() {
  const { activeCompany, isAdmin, role } = useCompanies()
  const companyId = activeCompany?.id
  const [environments, setEnvironments] = useState<SimpleItem[]>([])
  const [products, setProducts] = useState<SimpleItem[]>([])
  const [environmentId, setEnvironmentId] = useState('')
  const [sessionId, setSessionId] = useState('')
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [counted, setCounted] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<DifferenceRow[] | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [zeroReason, setZeroReason] = useState('')
  const [zeroProductId, setZeroProductId] = useState('')

  useEffect(() => {
    if (!companyId) return
    const supabase = tryGetSupabaseClient()
    if (!supabase) return
    queueMicrotask(() => {
      void Promise.all([
        supabase.from('environments').select('*').eq('company_id', companyId).eq('active', true),
        supabase.from('products').select('id,name,volume_ml,dose_ml').eq('company_id', companyId).eq('active', true),
      ]).then(([environmentResult, productResult]) => {
        setEnvironments((environmentResult.data ?? []).map((item) => ({ id: item.id, name: item.name })))
        setProducts((productResult.data ?? []).map((item) => ({ id: item.id, name: item.name })))
      })
    })
  }, [companyId])

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
      const rows = (countResult.data ?? []).map((count) => {
        const balanceBefore = Number(balances.find((balance) => balance.product_id === count.product_id)?.balance ?? 0)
        const countedQuantity = Number(count.counted_quantity)
        return {
          product_id: count.product_id,
          productName: products.find((item) => item.id === count.product_id)?.name ?? count.product_id,
          counted: countedQuantity,
          balanceBefore,
          difference: countedQuantity - balanceBefore,
          differenceDoses: (() => {
            const product = products.find((item) => item.id === count.product_id)
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

  const canFinish = !isAdmin && (role === 'owner' || role === 'manager')

  return (
    <Container>
      <h1>Inventário cego</h1>
      {error && <p className="form-error" role="alert">{error}</p>}
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
          <ActionButton className="danger-button" disabled={!environmentId || !zeroReason.trim()} busyLabel="Zerando..." confirmMessage="Confirma zerar o estoque selecionado?" onAction={zero}>Confirmar zeragem</ActionButton>
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
        <ActionButton className="primary-button" onAction={open} disabled={loading || !environmentId} busyLabel="Abrindo...">Abrir sessão</ActionButton>
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
              <ActionButton className="secondary-button" onAction={() => save(item.id)} busyLabel="Salvando...">Salvar</ActionButton>
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
