import type { CompanyRole } from '../lib/database.types'

export const NAVIGATION_ITEMS = [
  { label: 'Início', shortLabel: 'Início', path: '/', icon: 'H' },
  { label: 'Empresa', shortLabel: 'Empresa', path: '/empresa', icon: 'E' },
  { label: 'Ambientes', shortLabel: 'Ambientes', path: '/ambientes', icon: 'A' },
  { label: 'Produtos', shortLabel: 'Produtos', path: '/produtos', icon: 'P' },
  { label: 'Movimentações', shortLabel: 'Mov.', path: '/movimentacoes', icon: 'M' },
  { label: 'Vendas', shortLabel: 'Vendas', path: '/vendas/importar', icon: 'V' },
  { label: 'Preços de venda', shortLabel: 'Preços', path: '/vendas/precos', icon: '$' },
  { label: 'Saldo por ambiente', shortLabel: 'Saldo', path: '/estoque/saldo', icon: 'S' },
  { label: 'Inventário', shortLabel: 'Inventário', path: '/inventario', icon: 'I' },
  { label: 'Alertas', shortLabel: 'Alertas', path: '/alertas', icon: '!' },
  { label: 'Lista de compras', shortLabel: 'Compras', path: '/compras', icon: 'C+' },
  { label: 'Relatórios', shortLabel: 'Relatórios', path: '/relatorios', icon: 'R' },
  { label: 'Auditoria', shortLabel: 'Auditoria', path: '/auditoria', icon: 'A+' },
  { label: 'Equipe', shortLabel: 'Equipe', path: '/equipe', icon: 'T' },
  { label: 'Meu perfil', shortLabel: 'Perfil', path: '/perfil', icon: 'P' },
  { label: 'Suporte', shortLabel: 'Suporte', path: '/suporte', icon: '?' },
] as const

export type NavigationItem = typeof NAVIGATION_ITEMS[number]
export type NavigationGroup = {
  label: string
  items: NavigationItem[]
}

const byPath = new Map(NAVIGATION_ITEMS.map((item) => [item.path, item]))

function group(label: string, paths: string[]): NavigationGroup {
  return {
    label,
    items: paths.map((path) => byPath.get(path as NavigationItem['path'])).filter((item): item is NavigationItem => Boolean(item)),
  }
}

export function getNavigationGroups(role: CompanyRole | null, isAdmin: boolean): NavigationGroup[] {
  if (role === 'employee' && !isAdmin) {
    return [
      group('Meu trabalho', ['/', '/movimentacoes', '/estoque/saldo', '/inventario', '/compras']),
      group('Consulta', ['/produtos', '/ambientes']),
      group('Conta e ajuda', ['/perfil', '/suporte']),
    ]
  }

  if (!isAdmin && role !== 'owner' && role !== 'manager') {
    return [
      group('Primeiros passos', ['/', '/empresa']),
      group('Conta e ajuda', ['/perfil', '/suporte']),
    ]
  }

  return [
    group('Visão geral', ['/', '/alertas']),
    group('Operação diária', ['/movimentacoes', '/estoque/saldo', '/inventario', '/compras']),
    group('Cadastros', ['/produtos', '/ambientes']),
    group('Vendas', ['/vendas/importar', '/vendas/precos']),
    group('Gestão', ['/relatorios', '/auditoria', '/equipe', '/empresa']),
    group('Conta e ajuda', ['/perfil', '/suporte']),
  ]
}
