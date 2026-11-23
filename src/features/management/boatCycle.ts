export type BoatCycleMovement = {
  type: 'entrada' | 'saida' | 'perda' | 'transferencia_saida' | 'transferencia_entrada' | 'ajuste_inventario' | 'estorno'
  quantity: number
  signed_quantity: number
  environment_id: string
  transfer_group_id: string | null
  created_at: string
  note: string | null
}

export type DestinationCycleAnalysis = {
  initialDestinationBalance: number
  withdrawn: number
  directPurchase: number
  sold: number
  losses: number
  directOut: number
  returned: number
  expectedDestinationBalance: number
  actualDestinationBalance: number
  unexplainedDifference: number
  status: 'ok' | 'missing' | 'surplus'
  summary: string
}

export type BoatCycleAnalysis = DestinationCycleAnalysis

export function analyzeBoatCycle(
  initialDestinationBalance: number,
  withdrawn: number,
  sold: number,
  losses: number,
  returned: number,
  actualDestinationBalance: number,
  directOut = 0,
  directPurchase = 0,
): DestinationCycleAnalysis {
  const expectedDestinationBalance = Number((
    initialDestinationBalance
    + withdrawn
    + directPurchase
    - sold
    - losses
    - returned
    - directOut
  ).toFixed(3))
  const unexplainedDifference = Number((
    actualDestinationBalance - expectedDestinationBalance
  ).toFixed(3))
  const status = unexplainedDifference < 0
    ? 'missing'
    : unexplainedDifference > 0
      ? 'surplus'
      : 'ok'
  const summary = status === 'ok'
    ? 'O saldo do ambiente de destino coincide com retirada, entrada direta, venda, perdas e devolução.'
    : status === 'missing'
      ? `Faltam ${Math.abs(unexplainedDifference)} unidade(s) no ambiente de destino além das operações registradas.`
      : `Há ${unexplainedDifference} unidade(s) a mais no ambiente de destino além das operações registradas.`
  return {
    initialDestinationBalance,
    withdrawn,
    sold,
    losses,
    directOut,
    directPurchase,
    returned,
    expectedDestinationBalance,
    actualDestinationBalance,
    unexplainedDifference,
    status,
    summary,
  }
}

export function calculateBoatCycleFromMovements(
  movements: BoatCycleMovement[],
  boatEnvironmentId: string,
  initialBoatBalance: number,
  actualBoatBalance: number,
): DestinationCycleAnalysis {
  let withdrawn = 0
  let sold = 0
  let losses = 0
  let returned = 0
  let directOut = 0
  let directPurchase = 0

  for (const movement of movements) {
    const quantity = Number(movement.quantity)
    if (movement.environment_id === boatEnvironmentId) {
      if (movement.type === 'entrada') directPurchase += quantity
      if (movement.type === 'transferencia_entrada') withdrawn += quantity
      if (movement.type === 'transferencia_saida') returned += quantity
      if (movement.type === 'saida') {
        if (/venda/i.test(movement.note ?? '')) sold += quantity
        else directOut += quantity
      }
      if (movement.type === 'perda') losses += quantity
    }
  }

  return analyzeBoatCycle(
    initialBoatBalance,
    withdrawn,
    sold,
    losses,
    returned,
    actualBoatBalance,
    directOut,
    directPurchase,
  )
}
