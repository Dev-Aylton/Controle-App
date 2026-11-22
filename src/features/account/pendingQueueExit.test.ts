import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { PendingQueueExitDialog } from './PendingQueueExitDialog'
import { resolvePendingQueueExit, type QueueExitStatus } from './pendingQueueExit'

const pendingStatus: QueueExitStatus = { userPending: 3, hasUnassignedPending: false }
const emptyStatus: QueueExitStatus = { userPending: 0, hasUnassignedPending: false }

function createDependencies() {
  return {
    confirmDiscard: vi.fn(async () => true),
    sync: vi.fn(async () => undefined),
    getStatus: vi.fn(async () => emptyStatus),
    signOut: vi.fn(async () => undefined),
  }
}

describe('opções de saída com fila offline', () => {
  it('mostra o aviso e as três opções para lançamentos pendentes', () => {
    const markup = renderToStaticMarkup(createElement(PendingQueueExitDialog, {
      userPending: 3,
      hasUnassignedPending: false,
      busy: false,
      error: '',
      onWait: () => undefined,
      onTrySend: () => undefined,
      onDiscard: () => undefined,
    }))

    expect(markup).toContain('Há 3 lançamentos aguardando envio. Aguarde a sincronização ou descarte-os e saia.')
    expect(markup).toContain('Aguardar')
    expect(markup).toContain('Tentar enviar agora')
    expect(markup).toContain('Descartar e sair')
  })

  it('Aguardar fecha o aviso sem enviar, descartar ou sair', async () => {
    const dependencies = createDependencies()

    await expect(resolvePendingQueueExit('wait', pendingStatus, dependencies)).resolves.toEqual({ action: 'wait' })
    expect(dependencies.sync).not.toHaveBeenCalled()
    expect(dependencies.signOut).not.toHaveBeenCalled()
  })

  it('Tentar enviar sincroniza e só sai quando a fila estiver vazia', async () => {
    const dependencies = createDependencies()

    await expect(resolvePendingQueueExit('send', pendingStatus, dependencies)).resolves.toEqual({ action: 'signed-out' })
    expect(dependencies.sync).toHaveBeenCalledOnce()
    expect(dependencies.signOut).toHaveBeenCalledWith(false)
  })

  it('Descartar e sair exige confirmação e autoriza a remoção dos pendentes', async () => {
    const dependencies = createDependencies()

    await expect(resolvePendingQueueExit('discard', pendingStatus, dependencies)).resolves.toEqual({ action: 'signed-out' })
    expect(dependencies.confirmDiscard).toHaveBeenCalledOnce()
    expect(dependencies.signOut).toHaveBeenCalledWith(true)
    expect(dependencies.sync).not.toHaveBeenCalled()
  })
})
