// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { expect, test } from '@playwright/test'

const USERNAME = process.env.EISCORE_E2E_USERNAME || process.env.EISCORE_SMOKE_USERNAME || 'admin'
const PASSWORD = process.env.EISCORE_E2E_PASSWORD || process.env.EISCORE_SMOKE_PASSWORD || '123456'

const authenticatedRoutes = [
  { name: 'materials module', path: '/materials/apps' },
  { name: 'hr employee module', path: '/hr/employee' },
  { name: 'app center module', path: '/apps/' }
]

function parseJwtPayload(token) {
  try {
    const parts = String(token || '').split('.')
    if (parts.length !== 3) return {}
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf8'))
  } catch {
    return {}
  }
}

async function loginByApi(request) {
  const response = await request.post('/api/rpc/login', {
    data: { username: USERNAME, password: PASSWORD }
  })
  expect(response.ok(), `login failed with status ${response.status()}`).toBeTruthy()

  const data = await response.json()
  const token = String(data.token || '')
  expect(token.length, 'login response should include a JWT token').toBeGreaterThan(100)

  const payload = parseJwtPayload(token)
  const username = String(data.username || payload.username || USERNAME)
  const role = String(data.app_role || payload.app_role || payload.role || data.role || 'user')
  return {
    token,
    user: {
      id: username,
      name: username,
      username,
      role,
      role_id: '',
      dbRole: String(payload.role || data.role || 'web_user'),
      permissions: Array.isArray(data.permissions) ? data.permissions : [],
      avatar: '',
      sop_role: String(payload.sop_role || payload.sopRole || ''),
      sopRole: String(payload.sop_role || payload.sopRole || '')
    }
  }
}

async function seedAuth(page, auth) {
  await page.addInitScript(({ token, user }) => {
    window.__EIS_SKIP_MOBILE_REDIRECT__ = true
    window.localStorage.setItem('auth_token', token)
    window.localStorage.setItem('user_info', JSON.stringify(user))
  }, auth)
}

async function expectNoBlankPage(page) {
  await expect(page.locator('body > #app')).toBeVisible()
  const metrics = await page.evaluate(() => {
    const visibleNodes = Array.from(document.body.querySelectorAll('*')).filter((node) => {
      const rect = node.getBoundingClientRect()
      const style = window.getComputedStyle(node)
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    })
    return {
      appHtmlLength: document.querySelector('#app')?.innerHTML?.trim().length || 0,
      bodyTextLength: document.body.innerText.trim().length,
      visibleNodeCount: visibleNodes.length
    }
  })

  expect(metrics.appHtmlLength, 'Vue app should render HTML').toBeGreaterThan(100)
  expect(metrics.bodyTextLength, 'page should have visible text').toBeGreaterThan(20)
  expect(metrics.visibleNodeCount, 'page should have visible DOM nodes').toBeGreaterThan(5)
}

async function expectShellReady(page) {
  await expect(page).not.toHaveURL(/\/login(?:$|[?#/])/)
  await expect(page.locator('[data-guide="layout-aside"]')).toBeVisible()
  await expect(page.locator('[data-guide="layout-main"]')).toBeVisible()
  await expect(page.locator('[data-guide="user-menu"]')).toBeVisible()
  await expectNoBlankPage(page)
}

async function expectSubAppReady(page) {
  await expectShellReady(page)
  await page.waitForFunction(() => {
    const viewport = document.querySelector('[data-guide="subapp-viewport"]')
    if (!viewport) return false
    const rect = viewport.getBoundingClientRect()
    const text = viewport.innerText.trim()
    return rect.width > 200 && rect.height > 80 && (viewport.children.length > 0 || text.length > 20)
  }, null, { timeout: 45_000 })
}

test('public login page renders employee entry', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })

  await expect(page.locator('.auth-panel')).toBeVisible()
  await expect(page.getByPlaceholder('用户名')).toBeVisible()
  await expect(page.getByPlaceholder('密码')).toBeVisible()
  await expect(page.locator('.login-btn')).toBeVisible()
  await expectNoBlankPage(page)
})

test.describe('authenticated shell', () => {
  test.beforeEach(async ({ page, request }) => {
    await seedAuth(page, await loginByApi(request))
  })

  test('home shell renders after API login', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expectShellReady(page)
    await expect(page.locator('[data-guide="menu-home"]')).toBeVisible()
  })

  for (const route of authenticatedRoutes) {
    test(`${route.name} deep link renders through host shell`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      await expectSubAppReady(page)
    })
  }
})
