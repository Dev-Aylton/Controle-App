import { useState, type FormEvent } from 'react'
import type { MovementEnvironment, MovementProduct } from './types'
import { registerMovement, registerTransfer } from '../../services/movements'

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
  const [fromEnvironment, setFromEnvironment] = useState(initial?.environmentId ?? '')
  const [toEnvironment, setToEnvironment] = useState('')
  const [productId, setProductId] = useState(initial?.productId ?? '')
  const [productSearch, setProductSearch] = useState('')
  const [type, setType] = useState<'entrada' | 'saida' | 'perda' | 'transferencia'>(initial?.type ?? 'entrada')
  const [quantity, setQuantity] = useState(initial?.quantity ?? 0)
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const filteredProducts = products.filter((product) =>
    `${product.name} ${product.sku ?? ''}`.toLowerCase().includes(productSearch.toLowerCase()),
  )

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (type === 'transferencia') {
        await registerTransfer(companyId, productId, fromEnvironment, toEnvironment, quantity, note)
      } else {
        await registerMovement(companyId, productId, fromEnvironment, type, quantity, note)
      }
      onRegistered()
      setQuantity(0)
      setNote('')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível registrar a movimentação.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      {error && <p className="form-error" role="alert">{error}</p>}
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
        <input type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} required />
      </label>
      <label>Observação
        <input value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <button
        className="primary-button"
        disabled={loading || !fromEnvironment || !productId || quantity <= 0 || (type === 'transferencia' && !toEnvironment)}
        type="submit"
      >
        {loading ? 'Registrando...' : 'Registrar'}
      </button>
    </form>
  )
}
