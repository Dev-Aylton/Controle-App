import { describe, expect, it, vi } from 'vitest'
import { runDeleteAccountFlow } from './deleteAccount'

describe('exclusão de conta', () => {
  it('solicita a exclusão, encerra sessão e limpa dados locais nessa ordem', async () => {
    const order: string[] = []
    await runDeleteAccountFlow({
      callRpc: async () => { order.push('rpc') },
      signOut: async () => { order.push('signOut') },
      clearLocal: async () => { order.push('clearLocal') },
    })
    expect(order).toEqual(['rpc', 'signOut', 'clearLocal'])
  })
  it('não chama etapas seguintes se RPC falhar', async () => {
    const signOut = vi.fn()
    await expect(runDeleteAccountFlow({
      callRpc: async () => { throw new Error('rpc') },
      signOut,
      clearLocal: async () => undefined,
    })).rejects.toThrow('rpc')
    expect(signOut).not.toHaveBeenCalled()
  })

  it('limpa dados locais mesmo se o encerramento da sessão falhar após a exclusão', async () => {
    const clearLocal = vi.fn(async () => undefined)
    await expect(runDeleteAccountFlow({
      callRpc: async () => undefined,
      signOut: async () => { throw new Error('signOut') },
      clearLocal,
    })).rejects.toThrow('signOut')
    expect(clearLocal).toHaveBeenCalledOnce()
  })
})
