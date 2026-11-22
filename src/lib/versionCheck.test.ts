import { describe, expect, it } from 'vitest'
import { buildReportBody, isNewerVersion } from './versionCheck'

describe('checagem de versão', () => {
  it('detecta versão ou build diferente', () => {
    expect(isNewerVersion({ version: '1.0.0', build: 'a' }, { version: '1.0.1', build: 'b' })).toBe(true)
    expect(isNewerVersion({ version: '1.0.0', build: 'a' }, { version: '1.0.0', build: 'a' })).toBe(false)
  })
  it('monta corpo do e-mail sanitizado', () => {
    expect(buildReportBody('1.0.0', 'abc', 'Resumo seguro')).toContain('Resumo seguro')
  })
})
