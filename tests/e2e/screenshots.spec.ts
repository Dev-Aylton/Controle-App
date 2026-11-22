import { expect, test } from '@playwright/test'
import { isBackendRequest } from './networkGuard'

test('gera capturas fictícias do modo demonstração sem chamadas ao Supabase', async ({ page }) => {
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
  await page.getByLabel('Entrar como').selectOption('manager')
  await page.locator('#demo-home').screenshot({ path: 'docs/screenshots/inicio.png' })
  await page.locator('#demo-products').screenshot({ path: 'docs/screenshots/produtos.png' })
  await page.locator('#demo-movements').screenshot({ path: 'docs/screenshots/movimentacoes.png' })
  await page.locator('#demo-alerts').screenshot({ path: 'docs/screenshots/alertas.png' })

  await page.getByRole('button', { name: 'Minha conta' }).first().click()
  const accountPanel = page.getByRole('dialog', { name: 'Minha conta — demonstração' })
  await expect(accountPanel).toBeVisible()
  await accountPanel.screenshot({ path: 'docs/screenshots/minha-conta.png' })
  await page.getByLabel('Tema do modo demonstração').selectOption('dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.getByRole('button', { name: 'Fechar' }).click()
  await page.locator('#demo-home').screenshot({ path: 'docs/screenshots/tema-escuro.png' })

  await page.getByRole('button', { name: 'Minha conta' }).first().click()
  await page.getByLabel('Tema do modo demonstração').selectOption('light')
  await page.getByRole('button', { name: 'Fechar' }).click()
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('#/demo')
  await expect(page.getByRole('navigation', { name: 'Navegação da demonstração' })).toBeVisible()
  await page.screenshot({ path: 'docs/screenshots/celular-iphone-14.png' })
  expect(backendRequestObserved).toBe(false)
})
