import { useCallback, useEffect, useState } from 'react'
import { useCompanies } from '../features/company/company-context'
import { useAuth } from '../features/auth/auth-context'
import { tryGetSupabaseClient } from '../lib/supabase'
import { Container, Card } from '../components'
import { MovementLaunchForm } from '../features/movements/MovementLaunchForm'
import { MovementHistory } from '../features/movements/MovementHistory'
import type { Movement, MovementEnvironment, MovementProduct } from '../features/movements/types'
import { canReverseMovement } from '../features/movements/rules'
import { reverseMovement } from '../services/movements'

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
    if (environmentResult.error) setError(environmentResult.error.message)
    if (productResult.error) setError(productResult.error.message)
    if (movementResult.error) setError(movementResult.error.message)
    setEnvironments((environmentResult.data ?? []) as MovementEnvironment[])
    setProducts((productResult.data ?? []) as MovementProduct[])
    setMovements((movementResult.data ?? []) as Movement[])
    const userIds = [...new Set((movementResult.data ?? []).map((item) => item.created_by).filter((id): id is string => Boolean(id)))]
    if (userIds.length) {
      const profileResult = await supabase.from('profiles').select('id,name').in('id', userIds)
      setProfiles((profileResult.data ?? []).map((item) => ({ id: item.id, name: item.name ?? 'Usuário sem nome' })))
    }
    setLoading(false)
  }, [activeCompany])

  useEffect(() => {
    if (activeCompany) queueMicrotask(() => { void load() })
  }, [activeCompany, load])

  const canHistory = isAdmin || role === 'owner' || role === 'manager'
  const canLaunch = !isAdmin

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
      setError(caught instanceof Error ? caught.message : 'Não foi possível corrigir.')
    }
  }

  return (
    <Container>
      <h1>Movimentações</h1>
      {loading && <p className="page-state">Carregando movimentações...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {message && <p className="form-success" role="status">{message}</p>}
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
            onChanged={() => void load()}
          />
        </Card>
      )}
      {!canHistory && (
        <Card>
          <h2>Meus lançamentos recentes</h2>
          {movements.filter((movement) => movement.created_by === user?.id).length === 0 && <p>Nenhum lançamento encontrado.</p>}
          <div className="member-list">
            {movements
              .filter((movement) => movement.created_by === user?.id)
              .filter((movement) => canReverseMovement(movement.created_at, new Date(), false, true))
              .map((movement) => (
                <article className="member-row" key={movement.id}>
                  <div><strong>{movement.type}</strong><span>{movement.quantity}</span></div>
                  <button className="secondary-button" type="button" onClick={() => void quickReverse(movement)}>Corrigir</button>
                </article>
              ))}
          </div>
        </Card>
      )}
    </Container>
  )
}
