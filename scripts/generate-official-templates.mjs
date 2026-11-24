import * as XLSX from 'xlsx'
import { writeFileSync } from 'node:fs'

const thin = { style: 'thin', color: { rgb: 'C8D8D2' } }
const border = { top: thin, bottom: thin, left: thin, right: thin }

function styleWorksheet(worksheet, endColumn, headerRow, lastRow) {
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: endColumn } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: endColumn } },
  ]
  for (let column = 0; column <= endColumn; column += 1) {
    const title = XLSX.utils.encode_cell({ r: headerRow, c: column })
    if (worksheet[title]) {
      worksheet[title].s = {
        font: { bold: true, color: { rgb: '173A35' } },
        fill: { fgColor: { rgb: 'E7F3EF' } },
        border,
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      }
    }
  }
  worksheet['A1'].s = {
    font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1F7A65' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  worksheet['A2'].s = {
    font: { bold: true, sz: 12, color: { rgb: '173A35' } },
    alignment: { horizontal: 'center', vertical: 'center' },
  }
  for (let row = headerRow + 1; row <= lastRow; row += 1) {
    for (let column = 0; column <= endColumn; column += 1) {
      const cell = XLSX.utils.encode_cell({ r: row, c: column })
      if (!worksheet[cell]) continue
      worksheet[cell].s = { border, alignment: { vertical: 'top', wrapText: true } }
    }
  }
  worksheet['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: headerRow, c: 0 }, e: { r: lastRow, c: endColumn } }) }
  worksheet['!freeze'] = { xSplit: 0, ySplit: headerRow + 1, topLeftCell: XLSX.utils.encode_cell({ r: headerRow + 1, c: 0 }), state: 'frozen' }
  worksheet['!rows'] = [{ hpt: 30 }, { hpt: 24 }, { hpt: 22 }, { hpt: 22 }, { hpt: 8 }, { hpt: 34 }, ...Array(Math.max(0, lastRow - headerRow)).fill({ hpt: 24 })]
}

const productColumns = [
  'nome',
  'codigo',
  'tipo_categoria',
  'unidade',
  'volume_ml',
  'peso',
  'dose_ml',
  'estoque_minimo',
  'estoque_maximo',
  'custo',
]
const productRows = [
  ['Controle-App', '', '', '', '', '', '', '', '', ''],
  ['Modelo oficial de produtos', '', '', '', '', '', '', '', '', ''],
  ['Versão', '1.0', 'Tipo', 'Produtos', '', '', '', '', '', ''],
  ['Preencha uma linha por produto ou variante.', '', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', '', ''],
  productColumns,
  ...Array.from({ length: 30 }, () => Array(productColumns.length).fill('')),
]
const productWorkbook = XLSX.utils.book_new()
const productSheet = XLSX.utils.aoa_to_sheet(productRows)
productSheet['!cols'] = [
  { wch: 28 }, { wch: 14 }, { wch: 20 }, { wch: 14 }, { wch: 14 },
  { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 12 },
]
styleWorksheet(productSheet, productColumns.length - 1, 5, productRows.length - 1)
XLSX.utils.book_append_sheet(productWorkbook, productSheet, 'Produtos')
XLSX.writeFile(productWorkbook, 'public/modelo-produtos.xlsx')

const countColumns = [
  'Código',
  'Tipo/Categoria',
  'Produto',
  'Unidade',
  'Volume/Peso',
  'Dose (ml)',
  'Ambiente',
  'Quantidade contada',
  'Observações',
]
const countRows = [
  ['Controle-App', '', '', '', '', '', '', '', ''],
  ['Modelo oficial de contagem', '', '', '', '', '', '', '', ''],
  ['Versão', '1.0', 'Tipo', 'Contagem', '', '', '', '', ''],
  ['Preencha somente a coluna Quantidade contada.', '', '', '', '', '', '', '', ''],
  ['', '', '', '', '', '', '', '', ''],
  countColumns,
  ...Array.from({ length: 100 }, () => Array(countColumns.length).fill('')),
]
const countWorkbook = XLSX.utils.book_new()
const countSheet = XLSX.utils.aoa_to_sheet(countRows)
countSheet['!cols'] = [
  { wch: 14 }, { wch: 20 }, { wch: 38 }, { wch: 14 }, { wch: 16 },
  { wch: 12 }, { wch: 24 }, { wch: 20 }, { wch: 32 },
]
styleWorksheet(countSheet, countColumns.length - 1, 5, countRows.length - 1)
XLSX.utils.book_append_sheet(countWorkbook, countSheet, 'Contagem')
XLSX.writeFile(countWorkbook, 'public/modelo-contagem.xlsx')

const productCsv = [
  ['Controle-App', 'Modelo oficial de produtos'],
  ['Versão', '1.0'],
  ['Tipo', 'Produtos'],
  ['Preencha uma linha por produto ou variante.', ''],
  [],
  productColumns,
  ...Array.from({ length: 30 }, () => Array(productColumns.length).fill('')),
].map((row) => row.join(';')).join('\r\n')
writeFileSync('public/modelo-produtos.csv', `\uFEFF${productCsv}`, 'utf8')

const countCsv = [
  ['Controle-App', 'Modelo oficial de contagem'],
  ['Versão', '1.0'],
  ['Tipo', 'Contagem'],
  ['Preencha somente a coluna Quantidade contada.', ''],
  [],
  countColumns,
  ...Array.from({ length: 100 }, () => Array(countColumns.length).fill('')),
].map((row) => row.join(';')).join('\r\n')
writeFileSync('public/modelo-contagem.csv', `\uFEFF${countCsv}`, 'utf8')
