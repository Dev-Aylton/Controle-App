import type { SVGProps } from 'react'

type Props = SVGProps<SVGSVGElement> & { label: string }

const paths: Record<string, string> = {
  Início: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1v-8.5Z',
  Ambientes: 'M4 20V8l8-5 8 5v12H4Zm4 0v-7h8v7M8 9h8',
  Produtos: 'M5 7h14l2 4-2 10H5L3 11l2-4Zm2 0 2-4h6l2 4M9 11h6',
  Movimentações: 'M4 7h15m0 0-4-4m4 4-4 4M20 17H5m0 0 4-4m-4 4 4 4',
  'Saldo por ambiente': 'M5 4h14v16H5V4Zm3 5h8m-8 4h8m-8 4h5',
  Inventário: 'M5 5h14v16H5V5Zm3-2h8v4H8V3Zm1 9 2 2 5-5',
  Alertas: 'M12 3 3 20h18L12 3Zm0 6v5m0 3h.01',
  'Lista de compras': 'M3 5h3l2 11h10l2-7H7m2 11h.01M17 20h.01M11 9V5m-2 2h4',
  Relatórios: 'M5 20V10m5 10V4m5 16v-7m5 7V7',
  Auditoria: 'M7 3h10l3 3v15H4V3h3Zm2 0v4h6V3M8 12h8m-8 4h6',
  Vendas: 'M3 6h3l2 11h11l2-8H7m2 4h10M9 21h.01M18 21h.01',
  'Preços de venda': 'M12 2v20m5-15H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  Configurações: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5 2 2 3-1 1 3 3 1-2 3 2 3-3 1-1 3-3-1-2 2-2-2-3 1-1-3-3-1 2-3-2-3 3-1 1-3 3 1 2-2Z',
  Empresa: 'M4 20V5h12v15H4Zm2-11h3m2 0h3m-8 4h3m2 0h3m-5 7v-3',
  Equipe: 'M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 1a3 3 0 1 0 0-6M2 21v-3a5 5 0 0 1 10 0v3m2-5a5 5 0 0 1 8 4v1',
  'Meu perfil': 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0',
  Suporte: 'M4 5h16v11H9l-5 4v-4H4V5Zm4 5h8m-8 3h5',
  'Mais opções': 'M4 6h16M4 12h16M4 18h16',
}

export function NavigationIcon({ label, ...props }: Props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
      <path d={paths[label] ?? paths.Produtos} />
    </svg>
  )
}
