export type StockGapMovement = {
  type: string
  quantity: number
  signed_quantity: number
  created_at: string
  note: string | null
  environment_id: string
}

export type StockGapCount = {
  opened_at: string
  counted_quantity: number
  finished_at: string | null
  session_id: string
}

export type StockGapAnalysis = {
  initialCount: number
  finalCount: number
  expectedFinal: number
  unexplainedGap: number
  sales: number
  losses: number
  entradas: number
  saidas: number
  transferenciasSaida: number
  transferenciasEntrada: number
  ajustes: number
  estornos: number
  status: 'ok' | 'loss' | 'surplus'
  summary: string
}

export function analyzeStockGap(
  initialCount: number,
  finalCount: number,
  movements: StockGapMovement[],
): StockGapAnalysis {
  let entradas = 0
  let saidas = 0
  let losses = 0
  let sales = 0
  let transferenciasSaida = 0
  let transferenciasEntrada = 0
  let ajustes = 0
  let estornos = 0

  for (const movement of movements) {
    const quantity = Number(movement.quantity)
    const signed = Number(movement.signed_quantity)
    switch (movement.type) {
      case 'entrada':
        entradas += quantity
        break
      case 'saida':
        saidas += quantity
        if (/^Venda:/i.test(movement.note ?? '') || movement.note?.toLowerCase().includes('venda')) {
          sales += quantity
        }
        break
      case 'perda':
        losses += quantity
        break
      case 'transferencia_saida':
        transferenciasSaida += quantity
        break
      case 'transferencia_entrada':
        transferenciasEntrada += quantity
        break
      case 'ajuste_inventario':
        ajustes += signed
        break
      case 'estorno':
        estornos += signed
        break
    }
  }

  const expectedFinal = initialCount
    + entradas
    + transferenciasEntrada
    - saidas
    - losses
    - transferenciasSaida
    + ajustes
    + estornos

  const unexplainedGap = Number((finalCount - expectedFinal).toFixed(3))
  const status = unexplainedGap < 0 ? 'loss' : unexplainedGap > 0 ? 'surplus' : 'ok'
  const summary = status === 'ok'
    ? 'Nenhuma diferença não explicada foi encontrada entre as contagens.'
    : status === 'loss'
      ? `Faltam ${Math.abs(unexplainedGap)} unidade(s) além das entradas, vendas, perdas, saídas, transferências e ajustes registrados.`
      : `Há ${unexplainedGap} unidade(s) a mais além das entradas, vendas, perdas, saídas, transferências e ajustes registrados.`

  return {
    initialCount,
    finalCount,
    expectedFinal: Number(expectedFinal.toFixed(3)),
    unexplainedGap,
    sales,
    losses,
    entradas,
    saidas,
    transferenciasSaida,
    transferenciasEntrada,
    ajustes,
    estornos,
    status,
    summary,
  }
}
