import { describe, expect, it, vi } from 'vitest'
import { createActionGuard } from './actionGuard'

describe('ActionButton', () => {
  it('executa uma vez quando acionado em paralelo', async () => {
    const guard = createActionGuard()
    const action = vi.fn(async () => { await new Promise((resolve) => setTimeout(resolve, 10)) })
    const first = guard.run(action)
    const second = guard.run(action)
    expect(await second).toBe(false)
    expect(await first).toBe(true)
    expect(action).toHaveBeenCalledTimes(1)
  })
})
