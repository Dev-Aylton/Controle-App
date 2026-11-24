import { useCallback, useEffect, useState, type ChangeEvent } from 'react'
import { useCompanies } from '../features/company/company-context'
import { useAuth } from '../features/auth/auth-context'
import { tryGetSupabaseClient } from '../lib/supabase'
import { Container, Card, ActionButton, ContextHelp, PageGuide } from '../components'
import { MovementLaunchForm } from '../features/movements/MovementLaunchForm'
import { MovementHistory } from '../features/movements/MovementHistory'
import type { Movement, MovementEnvironment, MovementProduct } from '../features/movements/types'
import { canReverseMovement } from '../features/movements/rules'
import { applyMovementBatch, applyMovementEntryBatch, getStockBalance, reverseMovement } from '../services/movements'
import { completePendingLossReason, getMyPendingLossReasons, listLossReasons, seedLossReasons, type LossReason, type PendingLossMovement } from '../features/movements/lossReasons'
import { getPendingLossReasons } from '../features/management/management'
import type { PendingLoss } from '../features/management/types'
import { traduzirErro } from '../lib/errors'
import { useConfirm } from '../components/confirmContext'
import {
  downloadBatchEntryTemplate,
  downloadBatchEntryCsvTemplate,
  findBatchEntryProduct,
  parseBatchEntryFile,
  suggestBatchEntryProducts,
  type BatchEntryRow,
  type BatchEntryMatch,
} from '../features/movements/batchEntryTemplate'
import { cacheMovementCatalog, getCachedMovementCatalog } from '../features/offline/sync'

