import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { PrivacyPolicyContent } from './PrivacyPolicyContent'
import { PrivacyPolicyDialog } from './PrivacyPolicyDialog'
import { formatPrivacyPolicyDate, getPrivacyPolicyLinkLabel } from './privacyPolicyStatus'
import {
  focusFirstPrivacyPolicyDialogControl,
  handlePrivacyPolicyDialogKeydown,
} from './privacyPolicyKeyboard'

function renderDialog(open: boolean) {
  return renderToStaticMarkup(createElement(PrivacyPolicyDialog, {
    open,
    policyVersion: '1.1.0',
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
      'Quem controla os dados',
      'Quem pode usar o aplicativo',
      'Quais dados são usados',
      'Quando há suporte administrativo',
      'Dados guardados neste aparelho',
      'Empresas que ajudam a operar o aplicativo',
      'Quanto tempo os dados ficam guardados e como excluir a conta',
      'Seus direitos e como solicitar',
      'Bases legais adotadas',
      'Segurança e resposta a problemas',
      'Backups e restauração',
      'Alterações, versão e vigência',
    ]

    for (const heading of headings) {
      expect(markup).toContain(heading)
      expect(dialog).toContain(heading)
    }
  })

  it('renderiza o estado rascunho sem dado de versão', () => {
    const markup = renderToStaticMarkup(createElement(PrivacyPolicyContent))
    expect(markup).toContain('Minuta para revisão — esta versão não foi publicada e não está vigente.')
    expect(markup).toContain('Versão 1.1.0')
    expect(markup).toContain('Data de vigência: não vigente (minuta)')
    expect(markup).not.toContain('Em vigor desde')
  })

  it('renderiza o estado publicado com versão e data', () => {
    const markup = renderToStaticMarkup(createElement(PrivacyPolicyContent, {
      release: { version: '1.2.0', publishedAt: '2026-11-23T12:00:00Z' },
    }))
    expect(markup).toContain('Versão 1.2.0 · Em vigor desde 23/11/2026')
    expect(markup).toContain('Esta é a versão 1.2.0, em vigor desde 23/11/2026.')
    expect(markup).not.toContain('Minuta para revisão')
    expect(markup).not.toContain('não está vigente')
  })

  it('não mistura os textos dos estados rascunho e publicado', () => {
    const draft = renderToStaticMarkup(createElement(PrivacyPolicyContent))
    const published = renderToStaticMarkup(createElement(PrivacyPolicyContent, {
      release: { version: '2.0.0', publishedAt: '2026-11-23T12:00:00Z' },
    }))
    expect(draft).not.toContain('Em vigor desde')
    expect(published).not.toContain('Minuta para revisão')
  })

  it('mantém os textos finais obrigatórios da seção 8 e da seção 11', () => {
    const markup = renderToStaticMarkup(createElement(PrivacyPolicyContent))
    expect(markup).toContain('Responderemos em até 15 dias, nos termos da LGPD.')
    expect(markup).toContain('Se o pedido for sobre dados operacionais, indicaremos a empresa responsável e, quando necessário, repassaremos o pedido a ela.')
    expect(markup).toContain('O plano atual do Supabase não inclui backups automáticos')
  })

  it('não contém marcadores pendentes e rótulos mudam com o estado', () => {
    const draft = renderToStaticMarkup(createElement(PrivacyPolicyContent))
    const published = renderToStaticMarkup(createElement(PrivacyPolicyContent, {
      release: { version: '1.0.0', publishedAt: '2026-11-23T12:00:00Z' },
    }))
    for (const markup of [draft, published]) {
      expect(markup).not.toContain('Ponto a confirmar')
      expect(markup).not.toContain('PENDENTE')
      expect(markup).not.toContain('NÃO CONFIRMADO')
      expect(markup).not.toContain('TODO')
    }
    expect(getPrivacyPolicyLinkLabel(null)).toBe('Aviso de Privacidade (minuta)')
    expect(getPrivacyPolicyLinkLabel({ version: '1.0.0', publishedAt: '2026-11-23T12:00:00Z' })).toBe('Aviso de Privacidade')
    expect(formatPrivacyPolicyDate('2026-11-23T12:00:00Z')).toBe('23/11/2026')
  })

  it('descreve a limpeza real por usuário e a confirmação de descarte da fila', () => {
    const markup = renderToStaticMarkup(createElement(PrivacyPolicyContent))

    expect(markup).toContain('apenas a preferência de tema é mantida')
    expect(markup).toContain('tentar enviá-los ou confirmar o descarte')
    expect(markup).toContain('não são exibidos nem enviados')
  })

  it('descreve as novas funcionalidades operacionais sem decisões silenciosas', () => {
    const markup = renderToStaticMarkup(createElement(PrivacyPolicyContent))
    expect(markup).toContain('Contagens, divergências, furos e sugestões de reposição')
    expect(markup).toContain('exigem revisão ou confirmação humana')
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
