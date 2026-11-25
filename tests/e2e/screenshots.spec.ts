import { expect, test } from '@playwright/test'
import { isBackendRequest } from './networkGuard'
import { mkdirSync } from 'node:fs'

const notebookWidth = 1440
const mobileWidth = 390

const managementSections = [
  ['demo-home', 'inicio'],
  ['demo-company', 'empresa'],
  ['demo-environments', 'ambientes'],
  ['demo-products', 'produtos'],
  ['demo-movements', 'movimentacoes'],
  ['demo-sales', 'vendas'],
  ['demo-sales-prices', 'precos-venda'],
  ['demo-stock', 'saldo-ambientes'],
  ['demo-inventory', 'inventario'],
  ['demo-alerts', 'alertas'],
  ['demo-purchases', 'lista-compras'],
  ['demo-reports', 'relatorios'],
  ['demo-audit', 'auditoria'],
  ['demo-team', 'equipe'],
  ['demo-profile', 'perfil'],
  ['demo-support', 'suporte'],
  ['demo-offline', 'offline'],
  ['demo-privacy', 'privacidade'],
] as const

const employeeSections = [
  ['demo-home', 'inicio'],
  ['demo-movements', 'movimentacoes'],
  ['demo-stock', 'saldo-ambientes'],
  ['demo-inventory', 'inventario'],
  ['demo-purchases', 'lista-compras'],
  ['demo-profile', 'perfil'],
  ['demo-support', 'suporte'],
  ['demo-offline', 'offline'],
  ['demo-privacy', 'privacidade'],
] as const

function ensureScreenshotDirectories() {
  for (const role of ['gerente', 'proprietario', 'funcionario']) {
    for (const width of ['notebook', 'celular']) {
      for (const theme of ['claro', 'escuro']) {
        mkdirSync(`docs/screenshots/${role}/${width}-${theme}`, { recursive: true })
      }
    }
  }
}

test.setTimeout(180_000)

test('gera capturas fictícias do modo demonstração sem chamadas ao Supabase', async ({ page }) => {
  ensureScreenshotDirectories()
  let backendRequestObserved = false
  await page.route('**/*', (route) => {
    if (isBackendRequest(route.request().url())) return route.abort()
    return route.continue()
  })
  page.on('request', (request) => {
    if (isBackendRequest(request.url())) backendRequestObserved = true
  })

  await page.goto('#/demo')
  await expect(page.getByText('Modo demonstração: dados fictícios, nada é salvo no servidor')).toBeVisible()

  for (const [roleValue, folder] of [
    ['manager', 'gerente'],
    ['owner', 'proprietario'],
  ] as const) {
    for (const theme of ['light', 'dark'] as const) {
      await page.setViewportSize({ width: notebookWidth, height: 900 })
      await page.goto('#/demo')
      await page.getByLabel('Entrar como').selectOption(roleValue)
      await page.getByRole('button', { name: 'Minha conta' }).first().click()
      await page.getByLabel('Tema do modo demonstração').selectOption(theme)
      await page.getByRole('button', { name: 'Fechar' }).click()
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)

      for (const [sectionId, name] of managementSections) {
        await page.locator(`#${sectionId}`).scrollIntoViewIfNeeded()
        await page.locator(`#${sectionId}`).screenshot({
          path: `docs/screenshots/${folder}/notebook-${theme === 'light' ? 'claro' : 'escuro'}/${name}.png`,
        })
      }

      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({
        path: `docs/screenshots/${folder}/notebook-${theme === 'light' ? 'claro' : 'escuro'}/pagina-completa.png`,
        fullPage: true,
      })

      await page.setViewportSize({ width: mobileWidth, height: 844 })
      await page.getByLabel('Entrar como').selectOption(roleValue)
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.screenshot({
        path: `docs/screenshots/${folder}/celular-${theme === 'light' ? 'claro' : 'escuro'}/pagina-completa.png`,
        fullPage: true,
      })
      for (const [sectionId, name] of managementSections) {
        await page.locator(`#${sectionId}`).scrollIntoViewIfNeeded()
        await page.locator(`#${sectionId}`).screenshot({
          path: `docs/screenshots/${folder}/celular-${theme === 'light' ? 'claro' : 'escuro'}/${name}.png`,
        })
      }
    }
  }

  for (const theme of ['light', 'dark'] as const) {
    await page.setViewportSize({ width: notebookWidth, height: 900 })
    await page.goto('#/demo')
    await page.getByLabel('Entrar como').selectOption('employee')
    await page.getByRole('button', { name: 'Minha conta' }).first().click()
    await page.getByLabel('Tema do modo demonstração').selectOption(theme)
    await page.getByRole('button', { name: 'Fechar' }).click()
    for (const [sectionId, name] of employeeSections) {
      await page.locator(`#${sectionId}`).scrollIntoViewIfNeeded()
      await page.locator(`#${sectionId}`).screenshot({
        path: `docs/screenshots/funcionario/notebook-${theme === 'light' ? 'claro' : 'escuro'}/${name}.png`,
      })
    }
    await page.screenshot({
      path: `docs/screenshots/funcionario/notebook-${theme === 'light' ? 'claro' : 'escuro'}/pagina-completa.png`,
      fullPage: true,
    })

    await page.setViewportSize({ width: mobileWidth, height: 844 })
    await page.goto('#/demo')
    await page.getByLabel('Entrar como').selectOption('employee')
    await page.screenshot({
      path: `docs/screenshots/funcionario/celular-${theme === 'light' ? 'claro' : 'escuro'}/pagina-completa.png`,
      fullPage: true,
    })
    for (const [sectionId, name] of employeeSections) {
      await page.locator(`#${sectionId}`).scrollIntoViewIfNeeded()
      await page.locator(`#${sectionId}`).screenshot({
        path: `docs/screenshots/funcionario/celular-${theme === 'light' ? 'claro' : 'escuro'}/${name}.png`,
      })
    }
  }

  expect(backendRequestObserved).toBe(false)
})
