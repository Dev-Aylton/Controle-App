import { test, expect } from '@playwright/test'

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'notebook', width: 1366, height: 768 },
] as const

for (const viewport of viewports) {
  test(`layout ${viewport.name}`, async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sb-example-auth-token', JSON.stringify({
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token',
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: {
          id: '00000000-0000-0000-0000-000000000004',
          aud: 'authenticated',
          role: 'authenticated',
          email: 'teste@example.com',
          app_metadata: {},
          user_metadata: {},
        },
      }))
    })
    await page.route('**/rest/v1/app_admins**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
    await page.route('**/rest/v1/memberships**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: '20000000-0000-0000-0000-000000000001',
        user_id: '00000000-0000-0000-0000-000000000004',
        company_id: '10000000-0000-0000-0000-000000000001',
        role: 'manager',
        active: true,
        code_id: null,
        deactivated_at: null,
        deactivated_by: null,
        created_at: '2026-11-21T00:00:00Z',
      }]),
    }))
    await page.route('**/rest/v1/companies**', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([{
        id: '10000000-0000-0000-0000-000000000001',
        name: 'Empresa Teste',
        phone: null,
        photo: null,
        created_at: '2026-11-21T00:00:00Z',
      }]),
    }))
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/')
    await expect(page.getByText(`Layout detectado: ${viewport.name}`)).toBeVisible()

    if (viewport.name === 'mobile') {
      await expect(page.locator('.bottom-nav')).toBeVisible()
      await expect(page.locator('.sidebar')).toHaveCount(0)
    } else if (viewport.name === 'tablet') {
      await expect(page.locator('.sidebar')).toBeVisible()
      await expect(page.locator('.nav-label').first()).toBeHidden()
    } else {
      await expect(page.locator('.sidebar')).toBeVisible()
      await expect(page.locator('.bottom-nav')).toHaveCount(0)
      await expect(page.locator('.nav-label').first()).toBeVisible()
    }

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
}
