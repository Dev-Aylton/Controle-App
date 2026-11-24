import { useEffect, useState, type FormEvent } from 'react'
import type { MovementEnvironment, MovementProduct } from './types'
import { registerMovement, registerTransfer, registerDoseMovement } from '../../services/movements'
import { completePendingLossReason, listLossReasons, type LossReason } from './lossReasons'
import { enqueueMovement } from '../offline/sync'
import { traduzirErro } from '../../lib/errors'
import { ActionButton } from '../../components'
import { useAuth } from '../auth/auth-context'
import { calculateDoseQuantity, calculatePortionQuantity, calculateWeightQuantity } from './rules'
import { useCompanies } from '../company/company-context'
import { getStockBalance } from '../../services/movements'
import { calculateStockDivergence, formatStockDivergenceMessage } from '../management/divergenceDetection'
import { formatBrazilianCurrencyInput, parseBrazilianCurrency } from '../management/currency'

type Props = {
  companyId: string
  environments: MovementEnvironment[]
  products: MovementProduct[]
  onRegistered: () => void
  initial?: {
    productId?: string
    environmentId?: string
    type?: 'entrada' | 'saida' | 'perda'
    quantity?: number
  }
}

export function MovementLaunchForm({ companyId, environments, products, onRegistered, initial }: Props) {
  const { user } = useAuth()
  const { role, isAdmin } = useCompanies()
  const canUseDoseMode = isAdmin || role === 'owner' || role === 'manager' || role === 'employee'
  const [fromEnvironment, setFromEnvironment] = useState(initial?.environmentId ?? '')
  const [toEnvironment, setToEnvironment] = useState('')
  const [productId, setProductId] = useState(initial?.productId ?? '')
  const [productSearch, setProductSearch] = useState('')
  const [type, setType] = useState<'entrada' | 'saida' | 'perda' | 'transferencia'>(initial?.type ?? 'entrada')
  const [quantity, setQuantity] = useState(initial?.quantity ?? 0)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [offlineMessage, setOfflineMessage] = useState('')
  const [lossReasons, setLossReasons] = useState<LossReason[]>([])
  const [lossReasonId, setLossReasonId] = useState('')
  const [doseMode, setDoseMode] = useState(false)
  const [doses, setDoses] = useState(1)
  const [quantityMode, setQuantityMode] = useState<'unit' | 'portion' | 'weight'>('unit')
  const [portions, setPortions] = useState(1)
  const [weightKg, setWeightKg] = useState(0)
  const [divergenceWarning, setDivergenceWarning] = useState('')
  const [operationPreset, setOperationPreset] = useState<'normal' | 'destination_withdrawal' | 'direct_purchase' | 'destination_return'>('normal')
  const [directPurchaseCost, setDirectPurchaseCost] = useState<number | null>(null)

  useEffect(() => {
    if (type !== 'perda') return
    void listLossReasons(companyId).then(setLossReasons).catch((caught) => {
      setError(traduzirErro(caught, 'Não foi possível carregar os motivos de perda.'))
    })
  }, [companyId, type])

  const filteredProducts = products.filter((product) =>
    `${product.name} ${product.sku ?? ''}`.toLowerCase().includes(productSearch.toLowerCase()),
  )

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (!navigator.onLine) {
        if (!user?.id) throw new Error('Entre na sua conta antes de salvar um lançamento offline.')
        if (type === 'perda') throw new Error('Perdas offline exigem conexão enquanto os motivos não estiverem disponíveis no aparelho.')
        const selectedProduct = products.find((product) => product.id === productId)
        const offlineQuantity = doseMode
          ? calculateDoseQuantity(selectedProduct?.volume_ml ?? null, selectedProduct?.dose_ml ?? null, doses)
          : quantityMode === 'portion'
            ? calculatePortionQuantity(portions, selectedProduct?.unit ?? 'un', selectedProduct?.weight_g ?? null)
            : quantityMode === 'weight'
              ? calculateWeightQuantity(weightKg, selectedProduct?.unit ?? 'kg', selectedProduct?.weight_g ?? null)
              : quantity
        if (offlineQuantity === null) throw new Error('Produto sem volume ou dose cadastrados.')
        const effectiveFrom = operationPreset === 'direct_purchase'
          ? toEnvironment
          : operationPreset === 'destination_return'
            ? toEnvironment
            : fromEnvironment
        const effectiveTo = operationPreset === 'direct_purchase'
          ? undefined
          : operationPreset === 'destination_return'
            ? fromEnvironment
            : toEnvironment
        const effectiveType = operationPreset === 'direct_purchase'
          ? 'entrada'
          : operationPreset === 'normal'
            ? type
            : 'transferencia'
        await enqueueMovement(user.id, {
          clientRequestId: crypto.randomUUID(),
          companyId,
          productId,
          environmentId: effectiveFrom,
          fromEnvironmentId: effectiveFrom,
          toEnvironmentId: effectiveType === 'transferencia' ? effectiveTo : undefined,
          type: effectiveType,
          quantity: offlineQuantity,
          note: note || null,
          lossReasonId: null,
          localCreatedAt: new Date().toISOString(),
        })
        setOfflineMessage('Salvo no aparelho, pendente de envio.')
        setError('')
        setQuantity(0)
        setNote('')
        setLoading(false)
        return
      }
      if (operationPreset === 'direct_purchase') {
        const selectedProduct = products.find((product) => product.id === productId)
        const movementQuantity = doseMode
          ? calculateDoseQuantity(selectedProduct?.volume_ml ?? null, selectedProduct?.dose_ml ?? null, doses)
          : quantityMode === 'portion'
            ? calculatePortionQuantity(portions, selectedProduct?.unit ?? 'un', selectedProduct?.weight_g ?? null)
            : quantityMode === 'weight'
              ? calculateWeightQuantity(weightKg, selectedProduct?.unit ?? 'kg', selectedProduct?.weight_g ?? null)
              : quantity
        if (movementQuantity === null) throw new Error('A quantidade informada não pôde ser convertida para a unidade do produto.')
        await registerMovement(
          companyId,
          productId,
          toEnvironment,
          'entrada',
          movementQuantity,
          `Compra direta no ambiente: ${directPurchaseCost == null ? 'custo não informado' : `custo unitário R$ ${directPurchaseCost.toFixed(2)}`}; ${note || 'sem observação'}`,
        )
      } else if (type === 'transferencia' || operationPreset !== 'normal') {
        const selectedProduct = products.find((product) => product.id === productId)
        const movementQuantity = doseMode
          ? calculateDoseQuantity(selectedProduct?.volume_ml ?? null, selectedProduct?.dose_ml ?? null, doses)
          : quantityMode === 'portion'
            ? calculatePortionQuantity(portions, selectedProduct?.unit ?? 'un', selectedProduct?.weight_g ?? null)
            : quantityMode === 'weight'
              ? calculateWeightQuantity(weightKg, selectedProduct?.unit ?? 'kg', selectedProduct?.weight_g ?? null)
              : quantity
        if (movementQuantity === null) throw new Error('A quantidade informada não pôde ser convertida para a unidade do produto.')
        const effectiveFrom = operationPreset === 'destination_return' ? toEnvironment : fromEnvironment
        const effectiveTo = operationPreset === 'destination_return' ? fromEnvironment : toEnvironment
        const balances = await getStockBalance(companyId, effectiveFrom)
        const available = Number(balances.find((item) => item.product_id === productId)?.balance ?? 0)
        const divergence = calculateStockDivergence(available, movementQuantity, 'negative_withdrawal')
        setDivergenceWarning(divergence ? formatStockDivergenceMessage(divergence) : '')
        await registerTransfer(companyId, productId, effectiveFrom, effectiveTo, movementQuantity, operationPreset === 'destination_withdrawal'
          ? `Retirada para outro ambiente: ${note || 'sem observação'}`
          : operationPreset === 'destination_return'
            ? `Devolução do ambiente ao estoque: ${note || 'sem observação'}`
            : note)
      } else {
        const selectedProduct = products.find((product) => product.id === productId)
        const movementQuantity = doseMode
          ? calculateDoseQuantity(selectedProduct?.volume_ml ?? null, selectedProduct?.dose_ml ?? null, doses)
          : quantityMode === 'portion'
            ? calculatePortionQuantity(portions, selectedProduct?.unit ?? 'un', selectedProduct?.weight_g ?? null)
            : quantityMode === 'weight'
              ? calculateWeightQuantity(weightKg, selectedProduct?.unit ?? 'kg', selectedProduct?.weight_g ?? null)
              : quantity
        if (movementQuantity === null) throw new Error('A quantidade informada não pôde ser convertida para a unidade do produto.')
        if (type !== 'entrada') {
          const balances = await getStockBalance(companyId, fromEnvironment)
          const available = Number(balances.find((item) => item.product_id === productId)?.balance ?? 0)
          const divergence = calculateStockDivergence(available, movementQuantity, 'negative_withdrawal')
          setDivergenceWarning(divergence ? formatStockDivergenceMessage(divergence) : '')
        } else {
          setDivergenceWarning('')
        }
        const movementId = doseMode
          ? await registerDoseMovement(companyId, productId, fromEnvironment, type, doses, note)
          : await registerMovement(companyId, productId, fromEnvironment, type, movementQuantity, note)
        if (type === 'perda' && lossReasonId) {
          await completePendingLossReason(movementId, lossReasonId)
        }
      }
      onRegistered()
      setQuantity(0)
      setNote('')
      setLossReasonId('')
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível registrar a movimentação.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="form-stack" onSubmit={(event) => event.preventDefault()}>
      {error && <p className="form-error" role="alert">{error}</p>}
      {offlineMessage && <p className="form-success" role="status">{offlineMessage}</p>}
      <label>Tipo de operação diário
        <select value={operationPreset} onChange={(event) => setOperationPreset(event.target.value as typeof operationPreset)}>
          <option value="normal">Movimentação normal</option>
          <option value="destination_withdrawal">Retirada do estoque para outro ambiente</option>
          <option value="direct_purchase">Compra direta no ambiente de destino</option>
          <option value="destination_return">Devolução do ambiente ao estoque</option>
        </select>
      </label>
      {operationPreset === 'destination_withdrawal' && (
        <p className="field-help" role="status">
          Esta operação transfere o material do ambiente de origem para o ambiente de destino. A origem perde a quantidade e o destino recebe a mesma quantidade.
        </p>
      )}
      {operationPreset === 'direct_purchase' && (
        <p className="field-help" role="status">
          Esta compra entra diretamente no ambiente de destino e não passa pelo ambiente de origem. Informar o preço ou custo correto ajuda a conciliar o dia.
        </p>
      )}
      {operationPreset === 'direct_purchase' && (
        <label>Custo unitário da compra direta (R$)
          <input
            type="text"
            inputMode="decimal"
            value={directPurchaseCost == null ? '' : formatBrazilianCurrencyInput(directPurchaseCost)}
            onChange={(event) => setDirectPurchaseCost(parseBrazilianCurrency(event.target.value))}
            placeholder="R$ 3,50"
          />
        </label>
      )}
      {operationPreset === 'destination_return' && (
        <p className="field-help" role="status">
          Esta operação transfere o material restante do ambiente de destino de volta ao ambiente de origem. Não contabiliza venda nem perda.
        </p>
      )}
      {operationPreset !== 'direct_purchase' && (
      <label>Ambiente origem
        <select value={fromEnvironment} onChange={(event) => setFromEnvironment(event.target.value)} required>
          <option value="">Selecione</option>
          {environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      )}
      {(type === 'transferencia' || operationPreset !== 'normal') && (
        <label>{operationPreset === 'direct_purchase' ? 'Ambiente de destino' : 'Ambiente destino'}
          <select value={toEnvironment} onChange={(event) => setToEnvironment(event.target.value)} required>
            <option value="">Selecione</option>
            {environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
      )}
      <label>Buscar produto
        <input value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Nome ou código" />
      </label>
      <label>Produto
        <select value={productId} onChange={(event) => setProductId(event.target.value)} required>
          <option value="">Selecione</option>
          {filteredProducts.map((item) => <option key={item.id} value={item.id}>{item.name}{item.sku ? ` • SKU ${item.sku}` : ''}</option>)}
        </select>
      </label>
      {(!operationPreset || operationPreset === 'normal') && (
        <label>Tipo
          <select value={type} onChange={(event) => setType(event.target.value as typeof type)}>
            <option value="entrada">Entrada</option>
            <option value="saida">Saída</option>
            <option value="perda">Perda</option>
            <option value="transferencia">Transferência</option>
          </select>
        </label>
      )}
      {operationPreset !== 'normal' && (
        <p className="field-help">Tipo automático: transferência entre ambientes.</p>
      )}
      <label>Forma de informar
        <select value={quantityMode} onChange={(event) => setQuantityMode(event.target.value as typeof quantityMode)}>
          <option value="unit">Quantidade na unidade do produto</option>
          <option value="portion">Porções já separadas</option>
          <option value="weight">Peso bruto em kg</option>
        </select>
      </label>
      {quantityMode === 'unit' && (
        <label>Quantidade
          <input type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} placeholder="Ex.: 3" required />
        </label>
      )}
      {quantityMode === 'portion' && (
        <label>Quantidade de porções
          <input type="number" min="1" step="1" value={portions} onChange={(event) => setPortions(Number(event.target.value))} placeholder="Ex.: 150" required />
        </label>
      )}
      {quantityMode === 'weight' && (
        <label>Peso bruto (kg)
          <input type="number" min="0.001" step="0.001" value={weightKg} onChange={(event) => setWeightKg(Number(event.target.value))} placeholder="Ex.: 3" required />
        </label>
      )}
      {quantityMode !== 'unit' && productId && (
        <p className="field-help" role="status">
          {(() => {
            const selected = products.find((product) => product.id === productId)
            if (!selected) return 'Selecione um produto para calcular a conversão.'
            if (quantityMode === 'portion') {
              const converted = calculatePortionQuantity(portions, selected.unit, selected.weight_g ?? null)
              return converted === null
                ? `Para converter porções, cadastre o peso de uma unidade do produto em gramas.`
                : `A movimentação será registrada como ${converted} ${selected.unit}.`
            }
            const converted = calculateWeightQuantity(weightKg, selected.unit, selected.weight_g ?? null)
            return converted === null
              ? `Peso bruto informado em kg não pode ser convertido para ${selected.unit}.`
              : `A movimentação será registrada como ${converted} ${selected.unit}.`
          })()}
        </p>
      )}
      {canUseDoseMode && type !== 'transferencia' && operationPreset === 'normal' && (
        <label className="check-label">
          <input type="checkbox" checked={doseMode} onChange={(event) => setDoseMode(event.target.checked)} aria-describedby="dose-mode-help" />
          Informar em doses
        </label>
      )}
      {canUseDoseMode && type !== 'transferencia' && operationPreset === 'normal' && <p className="field-help" id="dose-mode-help">Ative se a quantidade estiver em doses, em vez da unidade padrão do produto.</p>}
      {canUseDoseMode && doseMode && operationPreset === 'normal' && (
        <label>Doses
          <input type="number" min="1" step="1" value={doses} onChange={(event) => setDoses(Number(event.target.value))} placeholder="Ex.: 19" required />
        </label>
      )}
      {type === 'perda' && (
        <label>Motivo da perda (opcional)
          <select value={lossReasonId} onChange={(event) => setLossReasonId(event.target.value)}>
            <option value="">Informar depois</option>
            {lossReasons.map((reason) => <option key={reason.reason_id} value={reason.reason_id}>{reason.name}</option>)}
          </select>
        </label>
      )}
      {divergenceWarning && (
        <p className="stock-divergence-warning" role="alert">
          <strong>Possível divergência detectada</strong>
          <span>{divergenceWarning} A operação será bloqueada se não houver saldo suficiente no ambiente de origem.</span>
        </p>
      )}
      <label>Observação
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: serviço do jantar" />
      </label>
      <ActionButton
        type="button"
        className="primary-button"
        disabled={
          loading
          || (operationPreset === 'direct_purchase' ? !toEnvironment : !fromEnvironment)
          || !productId
          || (doseMode ? doses <= 0 : quantityMode === 'unit' ? quantity <= 0 : quantityMode === 'portion' ? portions <= 0 : weightKg <= 0)
          || (operationPreset !== 'normal' && (!toEnvironment || fromEnvironment === toEnvironment))
          || (operationPreset === 'normal' && type === 'transferencia' && (!toEnvironment || fromEnvironment === toEnvironment))
        }
        onAction={() => submit({ preventDefault: () => undefined } as FormEvent)}
        busyLabel="Registrando..."
        confirmMessage={
          operationPreset === 'direct_purchase'
            ? 'Confirmar a compra direta no ambiente de destino? Esta entrada não passará pelo ambiente de origem.'
            : operationPreset === 'destination_withdrawal'
            ? 'Confirmar a retirada do ambiente de origem para o ambiente de destino?'
            : operationPreset === 'destination_return'
              ? 'Confirmar a devolução do ambiente de destino para o ambiente de origem?'
              : 'Confirmar este lançamento no estoque?'
        }
      >
        Registrar
      </ActionButton>
    </form>
  )
}
