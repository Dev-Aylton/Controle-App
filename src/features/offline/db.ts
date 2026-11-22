import Dexie, { type Table } from 'dexie'

export const LEGACY_UNASSIGNED_USER_ID = '__legacy_unassigned__'

export type QueuedMovement = {
  userId?: string
  clientRequestId: string
  companyId: string
  productId: string
  environmentId: string
  fromEnvironmentId?: string
  toEnvironmentId?: string
  type: 'entrada' | 'saida' | 'perda' | 'transferencia'
  quantity: number
  note: string | null
  localCreatedAt: string
  status: 'pendente' | 'enviando' | 'enviado' | 'falhou'
  failureReason: string | null
  attempts: number
  nextAttemptAt: number
}

export type OfflineCatalogItem = {
  userId?: string
  id: string
  companyId: string
  name: string
  unit: string
  environments: string
}

class OfflineDatabase extends Dexie {
  queuedMovements!: Table<QueuedMovement, string>
  catalog!: Table<OfflineCatalogItem, string>

  constructor() {
    super('controle-app-offline')
    this.version(1).stores({
      queuedMovements: 'clientRequestId, status, localCreatedAt, nextAttemptAt',
      catalog: 'id, companyId',
    })
    this.version(2).stores({
      queuedMovements: 'clientRequestId, userId, [userId+status], status, localCreatedAt, nextAttemptAt',
      catalog: 'id, userId, companyId',
    }).upgrade(async (transaction) => {
      await Promise.all([
        transaction.table('queuedMovements').toCollection().modify((item: QueuedMovement) => {
          if (!item.userId) item.userId = LEGACY_UNASSIGNED_USER_ID
        }),
        transaction.table('catalog').toCollection().modify((item: OfflineCatalogItem) => {
          if (!item.userId) item.userId = LEGACY_UNASSIGNED_USER_ID
        }),
      ])
    })
  }
}

export const offlineDb = new OfflineDatabase()
