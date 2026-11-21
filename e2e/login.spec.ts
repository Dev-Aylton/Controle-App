import { test, expect } from '@playwright/test'

test('sessão autenticada não volta para o login', async ({ page }) => {
  let restRequestCount = 0
  page.on('request', (request) => {
    if (request.url().includes('/rest/v1/') || request.url().includes('/auth/v1/')) restRequestCount++
  })
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
  await page.route('**/rest/v1/memberships**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/rest/v1/companies**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.route('**/rest/v1/rpc/claim_invites**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '0' }))

  await page.goto('/#/login')
  await expect(page).not.toHaveURL(/#\/login/)
  await expect(page).toHaveURL(/#\/(entrar-codigo|empresa|)/)
  const restRequests = restRequestCount
  await page.waitForTimeout(3000)
  const restRequestsAfterWait = restRequestCount
  expect(restRequestsAfterWait).toBe(restRequests)
  await expect(page.locator('body')).not.toBeEmpty()
})
