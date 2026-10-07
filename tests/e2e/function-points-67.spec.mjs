// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { expect, test } from '@playwright/test'
import {
  createUiErrorMonitor,
  expectNoBlankPage,
  expectShellReady,
  gotoWithRetry,
  loginByApi,
  seedAuth
} from './helpers.mjs'
import { functionPoints67 } from './function-points-67.mjs'

test.setTimeout(90_000)
test.use({ video: 'off' })

const selectedPointIds = new Set(
  String(process.env.EISCORE_E2E_FUNCTION_POINTS_ONLY || '')
    .split(',')
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
)
const selectedPointStart = parsePointNumber(process.env.EISCORE_E2E_FUNCTION_POINTS_START, 1)
const selectedPointEnd = parsePointNumber(process.env.EISCORE_E2E_FUNCTION_POINTS_END, 67)
const functionPointSurfaceTimeoutMs = Number(process.env.EISCORE_E2E_FUNCTION_POINT_SURFACE_TIMEOUT_MS || 30_000)
const functionPointContentTimeoutMs = Number(process.env.EISCORE_E2E_FUNCTION_POINT_CONTENT_TIMEOUT_MS || 20_000)

const ignoredHttpErrorPatterns = [
  /favicon/i,
  /cube\.elemecdn\.com/i,
  /faiusr\.com/i,
  /sockjs-node/i
]

