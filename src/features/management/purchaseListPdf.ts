import { jsPDF } from 'jspdf'
import type { PurchaseDraftItem } from './purchaseListDraft'
import { calculatePurchaseDraftEstimated, calculatePurchaseDraftTotal } from './purchaseListDraft'

function formatBrl(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

async function getLogoDataUrl() {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}pwa-192x192.png`)
    if (!response.ok) return null
    const blob = await response.blob()
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

export async function downloadPurchaseListPdf(
  companyName: string,
  environmentName: string,
  items: PurchaseDraftItem[],
) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 14
  const logo = await getLogoDataUrl()
  const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date())
  const visibleItems = items.filter((item) => item.quantity > 0)

  pdf.setFillColor(31, 122, 101)
  pdf.rect(0, 0, pageWidth, 34, 'F')
  if (logo) {
    pdf.addImage(logo, 'PNG', margin, 5, 24, 24)
  }
  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(17)
  pdf.text('Lista de compras', margin + (logo ? 29 : 0), 16)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(companyName, margin + (logo ? 29 : 0), 23)
  pdf.text(environmentName === 'Todos' ? 'Todos os ambientes' : environmentName, margin + (logo ? 29 : 0), 28)

  pdf.setTextColor(23, 58, 53)
  pdf.setFontSize(9)
  pdf.text(date, margin, 43)

  let y = 52
  pdf.setFillColor(231, 243, 239)
  pdf.roundedRect(margin, y, pageWidth - margin * 2, 10, 2, 2, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(9)
  pdf.text('Produto', margin + 3, y + 6.5)
  pdf.text('Ambiente', 104, y + 6.5)
  pdf.text('Qtd.', 155, y + 6.5)
  pdf.text('Estimado', 172, y + 6.5)

  y += 14
  pdf.setFont('helvetica', 'normal')
  for (const item of visibleItems) {
    if (y > 268) {
      pdf.addPage()
      y = 18
    }
    const estimated = calculatePurchaseDraftEstimated(item)
    pdf.setTextColor(23, 58, 53)
    pdf.setFontSize(9)
    pdf.text(item.productName.slice(0, 48), margin + 3, y)
    pdf.text(item.environmentName.slice(0, 24), 104, y)
    pdf.text(String(item.quantity), 155, y)
    pdf.text(estimated === null ? '-' : formatBrl(estimated), 172, y)
    pdf.setDrawColor(215, 226, 221)
    pdf.line(margin, y + 3, pageWidth - margin, y + 3)
    y += 9
  }

  if (visibleItems.length === 0) {
    pdf.text('Nenhum item selecionado.', margin + 3, y)
  }

  const totals = calculatePurchaseDraftTotal(visibleItems)
  y += 8
  if (y > 268) {
    pdf.addPage()
    y = 18
  }
  pdf.setFillColor(247, 250, 248)
  pdf.roundedRect(margin, y, pageWidth - margin * 2, 16, 2, 2, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text('Total estimado', margin + 3, y + 10)
  pdf.text(totals.hasMissingCost ? 'Não disponível — custo ausente' : formatBrl(totals.total), pageWidth - margin - 3, y + 10, { align: 'right' })

  pdf.setProperties({
    title: `Lista de compras - ${companyName}`,
    subject: 'Lista de compras preparada no Controle-App',
    author: 'Controle-App',
  })
  pdf.save(`lista-compras-${companyName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`)
}

export async function downloadBlankPurchaseListPdf(
  companyName: string,
  environmentName: string,
) {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = pdf.internal.pageSize.getWidth()
  const margin = 14
  const logo = await getLogoDataUrl()
  const date = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date())

  pdf.setFillColor(31, 122, 101)
  pdf.rect(0, 0, pageWidth, 34, 'F')
  if (logo) pdf.addImage(logo, 'PNG', margin, 5, 24, 24)

  pdf.setTextColor(255, 255, 255)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(17)
  pdf.text('Modelo de lista de compras', margin + (logo ? 29 : 0), 16)
  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.text(companyName, margin + (logo ? 29 : 0), 23)
  pdf.text(environmentName === 'Todos' ? 'Todos os ambientes' : environmentName, margin + (logo ? 29 : 0), 28)

  pdf.setTextColor(23, 58, 53)
  pdf.setFontSize(9)
  pdf.text(`Gerado em ${date}`, margin, 43)
  pdf.text('Preencha os campos manualmente:', margin, 49)

  let y = 55
  const tableWidth = pageWidth - margin * 2
  const columns = [
    { label: 'Produto / insumo', x: margin + 3, width: 78 },
    { label: 'Ambiente', x: 95, width: 38 },
    { label: 'Qtd.', x: 135, width: 18 },
    { label: 'Observações', x: 155, width: 37 },
  ]

  pdf.setFillColor(231, 243, 239)
  pdf.roundedRect(margin, y, tableWidth, 10, 2, 2, 'F')
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(8)
  for (const column of columns) pdf.text(column.label, column.x, y + 6.5)

  y += 14
  pdf.setFont('helvetica', 'normal')
  for (let index = 0; index < 20; index += 1) {
    if (y > 270) {
      pdf.addPage()
      y = 18
    }
    pdf.setDrawColor(215, 226, 221)
    pdf.roundedRect(margin, y - 4, tableWidth, 9, 1, 1, 'S')
    pdf.line(93, y - 4, 93, y + 5)
    pdf.line(133, y - 4, 133, y + 5)
    pdf.line(153, y - 4, 153, y + 5)
    y += 10
  }

  pdf.setProperties({
    title: `Modelo de lista de compras - ${companyName}`,
    subject: 'Modelo em branco para impressão e preenchimento manual',
    author: 'Controle-App',
  })
  pdf.save(`modelo-lista-compras-${companyName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`)
}
