import { chromium } from 'playwright'
import { readFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const finalDir = path.resolve(projectRoot, '..', 'Final')

const guides = [
  ['funcionario.md', 'Guia_Operacional_Funcionario.pdf', 'Guia Operacional — Funcionário'],
  ['gerente.md', 'Guia_Operacional_Gerente.pdf', 'Guia Operacional — Gerente'],
  ['proprietario.md', 'Guia_Operacional_Proprietario.pdf', 'Guia Operacional — Proprietário'],
  ['engenharia.md', 'Guia_Tecnico_Engenharia.pdf', 'Guia Técnico de Engenharia'],
]

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function inline(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
}

function markdownToHtml(markdown) {
  const lines = markdown.split(/\r?\n/)
  let html = ''
  let list = ''
  let code = false

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (code) {
        html += '</code></pre>'
        code = false
      } else {
        if (list) {
          html += `<ul>${list}</ul>`
          list = ''
        }
        html += '<pre><code>'
        code = true
      }
      continue
    }
    if (code) {
      html += `${escapeHtml(line)}\n`
      continue
    }
    if (/^[-*] /.test(line)) {
      list += `<li>${inline(line.replace(/^[-*] /, ''))}</li>`
      continue
    }
    if (list) {
      html += `<ul>${list}</ul>`
      list = ''
    }
    if (/^\d+\. /.test(line)) {
      html += `<p class="step">${inline(line.replace(/^\d+\. /, ''))}</p>`
      continue
    }
    if (line.startsWith('# ')) {
      html += `<h1>${inline(line.slice(2))}</h1>`
      continue
    }
    if (line.startsWith('## ')) {
      html += `<h2>${inline(line.slice(3))}</h2>`
      continue
    }
    if (line.trim()) html += `<p>${inline(line)}</p>`
  }
  if (list) html += `<ul>${list}</ul>`
  return html
}

await mkdir(finalDir, { recursive: true })

const browser = await chromium.launch({ headless: true })
try {
  for (const [sourceName, pdfName, title] of guides) {
    const sourcePath = path.join(projectRoot, 'docs', 'guias', sourceName)
    const markdown = await readFile(sourcePath, 'utf8')
    const page = await browser.newPage()
    await page.setContent(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    @page { size: A4; margin: 18mm 16mm 18mm 16mm; }
    body { color: #1f2933; font-family: Arial, sans-serif; font-size: 10.5pt; line-height: 1.45; }
    h1 { color: #12355b; font-size: 22pt; margin: 0 0 8mm; border-bottom: 2px solid #e6a800; padding-bottom: 4mm; }
    h2 { color: #12355b; font-size: 14pt; margin: 7mm 0 3mm; break-after: avoid; }
    p { margin: 0 0 3mm; }
    ul { margin: 0 0 4mm; padding-left: 6mm; }
    li { margin: 1.2mm 0; }
    code { color: #7a3e00; background: #f4f1ea; padding: 0.5mm 1mm; }
    pre { background: #f4f1ea; border-left: 3px solid #e6a800; padding: 4mm; white-space: pre-wrap; break-inside: avoid; }
    .step { border-left: 2px solid #c9d4e0; padding-left: 3mm; }
  </style>
</head>
<body>${markdownToHtml(markdown)}</body>
</html>`, { waitUntil: 'load' })
    await page.pdf({
      path: path.join(finalDir, pdfName),
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', right: '16mm', bottom: '18mm', left: '16mm' },
    })
    await page.close()
  }
} finally {
  await browser.close()
}
