import { useCallback, useEffect, useState } from 'react'
import { useCompanies } from '../features/company/company-context'
import { useAuth } from '../features/auth/auth-context'
import { tryGetSupabaseClient } from '../lib/supabase'
import { Container, Card, ActionButton } from '../components'
import { MovementLaunchForm } from '../features/movements/MovementLaunchForm'
import { MovementHistory } from '../features/movements/MovementHistory'
import type { Movement, MovementEnvironment, MovementProduct } from '../features/movements/types'
import { canReverseMovement } from '../features/movements/rules'
import { reverseMovement } from '../services/movements'
import { completePendingLossReason, getMyPendingLossReasons, listLossReasons, type LossReason, type PendingLossMovement } from '../features/movements/lossReasons'
import { getPendingLossReasons } from '../features/management/management'
import type { PendingLoss } from '../features/management/types'
import { traduzirErro } from '../lib/errors'

export function MovementsPage() {
  const { activeCompany, role, isAdmin } = useCompanies()
  const { user } = useAuth()
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

  const load = useCallback(async () => {
    if (!activeCompany) return
    const supabase = tryGetSupabaseClient()
    if (!supabase) return
    setLoading(true)
    setError('')
    const [environmentResult, productResult, movementResult] = await Promise.all([
      supabase.from('environments').select('id,name').eq('company_id', activeCompany.id).eq('active', true),
      supabase.from('products').select('id,name,sku,unit').eq('company_id', activeCompany.id).eq('active', true),
      supabase.from('stock_movements').select('*').eq('company_id', activeCompany.id).order('created_at', { ascending: false }).limit(100),
    ])
    if (environmentResult.error) setError(traduzirErro(environmentResult.error, 'Não foi possível carregar ambientes.'))
    if (productResult.error) setError(traduzirErro(productResult.error, 'Não foi possível carregar produtos.'))
    if (movementResult.error) setError(traduzirErro(movementResult.error, 'Não foi possível carregar movimentações.'))
    setEnvironments((environmentResult.data ?? []) as MovementEnvironment[])
    setProducts((productResult.data ?? []) as MovementProduct[])
    setMovements((movementResult.data ?? []) as Movement[])
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
  }, [activeCompany, isAdmin, role])

  useEffect(() => {
    if (activeCompany) queueMicrotask(() => { void load() })
  }, [activeCompany, load])

  const canHistory = isAdmin || role === 'owner' || role === 'manager'
  const canLaunch = isAdmin || role === 'owner' || role === 'manager' || role === 'employee'

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
    try {
      await reverseMovement(movement.id)
      await load()
      await correctMovement(movement)
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível corrigir.'))
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

  return (
    <Container>
      <h1>Movimentações</h1>
      {loading && <p className="page-state">Carregando movimentações...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
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
              .filter((movement) => canReverseMovement(movement.created_at, new Date(), false, true))
              .map((movement) => (
                <article className="member-row" key={movement.id}>
                  <div><strong>{movement.type}</strong><span>{movement.quantity}</span></div>
                  <ActionButton className="secondary-button" busyLabel="Corrigindo..." onAction={() => quickReverse(movement)}>Corrigir</ActionButton>
                </article>
              ))}
          </div>
        </Card>
      )}
    </Container>
  )
}
