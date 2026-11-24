import * as XLSX from 'xlsx'
import type { PurchaseDraftItem } from './purchaseListDraft'
import { calculatePurchaseDraftEstimated, calculatePurchaseDraftTotal } from './purchaseListDraft'

export function buildPurchaseListExportRows(items: PurchaseDraftItem[]) {
  const visibleItems = items.filter((item) => item.quantity > 0 && item.draftAction !== 'fora')
  const total = calculatePurchaseDraftTotal(visibleItems)
  return [
    ['Produto', 'Ambiente', 'Quantidade', 'Unidade', 'Fornecedor', 'Custo unitário', 'Custo estimado', 'Ação'],
    ...visibleItems.map((item) => [
      item.productName,
      item.environmentName,
      item.quantity,
      item.purchaseUnit ?? 'un',
      item.supplierName ?? '',
      item.unitCost,
      calculatePurchaseDraftEstimated(item),
      item.draftAction === 'transferir' ? 'Transferir' : 'Comprar',
    ]),
    ['Total', '', '', '', '', '', total.hasMissingCost ? 'Custo ausente em itens' : total.total, ''],
  ]
}

export function downloadPurchaseListXlsx(companyName: string, items: PurchaseDraftItem[]) {
  const worksheet = XLSX.utils.aoa_to_sheet(buildPurchaseListExportRows(items))
  worksheet['!cols'] = [
    { wch: 30 }, { wch: 24 }, { wch: 12 }, { wch: 12 },
    { wch: 26 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
  ]
  worksheet['!autofilter'] = { ref: `A1:H${buildPurchaseListExportRows(items).length}` }
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Lista de compras')
  XLSX.writeFile(workbook, `${companyName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-compras-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
