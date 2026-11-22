import type { getOfflineQueueStatus } from '../offline/sync'

export type QueueExitChoice = 'wait' | 'send' | 'discard'
export type QueueExitStatus = Awaited<ReturnType<typeof getOfflineQueueStatus>>

type Dependencies = {
  confirmDiscard: () => Promise<boolean>
  sync: () => Promise<void>
  getStatus: () => Promise<QueueExitStatus>
  signOut: (discardPending: boolean) => Promise<void>
}

export type QueueExitResult =
  | { action: 'wait' | 'cancelled' | 'blocked' | 'signed-out' }
  | { action: 'pending'; status: QueueExitStatus }

export async function resolvePendingQueueExit(
  choice: QueueExitChoice,
  status: QueueExitStatus,
  dependencies: Dependencies,
): Promise<QueueExitResult> {
  if (choice === 'wait') return { action: 'wait' }
  if (choice === 'discard') {
    if (!await dependencies.confirmDiscard()) return { action: 'cancelled' }
    await dependencies.signOut(true)
    return { action: 'signed-out' }
  }
  if (status.userPending === 0) return { action: 'blocked' }
  await dependencies.sync()
  const updatedStatus = await dependencies.getStatus()
  if (updatedStatus.userPending === 0 && !updatedStatus.hasUnassignedPending) {
    await dependencies.signOut(false)
    return { action: 'signed-out' }
  }
  return { action: 'pending', status: updatedStatus }
}
