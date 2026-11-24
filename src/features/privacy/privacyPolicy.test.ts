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
    policyVersion: '1.3.0',
    policyPublishedAt: '2026-11-24T06:24:15Z',
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

describe('política de privacidade 1.3.0', () => {
  it('renderiza todas as seções obrigatórias', () => {
    const markup = renderToStaticMarkup(createElement(PrivacyPolicyContent))
    const dialog = renderDialog(true)
    const headings = [
      'Quem controla e quem opera os dados',
      'Dados tratados',
      'Chat de suporte',
      'Dados guardados no aparelho',
      'Quem acessa os dados',
      'Empresas que ajudam a operar o aplicativo',
      'Exclusão da conta',
      'Finalidade, dados e retenção',
      'Direitos do titular',
      'Segurança e incidentes',
      'Backups',
      'Alterações desta política',
      'Histórico de versões',
    ]

    for (const heading of headings) {
      expect(markup).toContain(heading)
      expect(dialog).toContain(heading)
    }
  })

  it('renderiza a versão 1.3.0 sem dado de publicação', () => {
    const markup = renderToStaticMarkup(createElement(PrivacyPolicyContent))
    expect(markup).toContain('Versão 1.3.0 preparada para publicação.')
    expect(markup).toContain('Versão 1.3.0 · Última atualização: 24 de novembro de 2026')
    expect(markup).not.toContain('Em vigor desde')
  })

  it('renderiza o estado publicado com versão e data', () => {
    const markup = renderToStaticMarkup(createElement(PrivacyPolicyContent, {
      release: { version: '1.3.0', publishedAt: '2026-11-24T06:24:15Z' },
    }))
    expect(markup).toContain('Versão 1.3.0')
    expect(markup).toContain('Em vigor desde 24/11/2026')
    expect(markup).not.toContain('preparada para publicação')
    expect(markup).not.toContain('não está vigente')
  })

  it('não mistura os textos dos estados rascunho e publicado', () => {
    const draft = renderToStaticMarkup(createElement(PrivacyPolicyContent))
    const published = renderToStaticMarkup(createElement(PrivacyPolicyContent, {
      release: { version: '2.0.0', publishedAt: '2026-11-23T12:00:00Z' },
    }))
    expect(draft).not.toContain('Em vigor desde')
    expect(published).not.toContain('preparada para publicação')
  })

  it('mantém os textos finais obrigatórios da seção 8 e da seção 11', () => {
    const markup = renderToStaticMarkup(createElement(PrivacyPolicyContent))
    expect(markup).toContain('O prazo de resposta às solicitações será de até 15 dias.')
    expect(markup).toContain('Mensagens, anexos e histórico da empresa são mantidos')
    expect(markup).toContain('O aplicativo não cria cópia própria de todos os dados operacionais.')
  })

  it('não contém marcadores pendentes e rótulos mudam com o estado', () => {
    const draft = renderToStaticMarkup(createElement(PrivacyPolicyContent))
    const published = renderToStaticMarkup(createElement(PrivacyPolicyContent, {
      release: { version: '1.3.0', publishedAt: '2026-11-24T06:24:15Z' },
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

    expect(markup).toContain('O tema e os arquivos necessários para abrir o aplicativo podem permanecer')
    expect(markup).toContain('tentar enviar ou confirmar o descarte')
  })

  it('descreve as novas funcionalidades operacionais sem decisões silenciosas', () => {
    const markup = renderToStaticMarkup(createElement(PrivacyPolicyContent))
    expect(markup).toContain('Gerar alertas e sugestões')
    expect(markup).toContain('exigem revisão de uma pessoa')
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
