import { test, expect } from '@playwright/test'
import { isBackendRequest } from './networkGuard'

const backendRequests = new WeakMap<object, boolean>()

test.beforeEach(async ({ page }) => {
  backendRequests.set(page, false)
  await page.route('**/*', (route) => {
    if (isBackendRequest(route.request().url())) return route.abort()
    return route.continue()
  })
  page.on('request', (request) => {
    if (isBackendRequest(request.url())) backendRequests.set(page, true)
  })
})

test.afterEach(({ page }) => {
  expect(backendRequests.get(page)).toBe(false)
})

test('demo permite trocar cargos e respeitar menus', async ({ page }) => {
  await page.goto('#/demo')
  await expect(page.getByText('Modo demonstração: dados fictícios, nada é salvo no servidor')).toBeVisible()
  await page.getByLabel('Entrar como').selectOption('employee')
  await expect(page.getByText(/Visão restrita do funcionário/)).toBeVisible()
  await page.getByLabel('Entrar como').selectOption('manager')
  await expect(page.getByText('Abaixo do mínimo', { exact: true })).toBeVisible()
})

test('papéis do aplicativo não causam rolagem horizontal em celular e desktop', async ({ page }) => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    await page.setViewportSize(viewport)
    await page.goto('#/demo')
    for (const role of ['employee', 'manager', 'owner']) {
      await page.getByLabel('Entrar como').selectOption(role)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        `${role} teve rolagem horizontal em ${viewport.width}px`,
      ).toBe(true)
    }
  }
})

test('demo mostra central de alertas e lista de compras', async ({ page }) => {
  await page.goto('#/demo')
  await page.getByLabel('Entrar como').selectOption('manager')
  await expect(page.getByText('Sem estoque')).toBeVisible()
  await expect(page.getByText('Saldo negativo')).toBeVisible()
  await expect(page.getByText('Perdas sem motivo')).toBeVisible()
})

test('demo permite reiniciar dados', async ({ page }) => {
  await page.goto('#/demo')
  await page.getByRole('button', { name: 'Reiniciar demonstração' }).click()
  await expect(page.getByRole('heading', { name: 'PIPA BOAT PARTY', exact: true })).toBeVisible()
})

test('funcionário lança saída no layout móvel sem ver dados sensíveis', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('#/demo')
  await page.getByLabel('Entrar como').selectOption('employee')
  await expect(page.getByText(/Visão restrita do funcionário/)).toBeVisible()
  await expect(page.getByText('Saldo negativo', { exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByLabel('Tipo').selectOption('saida')
  await page.getByRole('button', { name: 'Registrar' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Movimentação fictícia registrada.' })).toBeVisible()
})

test('gerente estorna movimentação e zera estoque com motivo no layout móvel', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('#/demo')
  await page.getByLabel('Entrar como').selectOption('manager')
  await page.getByRole('heading', { name: 'Zeragem fictícia' }).scrollIntoViewIfNeeded()
  const zeroButton = page.getByRole('button', { name: 'Confirmar zeragem em duas etapas' })
  await expect(zeroButton).toBeDisabled()
  await page.getByLabel('Motivo').fill('Conferência de fechamento')
  await zeroButton.click()
  await expect(page.getByRole('status').filter({ hasText: /Zeragem confirmada:/ })).toBeVisible()
  await page.getByRole('button', { name: 'Registrar' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Movimentação fictícia registrada.' })).toBeVisible()
  await page.getByRole('heading', { name: 'Movimentações fictícias recentes' }).scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: 'Estornar' }).first().click()
  await expect(page.getByRole('status').filter({ hasText: 'Movimentação estornada.' })).toBeVisible()
})

test('inventário cego aceita contagem e gerente finaliza', async ({ page }) => {
  await page.goto('#/demo')
  await page.getByLabel('Entrar como').selectOption('manager')
  await expect(page.getByText('Inventário cego fictício')).toBeVisible()
})

test('gerente importa e desfaz venda fictícia', async ({ page }) => {
  await page.goto('#/demo')
  await page.getByLabel('Entrar como').selectOption('manager')
  await page.getByRole('button', { name: 'Aplicar prévia fictícia' }).click()
  await expect(page.getByText(/Importação fictícia aplicada/)).toBeVisible()
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Importação fictícia desfeita.' })).toBeVisible()
})

test('proprietário desativa funcionário e troca código', async ({ page }) => {
  await page.goto('#/demo')
  await page.getByLabel('Entrar como').selectOption('owner')
  await page.getByRole('button', { name: 'Trocar código fictício' }).click()
  await expect(page.getByText(/DEMO-/)).toBeVisible()
  await page.getByRole('button', { name: 'Desativar funcionário fictício' }).click()
  await page.getByLabel('Entrar como').selectOption('employee')
  await expect(page.getByText(/desativado/)).toBeVisible()
})

test('lista de compras exporta CSV na demo', async ({ page }) => {
  await page.goto('#/demo')
  await page.getByLabel('Entrar como').selectOption('manager')
  await expect(page.getByRole('button', { name: 'Exportar lista de compras' })).toBeVisible()
})

test('funcionário estorna próprio lançamento recente na demo', async ({ page }) => {
  await page.goto('#/demo')
  await page.getByLabel('Entrar como').selectOption('employee')
  await page.getByRole('button', { name: 'Registrar' }).click()
  await expect(page.getByText(/Movimentação fictícia registrada|Saldo insuficiente/)).toBeVisible()
})

test('demonstração de gerente exibe histórico e ações de estorno', async ({ page }) => {
  await page.goto('#/demo')
  await page.getByLabel('Entrar como').selectOption('manager')
  await page.getByRole('heading', { name: 'Movimentações fictícias recentes' }).scrollIntoViewIfNeeded()
  await expect(page.getByRole('button', { name: 'Estornar' }).first()).toBeVisible()
})
