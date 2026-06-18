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
  await expectAnyText(page, point.expected || [point.name], `${point.id} ${point.name}`)

  if (['grid', 'stock'].includes(point.type)) {
    const grid = await firstVisible(page, [
      '[data-guide="grid-wrapper"]',
      '.eis-grid-wrapper',
      '.ag-root-wrapper',
      '.el-table',
      '.grid-card'
    ], 10_000)
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
    ], 8_000)
    expect(dashboard, `${point.id} ${point.name} should render dashboard content`).toBeTruthy()
    return
  }

  if (point.type === 'apps') {
    const appEntry = await firstVisible(page, [
      '[data-guide="app-card"]',
      '.app-card',
      '.dashboard-card',
      'button'
    ], 8_000)
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
    ], 8_000)
    expect(special, `${point.id} ${point.name} should expose interactive content`).toBeTruthy()
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
