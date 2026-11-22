import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LEGACY_UNASSIGNED_USER_ID, offlineDb } from '../offline/db'
import { clearUserDeviceData } from './localDataCleanup'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, String(value)) }
  keys() { return [...this.values.keys()] }
}

const queueItem = (clientRequestId: string, status: 'pendente' | 'enviado', userId?: string) => ({
  clientRequestId,
  userId,
  companyId: 'empresa',
  productId: 'produto',
  environmentId: 'ambiente',
  type: 'entrada' as const,
  quantity: 1,
  note: null,
  localCreatedAt: '2026-11-21T22:00:00Z',
  status,
  failureReason: null,
  attempts: 0,
  nextAttemptAt: 0,
})

describe('limpeza dos dados locais', () => {
  let local = new MemoryStorage()
  let session = new MemoryStorage()
  const cacheDelete = vi.fn(async () => true)

  afterEach(async () => {
    vi.unstubAllGlobals()
    await offlineDb.queuedMovements.clear()
    await offlineDb.catalog.clear()
    local = new MemoryStorage()
    session = new MemoryStorage()
    cacheDelete.mockClear()
  })

  it('limpa os dados locais ao sair, mantendo tema e arquivos estáticos e sem tocar em outra conta', async () => {
    vi.stubGlobal('localStorage', local)
    vi.stubGlobal('sessionStorage', session)
    vi.stubGlobal('caches', {
      keys: async () => ['workbox-precache-v2-app', 'runtime-api-data'],
      delete: cacheDelete,
    })
    local.setItem('controle-app-theme', 'dark')
    local.setItem('controle-app-company', 'empresa-a')
    local.setItem('controle-app-tutorial-dismissed-manager', 'true')
    local.setItem('sb-project-auth-token', 'token')
    session.setItem('controle-app:privacy-dismissed:v1', '1')
    await offlineDb.queuedMovements.bulkPut([
      queueItem('a-movement', 'enviado', 'usuario-a'),
      queueItem('b-movement', 'enviado', 'usuario-b'),
      queueItem('legacy-movement', 'enviado', LEGACY_UNASSIGNED_USER_ID),
    ])
    await offlineDb.catalog.bulkPut([
      { id: 'a-product', userId: 'usuario-a', companyId: 'empresa-a', name: 'A', unit: 'un', environments: '' },
      { id: 'b-product', userId: 'usuario-b', companyId: 'empresa-b', name: 'B', unit: 'un', environments: '' },
      { id: 'legacy-product', userId: LEGACY_UNASSIGNED_USER_ID, companyId: 'empresa-antiga', name: 'Antigo', unit: 'un', environments: '' },
    ])

    await clearUserDeviceData('usuario-a')

    expect(local.keys()).toEqual(['controle-app-theme'])
    expect(local.getItem('controle-app-theme')).toBe('dark')
    expect(session.length).toBe(0)
    expect((await offlineDb.queuedMovements.toArray()).map((item) => item.clientRequestId)).toEqual(['b-movement'])
    expect((await offlineDb.catalog.toArray()).map((item) => item.id)).toEqual(['b-product'])
    expect(cacheDelete).toHaveBeenCalledTimes(1)
    expect(cacheDelete).toHaveBeenCalledWith('runtime-api-data')
  })

  it('exige confirmação explícita antes de descartar fila pendente, inclusive legado', async () => {
    vi.stubGlobal('localStorage', local)
    vi.stubGlobal('sessionStorage', session)
    vi.stubGlobal('caches', { keys: async () => [], delete: cacheDelete })
    local.setItem('controle-app-theme', 'light')
    await offlineDb.queuedMovements.bulkPut([
      queueItem('a-pending', 'pendente', 'usuario-a'),
      queueItem('legacy-pending', 'pendente', LEGACY_UNASSIGNED_USER_ID),
      queueItem('b-pending', 'pendente', 'usuario-b'),
    ])

    await expect(clearUserDeviceData('usuario-a')).rejects.toThrow('Resolva ou descarte')
    expect(await offlineDb.queuedMovements.count()).toBe(3)

    await clearUserDeviceData('usuario-a', { discardPending: true })

    expect((await offlineDb.queuedMovements.toArray()).map((item) => item.clientRequestId)).toEqual(['b-pending'])
    expect(local.keys()).toEqual(['controle-app-theme'])
  })
})
