import { useCallback, useState } from 'react'
import { useAuth } from '../auth/auth-context'
import { traduzirErro } from '../../lib/errors'
import { useConfirm } from '../../components/confirmContext'
import { getOfflineQueueStatus, syncQueuedMovements } from '../offline/sync'
import { PendingQueueExitDialog } from './PendingQueueExitDialog'
import { resolvePendingQueueExit, type QueueExitStatus } from './pendingQueueExit'

export function useSafeSignOut() {
  const { user, signOut } = useAuth()
  const userId = user?.id
  const confirm = useConfirm()
  const [queueStatus, setQueueStatus] = useState<QueueExitStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const finishSignOut = useCallback(async (discardPending = false) => {
    setBusy(true)
    setError('')
    try {
      await signOut(discardPending)
      setQueueStatus(null)
      return true
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível sair da conta.'))
      return false
    } finally {
      setBusy(false)
    }
  }, [signOut])

  const requestSignOut = useCallback(async () => {
    setError('')
    try {
      const status = await getOfflineQueueStatus(userId)
      if (status.userPending > 0 || status.hasUnassignedPending) {
        setQueueStatus(status)
        return false
      }
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível verificar os lançamentos salvos neste aparelho.'))
      return false
    }
    const confirmed = await confirm({
      title: 'Sair da conta',
      message: 'A sessão deste aparelho será encerrada. A preferência de tema será mantida.',
      confirmLabel: 'Sair',
    })
    if (!confirmed) return false
    return finishSignOut()
  }, [confirm, finishSignOut, userId])

  const wait = useCallback(() => {
    if (queueStatus) {
      void resolvePendingQueueExit('wait', queueStatus, {
        confirmDiscard: async () => false,
        sync: async () => undefined,
        getStatus: async () => queueStatus,
        signOut,
      })
    }
    setQueueStatus(null)
    setError('')
  }, [queueStatus, signOut])

  const trySend = useCallback(async () => {
    if (!queueStatus) return
    setBusy(true)
    setError('')
    try {
      const result = await resolvePendingQueueExit('send', queueStatus, {
        confirmDiscard: async () => false,
        sync: async () => {
          if (!userId) throw new Error('Não há uma conta atual para enviar os lançamentos.')
          if (!navigator.onLine) throw new Error('Sem conexão. Aguarde a sincronização ou descarte os lançamentos e saia.')
          await syncQueuedMovements(userId)
        },
        getStatus: () => getOfflineQueueStatus(userId),
        signOut,
      })
      if (result.action === 'blocked') {
        setError('Não há lançamentos vinculados à conta atual para enviar. Registros antigos não podem ser enviados com segurança.')
        return
      }
      if (result.action === 'signed-out') {
        setQueueStatus(null)
      } else if (result.action === 'pending') {
        setQueueStatus(result.status)
        setError(result.status.userPending > 0
          ? `Ainda há ${result.status.userPending} lançamento(s) aguardando envio.`
          : 'Registros antigos sem conta vinculada não podem ser enviados com segurança.')
      }
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível enviar os lançamentos.'))
    } finally {
      setBusy(false)
    }
  }, [queueStatus, signOut, userId])

  const discardAndSignOut = useCallback(async () => {
    if (!queueStatus) return
    setBusy(true)
    setError('')
    try {
      const result = await resolvePendingQueueExit('discard', queueStatus, {
        confirmDiscard: () => confirm({
          title: 'Descartar lançamentos offline?',
          message: 'Os lançamentos pendentes e os registros antigos sem conta vinculada serão removidos deste aparelho. Essa ação não pode ser desfeita.',
          confirmLabel: 'Descartar e sair',
        }),
        sync: async () => undefined,
        getStatus: () => getOfflineQueueStatus(userId),
        signOut,
      })
      if (result.action === 'signed-out') setQueueStatus(null)
    } catch (caught) {
      setError(traduzirErro(caught, 'Não foi possível descartar os lançamentos e sair.'))
    } finally {
      setBusy(false)
    }
  }, [confirm, queueStatus, signOut, userId])

  const dialog = queueStatus ? (
    <PendingQueueExitDialog
      userPending={queueStatus.userPending}
      hasUnassignedPending={queueStatus.hasUnassignedPending}
      busy={busy}
      error={error}
      onWait={wait}
      onTrySend={() => void trySend()}
      onDiscard={() => void discardAndSignOut()}
    />
  ) : null

  return { requestSignOut, dialog, error, busy }
}
