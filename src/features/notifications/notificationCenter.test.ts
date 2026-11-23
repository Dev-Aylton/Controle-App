import { beforeEach, describe, expect, it } from 'vitest'
import { loadNotificationState, saveNotificationState } from './notificationCenter'

describe('centro de notificações', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value) },
        removeItem: (key: string) => { values.delete(key) },
        clear: () => { values.clear() },
      },
    })
  })

  it('persiste avisos lidos por empresa e usuário', () => {
    saveNotificationState('company-a', 'user-a', {
      readIds: ['negative:p1:e1'],
      dismissedIds: [],
    })
    expect(loadNotificationState('company-a', 'user-a').readIds).toContain('negative:p1:e1')
  })

  it('mantém dispensa separada de leitura', () => {
    saveNotificationState('company-a', 'user-a', {
      readIds: ['low:p1:e1'],
      dismissedIds: ['low:p1:e1'],
    })
    const state = loadNotificationState('company-a', 'user-a')
    expect(state.readIds).toContain('low:p1:e1')
    expect(state.dismissedIds).toContain('low:p1:e1')
  })

  it('não mistura estados de empresas diferentes', () => {
    saveNotificationState('company-a', 'user-a', {
      readIds: ['one'],
      dismissedIds: [],
    })
    saveNotificationState('company-b', 'user-a', {
      readIds: ['two'],
      dismissedIds: [],
    })
    expect(loadNotificationState('company-a', 'user-a').readIds).toEqual(['one'])
    expect(loadNotificationState('company-b', 'user-a').readIds).toEqual(['two'])
  })
})
