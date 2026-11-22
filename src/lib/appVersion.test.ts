import { describe, expect, it } from 'vitest'
import { getAppVersion, formatAppVersion } from './appVersion'

describe('versão do app', () => {
  it('retorna versão e build', () => {
    expect(formatAppVersion()).toMatch(/^v/)
    expect(getAppVersion()).toHaveProperty('build')
  })
})
