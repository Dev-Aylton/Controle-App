import type { CompanyRole } from '../lib/database.types'

export type MobileNavKey = 'home' | 'movements' | 'stock' | 'alerts' | 'inventory' | 'products' | 'more'

export function getMobileNavItems(role: CompanyRole | null, isAdmin: boolean) {
  if (isAdmin || role === 'owner' || role === 'manager') {
    return [
      { key: 'home', label: 'Início', path: '/' },
      { key: 'movements', label: 'Mov.', path: '/movimentacoes' },
      { key: 'stock', label: 'Saldo', path: '/estoque/saldo' },
      { key: 'products', label: 'Produtos', path: '/produtos' },
      { key: 'more', label: 'Mais', path: '#' },
    ] as const
  }
  return [
    { key: 'home', label: 'Início', path: '/' },
    { key: 'movements', label: 'Mov.', path: '/movimentacoes' },
    { key: 'stock', label: 'Saldo', path: '/estoque/saldo' },
    { key: 'inventory', label: 'Inventário', path: '/inventario' },
    { key: 'more', label: 'Mais', path: '#' },
  ] as const
}

export function getNavigationIconLabel(key: MobileNavKey) {
  const labels: Record<MobileNavKey, string> = {
    home: 'Início',
    movements: 'Movimentações',
    stock: 'Saldo por ambiente',
    alerts: 'Alertas',
    inventory: 'Inventário',
    products: 'Produtos',
    more: 'Mais opções',
  }
  return labels[key]
}