export function MovementsPage() {
  const { activeCompany, role, isAdmin } = useCompanies()
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [environments, setEnvironments] = useState<MovementEnvironment[]>([])
  const [products, setProducts] = useState<MovementProduct[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [profiles, setProfiles] = useState<Array<{ id: string; name: string }>>([])
  const [initial, setInitial] = useState<{ productId?: string; environmentId?: string; type?: 'entrada'|'saida'|'perda'; quantity?: number }>()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [lossReasons, setLossReasons] = useState<LossReason[]>([])
  const [pendingLosses, setPendingLosses] = useState<Array<PendingLoss | PendingLossMovement>>([])
  const [selectedPending, setSelectedPending] = useState('')
  const [pendingReason, setPendingReason] = useState('')
  const [batchEnvironmentId, setBatchEnvironmentId] = useState('')
  const [batchFileName, setBatchFileName] = useState('')
  const [batchPreview, setBatchPreview] = useState<BatchEntryMatch[]>([])
  const [batchRows, setBatchRows] = useState<BatchEntryRow[]>([])
  const [manualRows, setManualRows] = useState<Array<{
    id: string
    productId: string
    environmentId: string
    toEnvironmentId: string
    type: 'entrada' | 'saida' | 'perda' | 'transferencia'
    quantity: number
    note: string
  }>>([{
    id: crypto.randomUUID(),
    productId: '',
    environmentId: '',
    toEnvironmentId: '',
    type: 'entrada',
    quantity: 1,
    note: '',
  }])
  const [manualBatchPreview, setManualBatchPreview] = useState<Array<{
    productName: string
    environmentName: string
    type: string
    quantity: number
    available: number | null
    repeated: number
    warning: string | null
  }>>([])
  const confirmAction = useConfirm()

  const load = useCallback(async () => {
    if (!activeCompany) return
    if (!navigator.onLine && userId) {
      setLoading(true)
      setError('')
      try {
        const cached = await getCachedMovementCatalog(userId, activeCompany.id)
        setEnvironments(cached.environments)
        setProducts(cached.products)
        setMovements([])
        setProfiles([])
        setPendingLosses([])
        setLossReasons([])
      } catch (caught) {
        setError(traduzirErro(caught, 'Não foi possível carregar o catálogo offline de movimentações.'))
      } finally {
        setLoading(false)
      }
      return
    }
    const supabase = tryGetSupabaseClient()
    if (!supabase) return
    setLoading(true)
    setError('')
    const [environmentResult, productResult, movementResult] = await Promise.all([
      supabase.from('environments').select('id,name').eq('company_id', activeCompany.id).eq('active', true),
      supabase.from('products').select('id,name,sku,unit,volume_ml,dose_ml,weight_g').eq('company_id', activeCompany.id).eq('active', true),
      supabase.from('stock_movements').select('*').eq('company_id', activeCompany.id).order('created_at', { ascending: false }).limit(100),
    ])
    if (environmentResult.error) setError(traduzirErro(environmentResult.error, 'Não foi possível carregar ambientes.'))
    if (productResult.error) setError(traduzirErro(productResult.error, 'Não foi possível carregar produtos.'))
    if (movementResult.error) setError(traduzirErro(movementResult.error, 'Não foi possível carregar movimentações.'))
    setEnvironments((environmentResult.data ?? []) as MovementEnvironment[])
    setProducts((productResult.data ?? []) as MovementProduct[])
    setMovements((movementResult.data ?? []) as Movement[])
    if (userId) {
      await cacheMovementCatalog(
        userId,
        activeCompany.id,
        (productResult.data ?? []) as Array<{
          id: string
          name: string
          unit: string
          sku?: string | null
          volume_ml?: number | null
          dose_ml?: number | null
          weight_g?: number | null
        }>,
        (environmentResult.data ?? []) as Array<{ id: string; name: string }>,
      )
    }
    try {
      if (isAdmin || role === 'owner' || role === 'manager') {
        setPendingLosses(await getPendingLossReasons(activeCompany.id))
      } else {
        setPendingLosses(await getMyPendingLossReasons(activeCompany.id))
      }
      setLossReasons(await listLossReasons(activeCompany.id))
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível carregar os motivos pendentes.'))
    }
    const userIds = [...new Set((movementResult.data ?? []).map((item) => item.created_by).filter((id): id is string => Boolean(id)))]
    if (userIds.length) {
      const profileResult = await supabase.from('profiles').select('id,name').in('id', userIds)
      setProfiles((profileResult.data ?? []).map((item) => ({ id: item.id, name: item.name ?? 'Usuário sem nome' })))
    }
    setLoading(false)
  }, [activeCompany, isAdmin, role, userId])

  useEffect(() => {
    if (activeCompany) queueMicrotask(() => { void load() })
  }, [activeCompany, load])

  const canHistory = isAdmin || role === 'owner' || role === 'manager'
  const canLaunch = isAdmin || role === 'owner' || role === 'manager' || role === 'employee'

  const movementTypeLabel: Record<Movement['type'], string> = {
    entrada: 'Entrada',
    saida: 'Saída',
    perda: 'Perda',
    ajuste_inventario: 'Ajuste de inventário',
    transferencia_saida: 'Transferência — saída',
    transferencia_entrada: 'Transferência — entrada',
    estorno: 'Estorno',
    zeragem: 'Zeragem',
  }

  const correctMovement = async (movement: Movement) => {
    const product = products.find((item) => item.id === movement.product_id)
    setInitial({
      productId: movement.product_id,
      environmentId: movement.environment_id,
      type: movement.type === 'entrada' || movement.type === 'saida' || movement.type === 'perda' ? movement.type : 'entrada',
      quantity: movement.quantity,
    })
    setMessage(`Corrigir lançamento de ${product?.name ?? 'produto'}: informe a nova movimentação.`)
  }

  const quickReverse = async (movement: Movement) => {
    setError('')
    setMessage('')
    const confirmed = await confirmAction({
      title: 'Confirmar correção do lançamento',
      message: 'Esta ação estornará o lançamento original. Depois você poderá revisar e registrar uma nova movimentação.',
      confirmLabel: 'Estornar e corrigir',
    })
    if (!confirmed) return
    try {
      await reverseMovement(movement.id)
      await load()
      await correctMovement(movement)
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível corrigir o lançamento. Confira o saldo e tente novamente.'))
    }
  }

  const informPendingReason = async () => {
    if (!selectedPending || !pendingReason) return
    setError('')
    try {
      await completePendingLossReason(selectedPending, pendingReason)
      setSelectedPending('')
      setPendingReason('')
      setMessage('Motivo da perda informado.')
      await load()
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível informar o motivo.'))
    }
  }

  const downloadEntryTemplate = () => {
    if (!batchEnvironmentId) {
      setError('Selecione o ambiente antes de gerar o modelo.')
      return
    }
    const environmentName = environments.find((item) => item.id === batchEnvironmentId)?.name ?? 'Ambiente'
    downloadBatchEntryTemplate(environmentName, products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      volumeMl: product.volume_ml,
      weightG: product.weight_g,
    })))
  }

  const downloadEntryCsvTemplate = () => {
    if (!batchEnvironmentId) {
      setError('Selecione o ambiente antes de gerar o modelo.')
      return
    }
    const environmentName = environments.find((item) => item.id === batchEnvironmentId)?.name ?? 'Ambiente'
    downloadBatchEntryCsvTemplate(environmentName, products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      volumeMl: product.volume_ml,
      weightG: product.weight_g,
    })))
  }

  const readEntryFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setError('')
    setBatchFileName(file.name)
    try {
      const rows = await parseBatchEntryFile(file)
      setBatchRows(rows)
      const ids = new Set<string>()
      setBatchPreview(rows.map((row) => {
        const product = findBatchEntryProduct(row.code, row.name, products.map((item) => ({
          id: item.id,
          name: item.name,
          sku: item.sku,
          unit: item.unit,
          volumeMl: item.volume_ml,
          weightG: item.weight_g,
        })))
        if (!product) {
          const suggestions = suggestBatchEntryProducts(row.code, row.name, products.map((item) => ({
            id: item.id,
            name: item.name,
            sku: item.sku,
            unit: item.unit,
          })))
          return {
            productId: null,
            productName: row.name || 'Produto não informado',
            quantity: row.quantity,
            valid: false,
            message: suggestions.length > 0
              ? `Produto não encontrado. Possíveis correspondências: ${suggestions.map((item) => item.sku ? `${item.name} (${item.sku})` : item.name).join(', ')}.`
              : 'Produto não encontrado. Confira nome/SKU ou cadastre o insumo primeiro.',
            suggestions: suggestions.map((item) => ({ id: item.id, name: item.name, sku: item.sku ?? null })),
          }
        }
        if (!Number.isFinite(row.quantity) || row.quantity <= 0) {
          return {
            productId: product.id,
            productName: product.name,
            quantity: row.quantity,
            valid: false,
            message: 'Quantidade inválida. Informe um número maior que zero.',
          }
        }
        if (ids.has(product.id)) {
          return {
            productId: product.id,
            productName: product.name,
            quantity: row.quantity,
            valid: false,
            message: 'Produto repetido no lote. Mantenha uma única linha por insumo.',
          }
        }
        ids.add(product.id)
        return {
          productId: product.id,
          productName: product.name,
          quantity: row.quantity,
          valid: true,
          message: 'Pronto para entrar no ambiente.',
        }
      }))
    } catch (caught) {
      setBatchRows([])
      setBatchPreview([])
      setError(traduzirErro(caught, 'Não foi possível ler a planilha de entradas.'))
    }
  }

  const applyEntryFile = async () => {
    if (!navigator.onLine) {
      setError('A entrada por planilha precisa estar conectada à internet. Use o lançamento único offline até a sincronização estar disponível.')
      return
    }
    if (!activeCompany || !batchEnvironmentId) return
    if (batchPreview.length === 0) {
      setError('Leia uma planilha com ao menos uma entrada.')
      return
    }
    if (batchPreview.some((row) => !row.valid || !row.productId)) {
      setError('Corrija todas as linhas da prévia antes de aplicar o lote.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await applyMovementEntryBatch(
        activeCompany.id,
        batchEnvironmentId,
        batchPreview.map((row) => ({
          product_id: row.productId!,
          quantity: row.quantity,
          note: batchRows.find((sourceRow) => {
            const product = findBatchEntryProduct(sourceRow.code, sourceRow.name, products.map((item) => ({
              id: item.id,
              name: item.name,
              sku: item.sku,
              unit: item.unit,
            })))
            return product?.id === row.productId
          })?.note || null,
        })),
        crypto.randomUUID(),
      )
      setMessage(`${batchPreview.length} entrada(s) aplicada(s) ao ambiente com sucesso.`)
      setBatchPreview([])
      setBatchRows([])
      setBatchFileName('')
      await load()
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível aplicar o lote de entradas. Nenhum registro foi alterado.'))
    } finally {
      setLoading(false)
    }
  }

  const updateManualRow = (id: string, field: 'productId' | 'environmentId' | 'toEnvironmentId' | 'type' | 'quantity' | 'note', value: string | number) => {
    setManualRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } as typeof row : row))
    setManualBatchPreview([])
  }

  const addManualRow = () => {
    setManualRows((current) => [...current, {
      id: crypto.randomUUID(),
      productId: '',
      environmentId: current[0]?.environmentId ?? '',
      toEnvironmentId: '',
      type: 'entrada',
      quantity: 1,
      note: '',
    }])
    setManualBatchPreview([])
  }

  const removeManualRow = (id: string) => {
    setManualRows((current) => current.length === 1 ? current : current.filter((row) => row.id !== id))
    setManualBatchPreview([])
  }

  const previewManualBatch = async () => {
    if (!navigator.onLine) {
      setError('O lote manual precisa estar conectado à internet nesta versão. Use um lançamento único offline.')
      return
    }
    if (!activeCompany) return
    const invalid = manualRows.find((row) =>
      !row.productId
      || !row.environmentId
      || row.quantity <= 0
      || (row.type === 'transferencia' && (!row.toEnvironmentId || row.toEnvironmentId === row.environmentId)),
    )
    if (invalid) {
      setError('Preencha produto, ambiente, quantidade e destino válido em todas as linhas.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const environmentIds = [...new Set(manualRows.flatMap((row) =>
        row.type === 'transferencia' ? [row.environmentId, row.toEnvironmentId] : [row.environmentId],
      ).filter(Boolean))]
      const balances = await Promise.all(environmentIds.map((environmentId) =>
        getStockBalance(activeCompany.id, environmentId),
      ))
      const balanceMap = new Map<string, number>()
      balances.flat().forEach((balance: { product_id: string; environment_id: string; balance: number }) =>
        balanceMap.set(`${balance.product_id}:${balance.environment_id}`, Number(balance.balance)),
      )

      const grouped = new Map<string, typeof manualRows>()
      manualRows.forEach((row) => {
        const key = `${row.productId}:${row.environmentId}:${row.type}:${row.type === 'transferencia' ? row.toEnvironmentId : ''}`
        grouped.set(key, [...(grouped.get(key) ?? []), row])
      })
      const preview = [...grouped.entries()].map(([, rows]) => {
        const row = rows[0]
        const productName = products.find((product) => product.id === row.productId)?.name ?? 'Produto'
        const environmentName = environments.find((environment) => environment.id === row.environmentId)?.name ?? 'Ambiente'
        const quantity = rows.reduce((sum, item) => sum + item.quantity, 0)
        const available = row.type === 'entrada'
          ? null
          : balanceMap.get(`${row.productId}:${row.environmentId}`) ?? 0
        const excess = available == null ? null : Math.max(0, quantity - available)
        return {
          productName,
          environmentName,
          type: row.type,
          quantity,
          available,
          repeated: rows.length,
          warning: excess != null && excess > 0
            ? `Saldo disponível ${available}; quantidade informada ${quantity}; excesso ${excess}.`
            : rows.length > 1
              ? 'Produto repetido em várias linhas; a prévia agrupa a quantidade.'
              : null,
        }
      })
      setManualBatchPreview(preview)
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível preparar a prévia das movimentações.'))
    } finally {
      setLoading(false)
    }
  }

  const applyManualBatch = async () => {
    if (!navigator.onLine) {
      setError('O lote manual precisa estar conectado à internet nesta versão.')
      return
    }
    if (!activeCompany) return
    if (manualBatchPreview.length === 0) {
      setError('Gere e revise a prévia antes de confirmar.')
      return
    }
    if (manualBatchPreview.some((item) => item.warning?.includes('excesso'))) {
      setError('Corrija o excesso de saldo antes de confirmar o lote.')
      return
    }
    const invalid = manualRows.find((row) =>
      !row.productId
      || !row.environmentId
      || row.quantity <= 0
      || (row.type === 'transferencia' && (!row.toEnvironmentId || row.toEnvironmentId === row.environmentId)),
    )
    if (invalid) {
      setError('Preencha produto, ambiente, quantidade e destino válido em todas as linhas.')
      return
    }
    setError('')
    setLoading(true)
    try {
      await applyMovementBatch(
        activeCompany.id,
        manualRows.map((row) => ({
          product_id: row.productId,
          environment_id: row.environmentId,
          to_environment_id: row.type === 'transferencia' ? row.toEnvironmentId : undefined,
          type: row.type,
          quantity: row.quantity,
          note: row.note || null,
        })),
        crypto.randomUUID(),
      )
      setMessage(`${manualRows.length} movimentação(ões) registrada(s) em lote.`)
      setManualRows([{
        id: crypto.randomUUID(),
        productId: '',
        environmentId: '',
        toEnvironmentId: '',
        type: 'entrada',
        quantity: 1,
        note: '',
      }])
      await load()
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível aplicar as movimentações. Nenhum registro válido foi parcialmente alterado.'))
    } finally {
      setLoading(false)
    }
  }

  const seedReasons = async () => {
    if (!activeCompany) return
    setError('')
    try {
      await seedLossReasons(activeCompany.id)
      setLossReasons(await listLossReasons(activeCompany.id))
      setMessage('Motivos padrão cadastrados.')
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível cadastrar os motivos padrão.'))
    }
  }

  return (
    <Container>
      <h1>Movimentações</h1>
      <PageGuide
        purpose="Registrar entradas, saídas, perdas e transferências sem apagar o histórico."
        doNext="Confirme empresa e ambiente, escolha o produto e informe a quantidade real."
        result="O saldo muda de forma rastreável e pode ser corrigido por estorno ou inventário."
        roleNote={canHistory ? 'Você pode lançar, revisar o histórico e estornar movimentações.' : 'Você pode lançar e corrigir somente seus lançamentos recentes.'}
      />
      <ContextHelp
        title="O que são movimentações?"
        description="Movimentações registram tudo que entra, sai, é perdido ou transferido em cada ambiente da empresa."
        steps={[
          'Entrada: compra, reposição ou recebimento.',
          'Saída: consumo, venda direta ou retirada.',
          'Perda: quebra, derramamento, validade ou erro operacional.',
          'Transferência: saída de um ambiente e entrada em outro.',
          'Ciclo diário entre ambientes: retire do ambiente de origem, realize vendas ou consumo no destino e devolva o restante ao ambiente de origem.',
        ]}
        result="O saldo de cada produto e ambiente é atualizado automaticamente."
      />
      {loading && <p className="page-state">Carregando movimentações...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
      {(isAdmin || role === 'owner' || role === 'manager') && lossReasons.length === 0 && (
        <Card>
          <h2>Motivos de perda</h2>
          <p>Cadastre os motivos usados pela planilha: quebra, derramamento, validade, cortesia e outros.</p>
          <ActionButton className="secondary-button" busyLabel="Cadastrando..." onAction={seedReasons}>Cadastrar motivos padrão</ActionButton>
        </Card>
      )}
      {pendingLosses.length > 0 && (
        <Card>
          <h2>Perdas sem motivo</h2>
          <div className="member-list">
            {pendingLosses.map((pending) => (
              <article className="member-row" key={pending.movement_id}>
                <div>
                  <strong>{pending.product_name}</strong>
                  <span>{pending.environment_name} • quantidade {pending.quantity}</span>
                  <small>Motivo pendente</small>
                </div>
                {!isAdmin && (
                  <button className="secondary-button" type="button" onClick={() => setSelectedPending(pending.movement_id)}>Informar motivo</button>
                )}
              </article>
            ))}
          </div>
          {selectedPending && (
            <div className="form-grid">
              <label>Motivo da perda
                <select value={pendingReason} onChange={(event) => setPendingReason(event.target.value)}>
                  <option value="">Selecione</option>
                  {lossReasons.map((reason) => <option key={reason.reason_id} value={reason.reason_id}>{reason.name}</option>)}
                </select>
              </label>
              <ActionButton className="primary-button" disabled={!pendingReason} busyLabel="Salvando..." onAction={informPendingReason}>Salvar motivo</ActionButton>
            </div>
          )}
        </Card>
      )}
      {canLaunch && activeCompany && (
        <Card>
          <h2>Movimentações manual em lote</h2>
          <p className="field-help">Monte várias movimentações antes de confirmar. Use entrada, saída, perda ou transferência em uma única prévia.</p>
          <div className="movement-batch-list">
            {manualRows.map((row, index) => (
              <article className="movement-batch-row" key={row.id}>
                <strong>Linha {index + 1}</strong>
                <label>Produto
                  <select value={row.productId} onChange={(event) => updateManualRow(row.id, 'productId', event.target.value)}>
                    <option value="">Selecione</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{product.name}{product.sku ? ` • ${product.sku}` : ''}</option>)}
                  </select>
                </label>
                <label>Tipo
                  <select value={row.type} onChange={(event) => updateManualRow(row.id, 'type', event.target.value)}>
                    <option value="entrada">Entrada</option>
                    <option value="saida">Saída</option>
                    <option value="perda">Perda</option>
                    <option value="transferencia">Transferência</option>
                  </select>
                </label>
                <label>{row.type === 'transferencia' ? 'Ambiente origem' : 'Ambiente'}
                  <select value={row.environmentId} onChange={(event) => updateManualRow(row.id, 'environmentId', event.target.value)}>
                    <option value="">Selecione</option>
                    {environments.map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}
                  </select>
                </label>
                {row.type === 'transferencia' && (
                  <label>Ambiente destino
                    <select value={row.toEnvironmentId} onChange={(event) => updateManualRow(row.id, 'toEnvironmentId', event.target.value)}>
                      <option value="">Selecione</option>
                      {environments.filter((environment) => environment.id !== row.environmentId).map((environment) => <option key={environment.id} value={environment.id}>{environment.name}</option>)}
                    </select>
                  </label>
                )}
                <label>Quantidade
                  <input type="number" min="0.001" step="0.001" value={row.quantity} onChange={(event) => updateManualRow(row.id, 'quantity', Number(event.target.value))} />
                </label>
                <label>Observação
                  <input value={row.note} onChange={(event) => updateManualRow(row.id, 'note', event.target.value)} placeholder="Opcional" />
                </label>
                <button className="secondary-button" type="button" disabled={manualRows.length === 1} onClick={() => removeManualRow(row.id)}>Remover</button>
              </article>
            ))}
          </div>
          <div className="member-actions">
            <button className="secondary-button" type="button" onClick={addManualRow}>Adicionar outra linha</button>
            <button className="secondary-button" type="button" onClick={() => void previewManualBatch()}>Revisar prévia</button>
            {manualBatchPreview.length > 0 && (
              <div className="movement-batch-preview">
                {manualBatchPreview.map((item, index) => (
                  <article key={`${item.productName}-${item.environmentName}-${item.type}-${index}`}>
                    <strong>{item.productName}</strong>
                    <span>{item.type} • {item.environmentName} • quantidade {item.quantity}</span>
                    {item.available != null && <small>Saldo disponível: {item.available}</small>}
                    {item.repeated > 1 && <small>{item.repeated} linhas repetidas; quantidade agrupada.</small>}
                    {item.warning && <p className="form-error">{item.warning}</p>}
                  </article>
                ))}
              </div>
            )}
            <ActionButton
              className="primary-button"
              busyLabel="Aplicando..."
              disabled={manualBatchPreview.length === 0}
              disabledReason="Revise a prévia antes de confirmar o lote"
              onAction={applyManualBatch}
            >
              Confirmar todas as movimentações
            </ActionButton>
          </div>
        </Card>
      )}
      {canLaunch && activeCompany && (
        <Card>
          <h2>Entrada de insumos em lote</h2>
          <p className="field-help">
            Gere o modelo, preencha as quantidades no celular ou computador e envie a planilha para conferir antes de alterar o estoque.
          </p>
          <div className="form-grid">
            <label>Ambiente de entrada
              <select value={batchEnvironmentId} onChange={(event) => setBatchEnvironmentId(event.target.value)}>
                <option value="">Selecione</option>
                {environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </label>
            <div>
              <ActionButton className="secondary-button" busyLabel="Gerando..." disabled={!batchEnvironmentId} disabledReason="Selecione o ambiente de entrada" onAction={downloadEntryTemplate}>
                Baixar modelo XLSX de entradas
              </ActionButton>
              <ActionButton className="secondary-button" busyLabel="Gerando..." disabled={!batchEnvironmentId} disabledReason="Selecione o ambiente de entrada" onAction={downloadEntryCsvTemplate}>
                Baixar modelo CSV
              </ActionButton>
            </div>
            <label>Planilha preenchida
              <input type="file" accept=".xlsx,.xls,.csv,text/csv" onChange={(event) => void readEntryFile(event)} />
            </label>
          </div>
          {batchFileName && <p className="field-help">Arquivo: {batchFileName}</p>}
          {batchPreview.length > 0 && (
            <>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Produto</th><th>Quantidade</th><th>Resultado</th></tr></thead>
                  <tbody>
                    {batchPreview.map((row, index) => (
                      <tr key={`${row.productId ?? 'missing'}-${index}`}>
                        <td>{row.productName}</td>
                        <td>{row.quantity}</td>
                        <td>{row.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ActionButton
                className="primary-button"
                busyLabel="Aplicando..."
                disabled={batchPreview.some((row) => !row.valid || !row.productId)}
                disabledReason="Corrija todas as linhas da prévia antes de aplicar"
                onAction={applyEntryFile}
              >
                Aplicar entradas no estoque
              </ActionButton>
            </>
          )}
        </Card>
      )}
      {canLaunch && activeCompany && (
        <Card>
          <h2>Lançar movimentação</h2>
          <MovementLaunchForm
            companyId={activeCompany.id}
            environments={environments}
            products={products}
            initial={initial}
            onRegistered={() => void load()}
          />
        </Card>
      )}
      {canHistory && (
        <Card>
          <h2>Histórico de movimentações</h2>
          <MovementHistory
            movements={movements}
            products={products}
            environments={environments}
            users={profiles}
            canReverse
            companyName={activeCompany?.name ?? ''}
            onChanged={() => void load()}
          />
        </Card>
      )}
      {!canHistory && (
        <Card>
          <h2>Meus lançamentos recentes</h2>
          {movements.filter((movement) => movement.created_by === user?.id).length === 0 && <p>Nenhum lançamento encontrado. Registre sua primeira movimentação no formulário acima.</p>}
          <div className="member-list">
            {movements
              .filter((movement) => movement.created_by === user?.id)
              .slice(0, 20)
              .map((movement) => (
                <article className="member-row" key={movement.id}>
                  <div>
                    <strong>{products.find((product) => product.id === movement.product_id)?.name ?? movement.product_name ?? 'Produto'}</strong>
                    <span>
                      {movementTypeLabel[movement.type]} • {movement.quantity} • {environments.find((environment) => environment.id === movement.environment_id)?.name ?? movement.environment_name ?? 'Ambiente'}
                    </span>
                    <small>{new Date(movement.created_at).toLocaleString('pt-BR')}{movement.note ? ` • ${movement.note}` : ''}</small>
                  </div>
                  {canReverseMovement(movement.created_at, new Date(), false, true) && (
                    <ActionButton className="secondary-button" busyLabel="Preparando..." onAction={() => quickReverse(movement)}>Corrigir lançamento</ActionButton>
                  )}
                </article>
              ))}
          </div>
        </Card>
      )}
    </Container>
  )
}
