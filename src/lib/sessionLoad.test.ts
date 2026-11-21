import { describe, expect, it } from 'vitest'
import { SessionLoadDeduper } from './sessionLoad'

describe('deduplicação de carga da sessão', () => {
  it('não repete carga da mesma sessão', () => {
    const deduper = new SessionLoadDeduper()
    expect(deduper.shouldLoad('user-1')).toBe(true)
    deduper.finish('user-1')
    expect(deduper.shouldLoad('user-1')).toBe(false)
  })

  it('permite carregar novamente para sincronização', () => {
    const deduper = new SessionLoadDeduper()
    expect(deduper.shouldLoad('user-1')).toBe(true)
    deduper.finish('user-1')
    expect(deduper.shouldLoad('user-1', true)).toBe(true)
  })

  it('carrega outra sessão depois de troca de usuário', () => {
    const deduper = new SessionLoadDeduper()
    deduper.finish('user-1')
    expect(deduper.shouldLoad('user-2')).toBe(true)
  })
})
