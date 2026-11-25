import type { CompanyRole } from '../../lib/database.types'

export type DemoRole = 'admin' | CompanyRole

export const DEMO_COMPANY_NAME = 'AURORA EVENTOS (FICTÍCIA)'

export type DemoProduct = {
  id: string
  name: string
  unit: 'un'
  volumeMl: number | null
  doseMl: number | null
  minStock: number
  maxStock: number
  cost: number
  balance: number
}

export type DemoMovement = {
  id: string
  productId: string
  environmentId: string
  type: 'entrada' | 'saida' | 'perda' | 'transferencia_saida' | 'transferencia_entrada' | 'estorno'
  quantity: number
  createdBy: 'employee'
  createdAt: string
  lossReasonId: string | null
}

export type DemoState = {
  role: DemoRole
  employeeActive: boolean
  codeVersion: number
  products: DemoProduct[]
  movements: DemoMovement[]
  importsUndone: string[]
  audit: string[]
  salesMap: Array<{ externalName: string; productId: string }>
  salesBatches: Array<{ id: string; label: string; status: 'applied'|'undone'; quantity: number }>
}

export const DEMO_ENVIRONMENTS = [
  { id: 'env-est', name: 'Estoque Central' },
  { id: 'env-jardim', name: 'Espaço Jardim' },
  { id: 'env-vip', name: 'Salão VIP' },
  { id: 'env-principal', name: 'Salão Principal' },
] as const

const names = [
  'Vodka Premium', 'Vodka Limão', 'Whisky Single', 'Whisky Reserva', 'Gin Londres',
  'Gin Rosa', 'Cachaça Ouro', 'Cachaça Prata', 'Rum Branco', 'Rum Escuro',
  'Tequila Prata', 'Licor de Café', 'Vermute Seco', 'Cerveja Pilsen', 'Cerveja IPA',
  'Cerveja Weiss', 'Água Mineral', 'Água com Gás', 'Refrigerante Cola',
  'Refrigerante Limão', 'Energia Citrus', 'Suco de Laranja', 'Suco de Caju',
  'Xarope Limão', 'Gelo em Cubos',
]

export function createDemoState(): DemoState {
  const products: DemoProduct[] = names.map((name, index) => {
    const beverage = index < 13
    return {
      id: `demo-product-${index + 1}`,
      name,
      unit: 'un',
      volumeMl: beverage ? (index % 3 === 0 ? 1000 : 700) : null,
      doseMl: beverage ? (index % 3 === 0 ? 50 : 30) : null,
      minStock: index === 3 || index === 14 ? 1 : 3 + (index % 4),
      maxStock: 8 + (index % 5),
      cost: 8 + (index % 7) * 3,
      balance: index === 3 ? -2 : index === 14 ? 0 : 4 + (index % 6),
    }
  })
  return {
    role: 'manager',
    employeeActive: true,
    codeVersion: 1,
    products,
    importsUndone: [],
    audit: ['Produtos e movimentações fictícios criados'],
    salesMap: [{ externalName: 'Vodka Premium', productId: products[0].id }],
    salesBatches: [],
    movements: [
      { id: 'demo-m1', productId: products[0].id, environmentId: 'env-est', type: 'entrada', quantity: 10, createdBy: 'employee', createdAt: '2026-11-20T18:00:00Z', lossReasonId: null },
      { id: 'demo-m2', productId: products[3].id, environmentId: 'env-vip', type: 'perda', quantity: 2, createdBy: 'employee', createdAt: '2026-11-21T20:00:00Z', lossReasonId: null },
      { id: 'demo-m3', productId: products[14].id, environmentId: 'env-principal', type: 'saida', quantity: 5, createdBy: 'employee', createdAt: '2026-11-21T21:00:00Z', lossReasonId: null },
    ],
  }
}

export function canUseSensitiveDemoData(role: DemoRole): boolean {
  return role === 'admin' || role === 'owner' || role === 'manager'
}

export function canLaunchDemo(role: DemoRole): boolean {
  return role === 'owner' || role === 'manager' || role === 'employee'
}

export function registerDemoMovement(state: DemoState, productId: string, environmentId: string, type: 'entrada'|'saida'|'perda', quantity: number): DemoMovement {
  if (!state.employeeActive && state.role === 'employee') throw new Error('Funcionário fictício desativado.')
  const product = state.products.find((item) => item.id === productId)
  if (!product) throw new Error('Produto fictício não encontrado.')
  if (quantity <= 0) throw new Error('Quantidade deve ser positiva.')
  const signed = type === 'entrada' ? quantity : -quantity
  if (type !== 'entrada' && product.balance + signed < 0) {
    throw new Error('Saldo insuficiente no ambiente fictício.')
  }
  product.balance += signed
  const movement: DemoMovement = {
    id: `demo-m-${Date.now()}-${state.movements.length}`,
    productId,
    environmentId,
    type,
    quantity,
    createdBy: 'employee',
    createdAt: new Date().toISOString(),
    lossReasonId: type === 'perda' ? null : null,
  }
  state.movements.unshift(movement)
  return movement
}

