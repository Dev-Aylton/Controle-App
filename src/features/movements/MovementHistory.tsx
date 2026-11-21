import { useState } from 'react'
import type { Movement, MovementEnvironment, MovementProduct } from './types'
import { filterMovements, groupTransferMovements, type MovementFilters } from './historyRules'
import { formatMovementQuantity } from './rules'
import { reverseMovement } from '../../services/movements'

type Props = {
  movements: Movement[]
  products: MovementProduct[]
  environments: MovementEnvironment[]
  users: Array<{ id: string; name: string }>
  onChanged: () => void
  canReverse: boolean
}

export function MovementHistory({ movements, products, environments, users, onChanged, canReverse }: Props) {
  const [filters, setFilters] = useState<MovementFilters>({
    productId: '', environmentId: '', type: '', from: '', to: '', userId: '',
  })
  const [reasonMovement, setReasonMovement] = useState<Movement | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const filtered = filterMovements(movements, filters)
  const grouped = groupTransferMovements(filtered)

  const confirmReverse = async () => {
    if (!reasonMovement) return
    setError('')
    try {
      await reverseMovement(reasonMovement.id, reason)
      setReasonMovement(null)
      setReason('')
      onChanged()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível estornar.')
    }
  }

  return (
    <div className="movement-history">
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-grid">
        <label>Produto
          <select value={filters.productId} onChange={(event) => setFilters({ ...filters, productId: event.target.value })}>
            <option value="">Todos</option>
            {products.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>Ambiente
          <select value={filters.environmentId} onChange={(event) => setFilters({ ...filters, environmentId: event.target.value })}>
            <option value="">Todos</option>
            {environments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>Tipo
          <select value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
            <option value="">Todos</option>
            <option value="entrada">Entrada</option><option value="saida">Saída</option><option value="perda">Perda</option>
            <option value="transferencia_saida">Transferência</option><option value="ajuste_inventario">Ajuste</option><option value="estorno">Estorno</option>
          </select>
        </label>
        <label>Usuário
          <select value={filters.userId} onChange={(event) => setFilters({ ...filters, userId: event.target.value })}>
            <option value="">Todos</option>
            {users.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label>De<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
        <label>Até<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
      </div>
      <div className="member-list">
        {grouped.map((group) => {
          const movement = group.movements[0]
          const product = products.find((item) => item.id === movement.product_id)
          const environment = environments.find((item) => item.id === movement.environment_id)
          const transfer = group.transferGroupId !== null
          const alreadyReversed = movement.reverses_movement_id !== null || group.movements.some((item) => item.reverses_movement_id)
          return (
            <article className="member-row" key={group.transferGroupId ?? movement.id}>
              <div>
                <strong>{transfer ? 'Transferência' : movement.type}</strong>
                <span>{product?.name ?? movement.product_id} • {environment?.name ?? movement.environment_id} • {formatMovementQuantity(movement.signed_quantity)}</span>
                <small>{new Date(movement.created_at).toLocaleString('pt-BR')} • {movement.note || 'Sem observação'}</small>
              </div>
              {transfer && (
                <details>
                  <summary>Ver duas pernas</summary>
                  {group.movements.map((leg) => <div key={leg.id}>{leg.type}: {formatMovementQuantity(leg.signed_quantity)}</div>)}
                </details>
              )}
              {canReverse && !alreadyReversed && (
                <button className="danger-button" type="button" onClick={() => setReasonMovement(movement)}>Estornar</button>
              )}
              {alreadyReversed && <span>Estornado</span>}
            </article>
          )
        })}
      </div>
      {reasonMovement && (
        <div className="confirm-dialog" role="dialog" aria-modal="true">
          <div>
            <h2>Confirmar estorno</h2>
            <label>Motivo<textarea value={reason} onChange={(event) => setReason(event.target.value)} /></label>
            <div className="member-actions">
              <button className="secondary-button" type="button" onClick={() => setReasonMovement(null)}>Cancelar</button>
              <button className="danger-button" type="button" onClick={() => void confirmReverse()}>Confirmar estorno</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
