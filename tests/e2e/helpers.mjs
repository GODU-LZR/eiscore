// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { expect } from '@playwright/test'

export const USERNAME = process.env.EISCORE_E2E_USERNAME || process.env.EISCORE_SMOKE_USERNAME || 'admin'
export const PASSWORD = process.env.EISCORE_E2E_PASSWORD || process.env.EISCORE_SMOKE_PASSWORD || '123456'
const E2E_BASE_URL = process.env.EISCORE_E2E_BASE_URL || process.env.EISCORE_BASE_URL || 'http://localhost:8080'
const IS_REMOTE_TARGET = !/^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(E2E_BASE_URL)
const LOGIN_ATTEMPTS = Number(process.env.EISCORE_E2E_LOGIN_ATTEMPTS || (IS_REMOTE_TARGET ? 5 : 3))
const GOTO_ATTEMPTS = Number(process.env.EISCORE_E2E_GOTO_ATTEMPTS || (IS_REMOTE_TARGET ? 3 : 2))

const ignoredConsoleErrorPatterns = [
  /ResizeObserver loop completed with undelivered notifications/i,
  /Failed to load resource:.*(?:favicon|cube\.elemecdn|faiusr\.com)/i,
  /net::ERR_ABORTED/i
]

export function parseJwtPayload(token) {
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

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function loginByApi(request) {
  let response = null
  let lastError = null
  for (let attempt = 1; attempt <= LOGIN_ATTEMPTS; attempt += 1) {
    try {
      response = await request.post('/api/rpc/login', {
        data: { username: USERNAME, password: PASSWORD }
      })
      if (response.ok()) break
      const text = await response.text().catch(() => '')
      lastError = new Error(`login failed with status ${response.status()}: ${text.slice(0, 200)}`)
      if (response.status() < 500) break
    } catch (error) {
      lastError = error
    }
    if (attempt < LOGIN_ATTEMPTS) await wait(500 * attempt)
  }

  if (!response || !response.ok()) {
    throw lastError || new Error('login failed without response')
  }

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

export async function seedAuth(page, auth) {
  await page.addInitScript(({ token, user }) => {
    window.__EIS_SKIP_MOBILE_REDIRECT__ = true
    window.localStorage.setItem('auth_token', token)
    window.localStorage.setItem('user_info', JSON.stringify(user))
    window.localStorage.setItem(`eis_guide_welcome_v1_${String(user.username || user.id || 'guest').toLowerCase()}`, '1')
  }, auth)
}

export async function gotoWithRetry(page, url, options = {}) {
  const attempts = Number(options.attempts || GOTO_ATTEMPTS)
  const waitUntil = options.waitUntil || 'domcontentloaded'
  const timeout = Number(options.timeout || 60_000)
  let lastError = null
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await page.goto(url, { ...options, waitUntil, timeout })
    } catch (error) {
      lastError = error
      if (index === attempts - 1) break
      await page.waitForTimeout(1_000 * (index + 1))
    }
  }
  throw lastError
}

export function createUiErrorMonitor(page) {
  const errors = []
  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`)
  })
  page.on('console', (message) => {
    if (message.type() !== 'error') return
    const text = message.text()
    if (ignoredConsoleErrorPatterns.some((pattern) => pattern.test(text))) return
    errors.push(`console.error: ${text}`)
  })
  return {
    errors,
    async expectClean(label = 'UI') {
      await page.waitForTimeout(150)
      await expect(page.locator('.el-message--error'), `${label} should not show Element Plus error messages`).toHaveCount(0)
      expect(errors, `${label} should not emit browser console/page errors`).toEqual([])
    }
  }
}

export async function expectNoBlankPage(page) {
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

export async function expectShellReady(page) {
  await expect(page).not.toHaveURL(/\/login(?:$|[?#/])/)
  await expect(page.locator('[data-guide="layout-aside"]')).toBeVisible()
  await expect(page.locator('[data-guide="layout-main"]')).toBeVisible()
  await expect(page.locator('[data-guide="user-menu"]')).toBeVisible()
  await expectNoBlankPage(page)
}

export async function expectSubAppReady(page) {
  await expectShellReady(page)
  await page.waitForFunction(() => {
    const viewport = document.querySelector('[data-guide="subapp-viewport"]')
    if (!viewport) return false
    const rect = viewport.getBoundingClientRect()
    const text = viewport.innerText.trim()
    return rect.width > 200 && rect.height > 80 && (viewport.children.length > 0 || text.length > 20)
  }, null, { timeout: 45_000 })
}

export async function expectGridReady(page) {
  await expectSubAppReady(page)
  await expect(page.locator('[data-guide="grid-wrapper"]').first()).toBeVisible({ timeout: 45_000 })
  await expect(page.locator('[data-guide="grid-body"]').first()).toBeVisible()
}

export async function firstVisible(page, selector, timeout = 3_000) {
  const locator = page.locator(selector).first()
  if (await locator.count() === 0) return null
  const visible = await locator.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false)
  return visible ? locator : null
}

export async function closeAnyFloatingLayer(page) {
  await page.keyboard.press('Escape').catch(() => {})
  const closeButton = await firstVisible(page, '.el-dialog__headerbtn, .el-drawer__close-btn, .driver-popover-close-btn', 700)
  if (closeButton) {
    await closeButton.click({ timeout: 1_000 }).catch(() => {})
  }
  await page.waitForTimeout(150).catch(() => {})
}
