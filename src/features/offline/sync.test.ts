import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LEGACY_UNASSIGNED_USER_ID, offlineDb } from './db'
import { enqueueMovement, getOfflineQueueStatus, getQueuedMovementsForUser, isPermissionFailure, syncQueuedMovements, transferResponseIsGroupId } from './sync'
import { registerMovement } from '../../services/movements'

vi.mock('../../services/movements', () => ({
  registerMovement: vi.fn().mockResolvedValue('movement-id'),
  registerTransfer: vi.fn().mockResolvedValue('transfer-id'),
}))

describe('fila offline', () => {
  afterEach(async () => {
    vi.unstubAllGlobals()
    vi.mocked(registerMovement).mockClear()
    await offlineDb.queuedMovements.clear()
    await offlineDb.catalog.clear()
  })

  it('identifica erros que devem parar a fila', () => {
    expect(isPermissionFailure('permission denied')).toBe(true)
    expect(isPermissionFailure('usuário desativado')).toBe(true)
    expect(isPermissionFailure('saldo insuficiente')).toBe(false)
  })

  it('identifica resposta de transferência como id de grupo', () => {
    expect(transferResponseIsGroupId('12345678-1234-4123-8123-123456789abc')).toBe(true)
  })

  it('deduplica transferência enfileirada com o mesmo client_request_id', async () => {
    await offlineDb.queuedMovements.clear()
    const item = {
      clientRequestId: '22222222-2222-4222-8222-222222222222',
      companyId: 'empresa-a',
      productId: 'produto-a',
      environmentId: 'ambiente-a',
      fromEnvironmentId: 'ambiente-a',
      toEnvironmentId: 'ambiente-c',
      type: 'transferencia' as const,
      quantity: 1,
      note: null,
      localCreatedAt: '2026-11-21T22:00:00Z',
    }
    await enqueueMovement('usuario-a', item)
    await enqueueMovement('usuario-a', item)
    expect(await offlineDb.queuedMovements.count()).toBe(1)
  })

  it('isola a leitura e o envio da fila por usuário', async () => {
    const item = (user: string, company: string) => ({
      clientRequestId: `${user}-request`,
      companyId: company,
      productId: 'produto',
      environmentId: 'ambiente',
      type: 'entrada' as const,
      quantity: 1,
      note: null,
      localCreatedAt: '2026-11-21T22:00:00Z',
    })
    await enqueueMovement('usuario-a', item('usuario-a', 'empresa-a'))
    await enqueueMovement('usuario-b', item('usuario-b', 'empresa-b'))
    vi.stubGlobal('navigator', { onLine: true })

    expect(await getQueuedMovementsForUser('usuario-b')).toHaveLength(1)
    expect((await getOfflineQueueStatus('usuario-b')).userPending).toBe(1)
    await syncQueuedMovements('usuario-a')

    expect(registerMovement).toHaveBeenCalledTimes(1)
    expect(vi.mocked(registerMovement).mock.calls[0][0]).toBe('empresa-a')
    expect((await getOfflineQueueStatus('usuario-b')).userPending).toBe(1)
  })

  it('não associa nem entrega registros antigos sem usuário vinculado', async () => {
    await offlineDb.queuedMovements.put({
      userId: LEGACY_UNASSIGNED_USER_ID,
      clientRequestId: 'legacy-request',
      companyId: 'empresa-antiga',
      productId: 'produto',
      environmentId: 'ambiente',
      type: 'entrada',
      quantity: 1,
      note: null,
      localCreatedAt: '2026-11-21T22:00:00Z',
      status: 'pendente',
      failureReason: null,
      attempts: 0,
      nextAttemptAt: 0,
    })

    expect(await getQueuedMovementsForUser('usuario-a')).toHaveLength(0)
    expect(await getOfflineQueueStatus('usuario-a')).toEqual({ userPending: 0, hasUnassignedPending: true })
  })

  it('migra as filas anteriores para o espaço não atribuído, sem escolher um usuário', async () => {
    await offlineDb.close()
    await Dexie.delete('controle-app-offline')
    const legacyDatabase = new Dexie('controle-app-offline')
    legacyDatabase.version(1).stores({
      queuedMovements: 'clientRequestId, status, localCreatedAt, nextAttemptAt',
      catalog: 'id, companyId',
    })
    await legacyDatabase.open()
    await legacyDatabase.table('queuedMovements').put({
      ...queueItemForMigration(),
      status: 'pendente',
    })
    await legacyDatabase.table('catalog').put({
      id: 'legacy-product',
      companyId: 'empresa-antiga',
      name: 'Antigo',
      unit: 'un',
      environments: '',
    })
    legacyDatabase.close()

    await offlineDb.open()

    expect(await offlineDb.queuedMovements.where('userId').equals(LEGACY_UNASSIGNED_USER_ID).count()).toBe(1)
    expect(await offlineDb.catalog.where('userId').equals(LEGACY_UNASSIGNED_USER_ID).count()).toBe(1)
    expect(await getQueuedMovementsForUser('usuario-a')).toHaveLength(0)
  })
})

function queueItemForMigration() {
  return {
    clientRequestId: 'legacy-migration',
    companyId: 'empresa-antiga',
    productId: 'produto',
    environmentId: 'ambiente',
    type: 'entrada' as const,
    quantity: 1,
    note: null,
    localCreatedAt: '2026-11-21T22:00:00Z',
    failureReason: null,
    attempts: 0,
    nextAttemptAt: 0,
  }
}
