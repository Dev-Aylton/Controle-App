import XLSX from 'xlsx-js-style'
import { writeFileSync } from 'node:fs'

const thin = { style: 'thin', color: { rgb: 'C8D8D2' } }
const border = { top: thin, bottom: thin, left: thin, right: thin }

function formatCsv(rows) {
  return `sep=;\r\n${rows
    .map((row) => row.map((value) => {
      const text = String(value ?? '')
      return /[;"\r\n]/u.test(text) ? `"${text.replace(/"/g, '""')}"` : text
    }).join(';'))
    .join('\r\n')}`
}

function encodeWindows1252(text) {
  const cp1252 = new Map([
    [0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84],
    [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02C6, 0x88],
    [0x2030, 0x89], [0x0160, 0x8A], [0x2039, 0x8B], [0x0152, 0x8C],
    [0x2018, 0x91], [0x2019, 0x92], [0x201C, 0x93], [0x201D, 0x94],
    [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97], [0x02DC, 0x98],
    [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B], [0x0153, 0x9C],
    [0x0178, 0x9F],
  ])
  const bytes = []
  for (const character of text) {
    const code = character.charCodeAt(0)
    if (code <= 0xFF) bytes.push(code)
    else if (cp1252.has(code)) bytes.push(cp1252.get(code))
    else bytes.push(0x3F)
  }
  return Buffer.from(bytes)
}

function styleWorksheet(worksheet, endColumn, headerRow, lastRow) {
  worksheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: endColumn } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: endColumn } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: endColumn } },
  ]
  for (let column = 0; column <= endColumn; column += 1) {
    const title = XLSX.utils.encode_cell({ r: headerRow, c: column })
    if (!worksheet[title]) worksheet[title] = { t: 's', v: '' }
    worksheet[title].s = {
      font: { bold: true, color: { rgb: '173A35' } },
      fill: { fgColor: { rgb: 'E7F3EF' } },
      border,
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
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
      if (!worksheet[cell]) worksheet[cell] = { t: 's', v: '' }
      worksheet[cell].s = {
        border,
        fill: { fgColor: { rgb: row % 2 === 0 ? 'F5F9F7' : 'FFFFFF' } },
        alignment: { vertical: 'top', wrapText: true },
      }
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
  ['Complete os campos em branco para identificar o produto, mantenha os dados preenchidos e informe Quantidade contada. Observações é opcional.', '', '', '', '', '', '', '', ''],
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

const productCsv = formatCsv([
  ['Controle-App', 'Modelo oficial de produtos'],
  ['Versão', '1.0'],
  ['Tipo', 'Produtos'],
  ['Preencha uma linha por produto ou variante.', ''],
  [],
  productColumns,
  ...Array.from({ length: 30 }, () => Array(productColumns.length).fill('')),
])
writeFileSync('public/modelo-produtos.csv', encodeWindows1252(productCsv))

const countCsv = formatCsv([
  ['Controle-App', 'Modelo oficial de contagem'],
  ['Versão', '1.0'],
  ['Tipo', 'Contagem'],
  ['Complete os campos em branco para identificar o produto, mantenha os dados preenchidos e informe Quantidade contada. Observações é opcional.', ''],
  [],
  countColumns,
  ...Array.from({ length: 100 }, () => Array(countColumns.length).fill('')),
])
writeFileSync('public/modelo-contagem.csv', encodeWindows1252(countCsv))
