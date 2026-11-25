import {
  LEGACY_UNASSIGNED_USER_ID,
  offlineDb,
  type OfflineCatalogItem,
  type OfflineMovementEnvironment,
  type QueuedMovement,
} from './db'
import { registerMovement, registerTransfer } from '../../services/movements'
import { traduzirErro } from '../../lib/errors'
import { completePendingLossReason } from '../movements/lossReasons'

let syncing = false
export function isOfflineSyncing() { return syncing }

const pendingStatuses: QueuedMovement['status'][] = ['pendente', 'enviando', 'falhou']
const syncableStatuses: QueuedMovement['status'][] = ['pendente', 'falhou']

async function getUserQueue(userId: string, statuses: QueuedMovement['status'][]) {
  return offlineDb.queuedMovements
    .where('[userId+status]')
    .anyOf(statuses.map((status) => [userId, status]))
    .sortBy('localCreatedAt')
}

export async function getOfflineQueueStatus(userId?: string | null) {
  const [userQueue, allQueue] = await Promise.all([
    userId && userId !== LEGACY_UNASSIGNED_USER_ID ? getUserQueue(userId, pendingStatuses) : Promise.resolve([]),
    getUserQueue(LEGACY_UNASSIGNED_USER_ID, pendingStatuses),
  ])
  return {
    userPending: userQueue.length,
    hasUnassignedPending: allQueue.length > 0,
  }
}

export async function getQueuedMovementsForUser(userId: string) {
  if (userId === LEGACY_UNASSIGNED_USER_ID) return []
  return offlineDb.queuedMovements.where('userId').equals(userId).toArray()
}

export async function cacheMovementCatalog(
  userId: string,
  companyId: string,
  products: Array<{
    id: string
    name: string
    unit: string
    sku?: string | null
    volume_ml?: number | null
    dose_ml?: number | null
    weight_g?: number | null
  }>,
  environments: Array<{ id: string; name: string }>,
) {
  await offlineDb.transaction('rw', offlineDb.catalog, offlineDb.movementEnvironments, async () => {
    await offlineDb.catalog
      .where('userId')
      .equals(userId)
      .filter((item) => item.companyId === companyId)
      .delete()
    await offlineDb.catalog.bulkPut(products.map((product): OfflineCatalogItem => ({
      userId,
      id: product.id,
      companyId,
      name: product.name,
      unit: product.unit,
      sku: product.sku ?? null,
      volumeMl: product.volume_ml ?? null,
      doseMl: product.dose_ml ?? null,
      weightG: product.weight_g ?? null,
      environments: '',
    })))
    await offlineDb.movementEnvironments
      .where('companyId')
      .equals(companyId)
      .filter((item) => item.userId === userId)
      .delete()
    await offlineDb.movementEnvironments.bulkPut(environments.map((environment): OfflineMovementEnvironment => ({
      userId,
      companyId,
      id: environment.id,
      name: environment.name,
    })))
  })
}

export async function getCachedMovementCatalog(userId: string, companyId: string) {
  const [catalog, environments] = await Promise.all([
    offlineDb.catalog
      .where('userId')
      .equals(userId)
      .filter((item) => item.companyId === companyId)
      .toArray(),
    offlineDb.movementEnvironments
      .where('[userId+companyId+id]')
      .between([userId, companyId, ''], [userId, companyId, '\uffff'])
      .toArray(),
  ])
  return {
    products: catalog.map((item) => ({
      id: item.id,
      name: item.name,
      sku: item.sku ?? null,
      unit: item.unit,
      volume_ml: item.volumeMl ?? null,
      dose_ml: item.doseMl ?? null,
      weight_g: item.weightG ?? null,
    })),
    environments: environments
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((item) => ({ id: item.id, name: item.name })),
  }
}

export function isPermissionFailure(message: string): boolean {
  return /permission|proibido|autoriz|desativ|código trocado|not authorized/i.test(message)
}

export function transferResponseIsGroupId(response: unknown): boolean {
  if (typeof response !== 'string') return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(response)
}

export async function enqueueMovement(userId: string, item: Omit<QueuedMovement, 'userId' | 'status' | 'failureReason' | 'attempts' | 'nextAttemptAt'>) {
  await offlineDb.queuedMovements.put({
    ...item,
    userId,
    status: 'pendente',
    failureReason: null,
    attempts: 0,
    nextAttemptAt: 0,
  })
}

export async function syncQueuedMovements(userId: string): Promise<{ sent: number; stopped: boolean }> {
  if (userId === LEGACY_UNASSIGNED_USER_ID) throw new Error('Registros antigos sem usuário vinculado não podem ser sincronizados.')
  if (syncing) return { sent: 0, stopped: false }
  syncing = true
  try {
  if (!navigator.onLine) return { sent: 0, stopped: false }
  await offlineDb.queuedMovements
    .where('[userId+status]')
    .equals([userId, 'enviando'])
    .modify({ status: 'pendente', failureReason: null })
  const queue = await getUserQueue(userId, syncableStatuses)
  let sent = 0
  for (const item of queue) {
    if (item.userId !== userId) continue
    if (item.status === 'falhou' && Date.now() < item.nextAttemptAt) continue
    await offlineDb.queuedMovements.update(item.clientRequestId, { status: 'enviando', failureReason: null })
    try {
      if (item.type === 'transferencia') {
        await registerTransfer(
          item.companyId,
          item.productId,
          item.fromEnvironmentId ?? item.environmentId,
          item.toEnvironmentId ?? item.environmentId,
          item.quantity,
          item.note ?? undefined,
          item.clientRequestId,
        )
      } else {
        const movementId = await registerMovement(
          item.companyId,
          item.productId,
          item.environmentId,
          item.type,
          item.quantity,
          item.note ?? undefined,
          item.clientRequestId,
        )
        if (item.type === 'perda' && item.lossReasonId) {
          await completePendingLossReason(movementId, item.lossReasonId)
        }
      }
      await offlineDb.queuedMovements.delete(item.clientRequestId)
      sent += 1
    } catch (caught) {
      const reason = traduzirErro(caught, 'Não foi possível sincronizar o lançamento.')
      const attempts = item.attempts + 1
      await offlineDb.queuedMovements.update(item.clientRequestId, {
        status: 'falhou',
        failureReason: reason,
        attempts,
        nextAttemptAt: Date.now() + Math.min(300000, 1000 * (2 ** attempts)),
      })
      if (isPermissionFailure(reason)) return { sent, stopped: true }
    }
  }
  return { sent, stopped: false }
  } finally {
    syncing = false
  }
}
