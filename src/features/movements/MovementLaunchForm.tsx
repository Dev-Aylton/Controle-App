import { useEffect, useState, type FormEvent } from 'react'
import type { MovementEnvironment, MovementProduct } from './types'
import { registerMovement, registerTransfer, registerDoseMovement } from '../../services/movements'
import { completePendingLossReason, listLossReasons, type LossReason } from './lossReasons'
import { enqueueMovement } from '../offline/sync'
import { traduzirErro } from '../../lib/errors'
import { ActionButton } from '../../components'
import { useAuth } from '../auth/auth-context'

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
        await enqueueMovement(user.id, {
          clientRequestId: crypto.randomUUID(),
          companyId,
          productId,
          environmentId: fromEnvironment,
          fromEnvironmentId: fromEnvironment,
          toEnvironmentId: type === 'transferencia' ? toEnvironment : undefined,
          type,
          quantity,
          note: note || null,
          localCreatedAt: new Date().toISOString(),
        })
        setOfflineMessage('Salvo no aparelho, pendente de envio.')
        setError('')
        setQuantity(0)
        setNote('')
        setLoading(false)
        return
      }
      if (type === 'transferencia') {
        await registerTransfer(companyId, productId, fromEnvironment, toEnvironment, quantity, note)
      } else {
        const movementId = doseMode
          ? await registerDoseMovement(companyId, productId, fromEnvironment, type, doses, note)
          : await registerMovement(companyId, productId, fromEnvironment, type, quantity, note)
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
      <label>Ambiente origem
        <select value={fromEnvironment} onChange={(event) => setFromEnvironment(event.target.value)} required>
          <option value="">Selecione</option>
          {environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      {type === 'transferencia' && (
        <label>Ambiente destino
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
          {filteredProducts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      <label>Tipo
        <select value={type} onChange={(event) => setType(event.target.value as typeof type)}>
          <option value="entrada">Entrada</option>
          <option value="saida">Saída</option>
          <option value="perda">Perda</option>
          <option value="transferencia">Transferência</option>
        </select>
      </label>
      <label>Quantidade
        <input type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} placeholder="Ex.: 1,5" required />
      </label>
      {type !== 'transferencia' && (
        <label className="check-label">
          <input type="checkbox" checked={doseMode} onChange={(event) => setDoseMode(event.target.checked)} aria-describedby="dose-mode-help" />
          Informar em doses
        </label>
      )}
      {type !== 'transferencia' && <p className="field-help" id="dose-mode-help">Ative se a quantidade estiver em doses, em vez da unidade padrão do produto.</p>}
      {doseMode && (
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
      <label>Observação
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex.: serviço do jantar" />
      </label>
      <ActionButton
        type="button"
        className="primary-button"
        disabled={loading || !fromEnvironment || !productId || (doseMode ? doses <= 0 : quantity <= 0) || (type === 'transferencia' && !toEnvironment)}
        onAction={() => submit({ preventDefault: () => undefined } as FormEvent)}
        busyLabel="Registrando..."
      >
        Registrar
      </ActionButton>
    </form>
  )
}