export function reverseDemoMovement(state: DemoState, movementId: string, role: DemoRole, employeeActive: boolean): DemoMovement {
  const movement = state.movements.find((item) => item.id === movementId)
  if (!movement) throw new Error('Movimentação fictícia não encontrada.')
  if (role === 'admin') throw new Error('Administrador não estorna movimentos.')
  if (role === 'employee' && (!employeeActive || movement.createdBy !== 'employee')) {
    throw new Error('Funcionário não pode estornar esta movimentação.')
  }
  const product = state.products.find((item) => item.id === movement.productId)
  if (product) product.balance -= movement.quantity
  const estorno: DemoMovement = {
    id: `demo-estorno-${Date.now()}`,
    productId: movement.productId,
    environmentId: movement.environmentId,
    type: 'estorno',
    quantity: movement.quantity,
    createdBy: 'employee',
    createdAt: new Date().toISOString(),
    lossReasonId: null,
  }
  state.movements.unshift(estorno)
  return estorno
}

export function calculateDosesPerUnit(volumeMl: number | null, doseMl: number | null): number | null {
  if (!volumeMl || !doseMl || doseMl <= 0) return null
  return Math.floor(volumeMl / doseMl)
}

export function registerDemoDoseMovement(state: DemoState, productId: string, environmentId: string, kind: 'entrada'|'saida'|'perda', doses: number): DemoMovement {
  const product = state.products.find((item) => item.id === productId)
  if (!product) throw new Error('Produto fictício não encontrado.')
  const dosesPerUnit = calculateDosesPerUnit(product.volumeMl, product.doseMl)
  if (!dosesPerUnit) throw new Error('Produto sem volume ou dose cadastrados.')
  if (doses <= 0) throw new Error('Quantidade de doses deve ser positiva.')
  return registerDemoMovement(state, productId, environmentId, kind, doses / dosesPerUnit)
}

export function zeroDemoStock(state: DemoState, productId: string | null, reason: string, role: DemoRole): number {
  if (role !== 'owner' && role !== 'manager') throw new Error('Somente proprietário ou gerente pode zerar.')
  if (!reason.trim()) throw new Error('Motivo da zeragem é obrigatório.')
  let adjusted = 0
  for (const product of state.products) {
    if (productId && product.id !== productId) continue
    if (product.balance !== 0) {
      product.balance = 0
      adjusted += 1
    }
  }
  state.audit.unshift(`Zeragem fictícia: ${reason} (${adjusted} produto(s))`)
  return adjusted
}

export function finishDemoInventory(state: DemoState, role: DemoRole, counted: Record<string, number>): number {
  if (role !== 'owner' && role !== 'manager') throw new Error('Somente proprietário ou gerente finaliza inventário.')
  let adjusted = 0
  for (const [productId, count] of Object.entries(counted)) {
    const product = state.products.find((item) => item.id === productId)
    if (!product) continue
    if (product.balance !== count) {
      product.balance = count
      adjusted += 1
    }
  }
  state.audit.unshift(`Inventário fictício finalizado (${adjusted} divergência(s))`)
  return adjusted
}

export function getDemoPurchaseItems(state: DemoState) {
  return state.products.filter((product) => product.balance <= product.minStock).map((product) => ({
    productId: product.id,
    name: product.name,
    balance: product.balance,
    minimum: product.minStock,
    suggestion: Math.max(1, product.maxStock - product.balance),
  }))
}

export function importDemoSales(state: DemoState, items: Array<{ externalName: string; productId: string; quantity: number; saleType: 'unidade'|'dose' }>): string {
  let quantity = 0
  for (const item of items) {
    const product = state.products.find((candidate) => candidate.id === item.productId)
    if (!product) throw new Error('Item sem vínculo na demonstração.')
    if (item.saleType === 'dose') {
      const dosesPerUnit = calculateDosesPerUnit(product.volumeMl, product.doseMl)
      if (!dosesPerUnit) throw new Error('Produto sem dose cadastrada.')
      product.balance -= item.quantity / dosesPerUnit
    } else {
      product.balance -= item.quantity
    }
    quantity += item.quantity
  }
  const batchId = `demo-batch-${Date.now()}`
  state.salesBatches.unshift({ id: batchId, label: 'Importação demonstrativa', status: 'applied', quantity })
  state.audit.unshift(`Importação de vendas fictícia (${quantity})`)
  return batchId
}

export function undoDemoSales(state: DemoState, batchId: string): void {
  const batch = state.salesBatches.find((item) => item.id === batchId)
  if (!batch) throw new Error('Lote fictício não encontrado.')
  if (batch.status === 'undone') throw new Error('Lote já desfeito.')
  batch.status = 'undone'
  state.audit.unshift('Importação fictícia desfeita')
}
