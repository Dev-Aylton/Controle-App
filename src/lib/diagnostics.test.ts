import { describe, expect, it, vi } from 'vitest'
import { buildSanitizedMailDiagnostic, createSevenClickCounter } from './diagnostics'

describe('diagnóstico por sete cliques', () => {
  it('abre somente no sétimo clique dentro da janela', () => {
    const open = vi.fn()
    vi.spyOn(Date, 'now').mockReturnValue(1000)
    const click = createSevenClickCounter(open)
    for (let index = 0; index < 6; index++) click()
    expect(open).not.toHaveBeenCalled()
    click()
    expect(open).toHaveBeenCalledTimes(1)
  })
  it('remove erros técnicos e e-mail do corpo do reporte', () => {
    const text = buildSanitizedMailDiagnostic({
      version: '1.0.0', build: 'abc', online: true, layout: 'notebook', role: 'owner',
      companyId: '12345678-1234', pending: 0, width: 100, height: 100, browser: 'teste@example.com',
    })
    expect(text).not.toContain('teste@example.com')
    expect(text).not.toContain('Últimos erros técnicos')
  })
})
