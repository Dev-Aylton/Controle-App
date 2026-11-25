import { LEGACY_UNASSIGNED_USER_ID, offlineDb } from '../offline/db'

const THEME_STORAGE_KEY = 'controle-app-theme'
const SUPABASE_STORAGE_PREFIX = 'sb-'
const STATIC_PWA_CACHE_PREFIX = 'workbox-precache-'

export type ClearUserDeviceDataOptions = {
  discardPending?: boolean
  preserveAuthStorage?: boolean
}

export async function clearUserDeviceData(userId: string | null, options: ClearUserDeviceDataOptions = {}) {
  await offlineDb.transaction('rw', offlineDb.queuedMovements, offlineDb.catalog, offlineDb.movementEnvironments, async () => {
    const pendingStatuses = ['pendente', 'enviando', 'falhou'] as const
    const [userPending, unassignedPending] = await Promise.all([
      userId
        ? offlineDb.queuedMovements
          .where('[userId+status]')
          .anyOf(pendingStatuses.map((status) => [userId, status]))
          .count()
        : Promise.resolve(0),
      offlineDb.queuedMovements
        .where('[userId+status]')
        .anyOf(pendingStatuses.map((status) => [LEGACY_UNASSIGNED_USER_ID, status]))
        .count(),
    ])
    if (!options.discardPending && (userPending > 0 || unassignedPending > 0)) {
      throw new Error('Resolva ou descarte os lançamentos offline antes de sair da conta.')
    }

    if (userId) {
      await offlineDb.queuedMovements.where('userId').equals(userId).delete()
      await offlineDb.catalog.where('userId').equals(userId).delete()
      await offlineDb.movementEnvironments.where('userId').equals(userId).delete()
    }
    await offlineDb.queuedMovements.where('userId').equals(LEGACY_UNASSIGNED_USER_ID).delete()
    await offlineDb.catalog.where('userId').equals(LEGACY_UNASSIGNED_USER_ID).delete()
    await offlineDb.movementEnvironments.where('userId').equals(LEGACY_UNASSIGNED_USER_ID).delete()
  })

  clearLocalStorage(options.preserveAuthStorage ?? false)
  if (typeof sessionStorage !== 'undefined') sessionStorage.clear()
  await clearNonStaticCaches()
}

export function clearLocalStorage(preserveAuthStorage = false) {
  if (typeof localStorage === 'undefined') return
  const theme = localStorage.getItem(THEME_STORAGE_KEY)
  const keysToRemove: string[] = []
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index)
    if (
      key &&
      key !== THEME_STORAGE_KEY &&
      !(preserveAuthStorage && key.startsWith(SUPABASE_STORAGE_PREFIX))
    ) keysToRemove.push(key)
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key))
  if (theme !== null) localStorage.setItem(THEME_STORAGE_KEY, theme)
}

async function clearNonStaticCaches() {
  if (typeof caches === 'undefined') return
  const names = await caches.keys()
  await Promise.all(names
    .filter((name) => !name.startsWith(STATIC_PWA_CACHE_PREFIX))
    .map((name) => caches.delete(name)))
}
