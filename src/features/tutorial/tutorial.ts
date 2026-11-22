import type { CompanyRole } from '../../lib/database.types'

export type TutorialStep = { title: string; body: string }

export function getTutorialSteps(role: CompanyRole | null, isAdmin: boolean): TutorialStep[] {
  if (isAdmin) return [
    { title: 'Modo suporte', body: 'Você pode operar qualquer empresa. Suas ações ficam marcadas como suporte na auditoria.' },
    { title: 'Acompanhamento', body: 'Use alertas, relatórios, equipe e auditoria para investigar problemas sem alterar o histórico.' },
  ]
  if (role === 'employee') return [
    { title: 'Lançamentos', body: 'Registre entradas, saídas e perdas. Em transferências, informe origem, destino e quantidade.' },
    { title: 'Correção', body: 'Você pode estornar seu próprio lançamento por até 15 minutos.' },
    { title: 'Inventário cego', body: 'Conte sem consultar saldo e salve cada quantidade; o gerente finaliza a sessão.' },
  ]
  return [
    { title: 'Cadastros', body: 'Mantenha ambientes, produtos, categorias, importações e custo atualizados.' },
    { title: 'Estoque', body: 'Use dose, garrafa aberta, zeragem, alertas, compras e saldo por ambiente.' },
    { title: 'Gestão', body: 'Acompanhe painel, relatórios, auditoria e inventários.' },
    { title: 'Vendas', body: 'Importe CSV/XLSX, vincule itens ao mapa e desfaça lotes quando necessário.' },
    { title: 'Equipe', body: 'Gerencie membros e código da empresa conforme seu cargo.' },
  ]
}

export function dismissTutorial(storage: Pick<Storage, 'setItem'> | null, role: string) {
  try {
    storage?.setItem(`controle-app-tutorial-dismissed-${role}`, 'true')
  } catch {
    // Tutorial opcional: a ausência de armazenamento não bloqueia o app.
  }
}

export function getTutorialStorage(): Storage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function wasTutorialDismissed(storage: Pick<Storage, 'getItem'> | null, role: string) {
  try {
    return storage?.getItem(`controle-app-tutorial-dismissed-${role}`) === 'true'
  } catch {
    return false
  }
}