function parsePointNumber(value, fallback) {
  const parsed = Number.parseInt(String(value || ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(1, Math.min(parsed, 67))
}

function pointNumber(point) {
  const parsed = Number.parseInt(String(point.id || '').replace(/^FP/i, ''), 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function shouldRunPoint(point) {
  if (selectedPointIds.size > 0) return selectedPointIds.has(String(point.id || '').toUpperCase())
  const number = pointNumber(point)
  return number >= selectedPointStart && number <= selectedPointEnd
}

const selectedFunctionPoints67 = functionPoints67.filter(shouldRunPoint)
if (selectedFunctionPoints67.length === 0) {
  throw new Error('No 67 function points selected; check EISCORE_E2E_FUNCTION_POINTS_ONLY/START/END')
}

function createHttpErrorMonitor(page) {
  const errors = []
  page.on('response', (response) => {
    const status = response.status()
    if (status < 400) return
    const url = response.url()
    if (ignoredHttpErrorPatterns.some((pattern) => pattern.test(url))) return
    errors.push(`${response.request().method()} ${status} ${url}`)
  })
  return {
    errors,
    expectClean(label) {
      expect(errors, `${label} should not emit HTTP 4xx/5xx responses`).toEqual([])
    }
  }
}

async function expectAnyText(page, texts, label) {
  const body = page.locator('body')
  for (const text of texts) {
    const ok = await body.filter({ hasText: text }).count().then((count) => count > 0).catch(() => false)
    if (ok) return
  }
  await expect(body, `${label} should contain one of: ${texts.join(', ')}`).toContainText(texts[0], { timeout: 20_000 })
}

async function firstVisible(page, selectors, timeout = 2_000) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first()
    const visible = await locator.waitFor({ state: 'visible', timeout }).then(() => true).catch(() => false)
    if (visible) return locator
  }
  return null
}

async function expectPageVisible(page, point) {
  if (point.type !== 'mobile') {
    await expectNoBlankPage(page)
    return
  }

  await expect(page.locator('body')).toContainText(/EISCore Mobile|移动应用|库存盘点/, { timeout: 30_000 })
  const metrics = await page.evaluate(() => {
    const visibleNodes = Array.from(document.body.querySelectorAll('*')).filter((node) => {
      const rect = node.getBoundingClientRect()
      const style = window.getComputedStyle(node)
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none'
    })
    return {
      bodyTextLength: document.body.innerText.trim().length,
      visibleNodeCount: visibleNodes.length
    }
  })

  expect(metrics.bodyTextLength, 'mobile page should have visible text').toBeGreaterThan(20)
  expect(metrics.visibleNodeCount, 'mobile page should have visible DOM nodes').toBeGreaterThan(5)
}

async function expectInteractiveSurface(page, point) {
  await expectPageVisible(page, point)
  const expectedTexts = point.expected || [point.name]
  if (point.route?.startsWith('/ai/enterprise')) {
    await page.locator('iframe[src*="/harness-embed/"]').first().waitFor({ state: 'attached', timeout: 30_000 })
  }
  // The iframe is attached before its navigation commits. Resolve the frame
  // through the locator so the assertion cannot race page.frames() discovery.
  const harnessFrame = point.route?.startsWith('/ai/enterprise')
    ? await page.locator('iframe[src*="/harness-embed/"]').first().contentFrame()
    : page.frames().find((frame) => frame !== page.mainFrame() && frame.url().includes('/harness-embed/'))
  if (harnessFrame) {
    // The native Harness onboarding asks first-time, keyless users whether
    // they want to configure the official provider.  Selecting "Configure
    // later" is the supported no-secret path; it must happen before the
    // embedded business surface can be asserted.
    const configureLater = harnessFrame.locator('button').filter({ hasText: /Configure later|稍后配置/i }).first()
    if (await configureLater.waitFor({ state: 'visible', timeout: 5_000 }).then(() => true).catch(() => false)) {
      await configureLater.click()
      await harnessFrame.locator('body').waitFor({ state: 'visible', timeout: 2_000 }).catch(() => {})
    }
    await expect(harnessFrame.locator('body'), `${point.id} Harness iframe should render visible content`).toContainText(/企业经营助手|对话|DeepSeek Harness|Digital Twin|Smart BI/i, { timeout: 30_000 })
    return
  }
  await expectAnyText(page, expectedTexts, `${point.id} ${point.name}`)

  if (['grid', 'stock'].includes(point.type)) {
    const grid = await firstVisible(page, [
      '[data-guide="grid-wrapper"]',
      '.eis-grid-wrapper',
      '.ag-root-wrapper',
      '.el-table',
      '.grid-card'
    ], functionPointSurfaceTimeoutMs)
    expect(grid, `${point.id} ${point.name} should expose a grid/table surface`).toBeTruthy()

    const search = await firstVisible(page, [
      '[data-guide="grid-search"] input',
      'input[placeholder*="搜索"]',
      'input[placeholder*="查询"]',
      'input[placeholder*="编码"]'
    ], 2_000)
    if (search) {
      await search.click()
      await search.fill('EISCORE_67_PROBE')
      await page.waitForTimeout(250)
      await search.fill('')
    }
    return
  }

  if (point.type === 'dashboard') {
    const dashboard = await firstVisible(page, [
      'canvas',
      'svg',
      '.echarts',
      '.stat-card',
      '.dashboard',
      '.cockpit',
      '.overview',
      '.app-card'
    ], functionPointContentTimeoutMs)
    expect(dashboard, `${point.id} ${point.name} should render dashboard content`).toBeTruthy()
    return
  }

  if (point.type === 'apps') {
    const appEntry = await firstVisible(page, [
      '[data-guide="app-card"]',
      '.app-card',
      '.dashboard-card',
      'button'
    ], functionPointContentTimeoutMs)
    expect(appEntry, `${point.id} ${point.name} should expose app entries`).toBeTruthy()
    return
  }

  if (point.type === 'special') {
    const special = await firstVisible(page, [
      'button',
      'input',
      '.el-tabs',
      '.el-tree',
      '.el-table',
      'canvas',
      'svg'
    ], functionPointContentTimeoutMs)
    expect(special, `${point.id} ${point.name} should expose interactive content`).toBeTruthy()

    if (point.id === 'FP64') {
      await expect(page.getByRole('button', { name: /推理引擎/ })).not.toContainText('0 facts', { timeout: 20_000 })
      await expect(page.getByRole('button', { name: /KG 查询/ })).not.toContainText('0/0', { timeout: 20_000 })
      await expect(page.getByRole('button', { name: /洞察审计/ })).not.toContainText('unknown', { timeout: 20_000 })

      const graphNode = page.locator('.graph-node').first()
      await expect(graphNode, 'FP64 should render ontology relation graph nodes').toBeVisible({ timeout: 20_000 })
      await graphNode.click()
      await expect(page.locator('.column-semantic-panel')).not.toContainText('列语义 0 条', { timeout: 20_000 })
      await expect(page.locator('.column-semantic-panel .el-table')).toBeVisible({ timeout: 20_000 })
    }
  }
}

test.describe('67 complete function points', () => {
  test.beforeEach(async ({ page, request }) => {
    await seedAuth(page, await loginByApi(request))
  })

  for (const point of selectedFunctionPoints67) {
    test(`${point.id} ${point.module} - ${point.name}`, async ({ page }) => {
      const uiMonitor = createUiErrorMonitor(page)
      const httpMonitor = createHttpErrorMonitor(page)

      if (point.type === 'mobile') {
        await page.setViewportSize({ width: 390, height: 844 })
      } else {
        await page.setViewportSize({ width: 1440, height: 900 })
      }

      await gotoWithRetry(page, point.route, { attempts: 3, timeout: 70_000 })

      if (!['public', 'mobile'].includes(point.type)) {
        await expectShellReady(page)
      }

      await expectInteractiveSurface(page, point)
      await uiMonitor.expectClean(`${point.id} ${point.name}`)
      httpMonitor.expectClean(`${point.id} ${point.name}`)
    })
  }
})
