import { test, expect } from '@playwright/test'

const userId = '00000000-0000-0000-0000-000000000004'
const companyId = '10000000-0000-0000-0000-000000000001'
const otherId = '10000000-0000-0000-0000-000000000002'
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/aN8AAAAASUVORK5CYII=', 'base64')

test('salva e exibe a logo e o nome da empresa no celular', async ({ page }) => {
  const companies = [
    { id: companyId, name: 'Empresa Teste', phone: null, photo: null as string | null, created_at: '2026-01-01' },
    { id: otherId, name: 'Outra Empresa', phone: null, photo: null as string | null, created_at: '2026-01-01' },
  ]
  const uploads: string[] = []
  await page.setViewportSize({ width: 390, height: 844 })
  await page.addInitScript(({ userId, companyId }) => {
    if (sessionStorage.getItem('company-test-initialized')) return
    sessionStorage.setItem('company-test-initialized', '1')
    localStorage.setItem('controle-app-company', companyId)
    localStorage.setItem('sb-example-auth-token', JSON.stringify({
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user: { id: userId, aud: 'authenticated', role: 'authenticated', email: 'teste@example.com', app_metadata: {}, user_metadata: {} },
    }))
  }, { userId, companyId })
  await page.route('https://example.supabase.co/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body })
    if (url.pathname === '/rest/v1/app_admins') return json([])
    if (url.pathname === '/rest/v1/memberships') {
      return json(companies.map((company) => ({
        id: company.id, user_id: userId, company_id: company.id, role: 'manager', active: true, code_id: null,
      })))
    }
    if (url.pathname === '/rest/v1/companies') {
      if (request.method() === 'PATCH') {
        Object.assign(companies[0], request.postDataJSON())
        return json({ id: companyId })
      }
      return json(companies)
    }
    if (url.pathname.startsWith('/storage/v1/object/sign/company-photos/') && request.method() === 'POST') {
      return json({ signedURL: `/object/sign/company-photos/${url.pathname.split('/').pop()}?token=test` })
    }
    if (url.pathname.startsWith('/storage/v1/object/sign/company-photos/')) {
      return route.fulfill({ status: 200, contentType: 'image/png', body: png })
    }
    if (url.pathname.startsWith('/storage/v1/object/company-photos/')) {
      uploads.push(url.pathname)
      return json({ Key: url.pathname })
    }
    if (url.pathname.startsWith('/rest/v1/rpc/')) return json([])
    if (url.pathname.startsWith('/rest/v1/')) return json([])
    return json({})
  })

  await page.goto('#/')
  await expect(page.getByRole('heading', { name: 'Empresa Teste' })).toBeVisible()
  await expect(page.locator('.company-home-header img')).toHaveAttribute('src', /company-placeholder\.svg/)
  await page.goto('#/empresa')
  await page.getByLabel('Nome', { exact: true }).fill('Empresa Atualizada')

  for (let index = 0; index < 2; index += 1) {
    await page.getByRole('button', { name: 'Trocar logo' }).click()
    await page.locator('input[type=file]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png })
    await page.getByRole('dialog', { name: 'Trocar logo' }).getByRole('button', { name: 'Confirmar' }).click()
    await page.getByRole('button', { name: 'Salvar empresa' }).click()
    await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click()
    await expect(page.getByText('Empresa atualizada.')).toBeVisible()
    await expect(page.locator('img[alt="Logo de Empresa Atualizada"]')).toHaveAttribute('src', /storage\/v1\/object\/sign/)
    if (index === 0) await expect(page.getByRole('button', { name: 'Salvar empresa' })).toBeEnabled()
  }
  expect(uploads).toHaveLength(2)
  expect(uploads[0]).not.toBe(uploads[1])

  const savedPhoto = companies[0].photo
  await page.route('https://example.supabase.co/storage/v1/object/company-photos/**', (route) =>
    route.fulfill({ status: 500, json: { message: 'Falha no upload' } }))
  await expect(page.getByRole('button', { name: 'Salvar empresa' })).toBeVisible()
  await page.getByRole('button', { name: 'Trocar logo' }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: png })
  await page.getByRole('dialog', { name: 'Trocar logo' }).getByRole('button', { name: 'Confirmar' }).click()
  await page.getByRole('button', { name: 'Salvar empresa' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar' }).click()
  await expect(page.locator('.form-error')).toBeVisible()
  expect(companies[0].photo).toBe(savedPhoto)

  await page.goto('#/')
  await expect(page.getByRole('heading', { name: 'Empresa Atualizada' })).toBeVisible()
  await expect(page.locator('.company-home-header img')).toHaveAttribute('src', /storage\/v1\/object\/sign/)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Empresa Atualizada' })).toBeVisible()
  await expect(page.locator('.company-home-header img')).toHaveAttribute('src', /storage\/v1\/object\/sign/)
  await page.getByLabel('Seletor de empresa').selectOption(otherId)
  await expect(page.getByRole('heading', { name: 'Outra Empresa' })).toBeVisible()
  await expect(page.locator('.company-home-header img')).toHaveAttribute('src', /company-placeholder\.svg/)
  await page.getByLabel('Seletor de empresa').selectOption('')
  await expect(page.getByRole('heading', { name: 'Selecione uma empresa' })).toBeVisible()
  await expect(page.locator('.company-home-header img')).toHaveAttribute('src', /company-placeholder\.svg/)
})
