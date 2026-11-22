import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { PrivacyPolicyContent } from './PrivacyPolicyContent'
import { PrivacyPolicyDialog } from './PrivacyPolicyDialog'
import {
  focusFirstPrivacyPolicyDialogControl,
  handlePrivacyPolicyDialogKeydown,
} from './privacyPolicyKeyboard'

function renderDialog(open: boolean) {
  return renderToStaticMarkup(createElement(PrivacyPolicyDialog, {
    open,
    policyVersion: '1.0.0',
    busy: false,
    acceptError: '',
    onDismiss: () => undefined,
    onAccept: () => undefined,
  }))
}

function keyboardEvent(key: string, shiftKey = false) {
  let prevented = false
  return {
    event: {
      key,
      shiftKey,
      preventDefault: () => { prevented = true },
    },
    wasPrevented: () => prevented,
  }
}

describe('minuta do aviso de privacidade', () => {
  it('renderiza todas as seções obrigatórias', () => {
    const markup = renderToStaticMarkup(createElement(PrivacyPolicyContent))
    const dialog = renderDialog(true)
    const headings = [
      'Papéis e controladores',
      'Público',
      'Dados tratados e finalidades',
      'Acesso de suporte',
      'Dados armazenados no aparelho',
      'Compartilhamento e transferências internacionais',
      'Retenção e pedido de exclusão',
      'Seus direitos e como exercê-los',
      'Bases legais propostas',
      'Segurança e incidentes',
      'Backups e restauração',
      'Alterações, versão e vigência',
    ]

    for (const heading of headings) {
      expect(markup).toContain(heading)
      expect(dialog).toContain(heading)
    }
  })

  it('mostra o selo de minuta e a vigência não vigente', () => {
    const markup = renderToStaticMarkup(createElement(PrivacyPolicyContent))

    expect(markup).toContain('Minuta para revisão')
    expect(markup).toContain('Versão 1.0.0')
    expect(markup).toContain('Data de vigência: não vigente (minuta)')
    expect(markup).toContain('NÃO CONFIRMADO — TODO do responsável')
    expect(markup).toContain('mailto:desenvolvedor.aylton@gmail.com')
    expect(markup).not.toContain('>desenvolvedor.aylton@gmail.com<')
  })

  it('descreve a limpeza real por usuário e a confirmação de descarte da fila', () => {
    const markup = renderToStaticMarkup(createElement(PrivacyPolicyContent))

    expect(markup).toContain('apenas a preferência de tema é mantida')
    expect(markup).toContain('tentar enviá-los ou confirmar o descarte')
    expect(markup).toContain('não são exibidos nem enviados')
    expect(markup).toContain('limpeza de dados do site nas configurações')
  })

  it('renderiza o modal quando aberto e o oculta quando fechado', () => {
    expect(renderDialog(true)).toContain('role="dialog"')
    expect(renderDialog(true)).toContain('aria-modal="true"')
    expect(renderDialog(false)).toBe('')
  })

  it('move o foco para o primeiro controle quando o modal abre', () => {
    const closeButton = { focus: vi.fn() }
    const link = { focus: vi.fn() }

    focusFirstPrivacyPolicyDialogControl([closeButton, link])

    expect(closeButton.focus).toHaveBeenCalledOnce()
    expect(link.focus).not.toHaveBeenCalled()
  })

  it('fecha o modal com Escape', () => {
    const first = { focus: vi.fn() }
    const last = { focus: vi.fn() }
    const dismiss = vi.fn()
    const { event } = keyboardEvent('Escape')

    handlePrivacyPolicyDialogKeydown(event, first, first, last, dismiss)

    expect(dismiss).toHaveBeenCalledOnce()
  })

  it('mantém a navegação Tab dentro do modal', () => {
    const first = { focus: vi.fn() }
    const last = { focus: vi.fn() }
    const dismiss = vi.fn()
    const forward = keyboardEvent('Tab')
    const backward = keyboardEvent('Tab', true)

    handlePrivacyPolicyDialogKeydown(forward.event, last, first, last, dismiss)
    handlePrivacyPolicyDialogKeydown(backward.event, first, first, last, dismiss)

    expect(forward.wasPrevented()).toBe(true)
    expect(backward.wasPrevented()).toBe(true)
    expect(first.focus).toHaveBeenCalledOnce()
    expect(last.focus).toHaveBeenCalledOnce()
    expect(dismiss).not.toHaveBeenCalled()
  })
})
