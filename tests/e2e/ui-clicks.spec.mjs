// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { expect, test } from '@playwright/test'
import {
  PASSWORD,
  USERNAME,
  closeAnyFloatingLayer,
  createUiErrorMonitor,
  expectGridReady,
  expectShellReady,
  expectSubAppReady,
  firstVisible,
  gotoWithRetry,
  loginByApi,
  seedAuth
} from './helpers.mjs'

test.setTimeout(180_000)

const sideMenuTargets = [
  { selector: '[data-guide="menu-materials"]', name: 'materials' },
  { selector: '[data-guide="menu-hr"]', name: 'hr' },
  { selector: '[data-guide="menu-apps"]', name: 'apps' },
  { selector: '[data-guide="menu-sales"]', name: 'sales' },
  { selector: '[data-guide="menu-purchase"]', name: 'purchase' },
  { selector: '[data-guide="menu-production"]', name: 'production' },
  { selector: '[data-guide="menu-quality"]', name: 'quality' },
  { selector: '[data-guide="menu-equipment"]', name: 'equipment' },
  { selector: '[data-guide="menu-decision"]', name: 'decision' }
]

async function clickSideMenu(page, target, monitor) {
  const menu = await firstVisible(page, target.selector, 1_000)
  if (!menu) return false
  await menu.click()
  await expectSubAppReady(page)
  await monitor.expectClean(`side menu ${target.name}`)
  return true
}

async function clickAppCard(page, key) {
  const card = page.locator(`[data-guide="app-card"][data-guide-key="${key}"]`).first()
  await expect(card, `app card ${key} should be visible`).toBeVisible({ timeout: 45_000 })
  await card.scrollIntoViewIfNeeded()
  await card.click()
}

async function firstVisibleButton(page, selector, namePattern) {
  return await firstVisible(page, selector, 1_500) ||
    await page.getByRole('button', { name: namePattern }).first()
      .waitFor({ state: 'visible', timeout: 1_500 })
      .then(() => page.getByRole('button', { name: namePattern }).first())
      .catch(() => null)
}

async function exerciseGridControls(page, monitor, label) {
  await expectGridReady(page)

  const searchInput = page.getByPlaceholder('搜索全表...').first()
  await expect(searchInput, `${label} search input should be visible`).toBeVisible()
  await searchInput.click()
  await searchInput.fill('EISCORE_UI_CLICK_PROBE')
  await page.waitForTimeout(500)
  await searchInput.clear()
  await page.waitForTimeout(500)
  await monitor.expectClean(`${label} grid search`)

  const configButton = await firstVisibleButton(page, '[data-guide="grid-config"]:not(.is-disabled)', /列管理/)
  if (configButton) {
    await configButton.click({ timeout: 5_000 })
    await page.waitForTimeout(500)
    await closeAnyFloatingLayer(page)
    await monitor.expectClean(`${label} column config click`)
  }

  const exportButton = await firstVisibleButton(page, '[data-guide="grid-export"]:not(.is-disabled)', /导出/)
  if (exportButton) {
    const downloadPromise = page.waitForEvent('download', { timeout: 5_000 }).catch(() => null)
    await exportButton.click({ timeout: 5_000 })
    const download = await downloadPromise
    if (download) await download.delete().catch(() => {})
    await monitor.expectClean(`${label} export`)
  }
}

test('user can log in by clicking the public form controls', async ({ page }) => {
  const monitor = createUiErrorMonitor(page)
  await gotoWithRetry(page, '/login')

  await page.locator('.header-login').click()
  await page.getByPlaceholder('用户名').click()
  await page.getByPlaceholder('用户名').fill(USERNAME)
  await page.getByPlaceholder('密码').click()
  await page.getByPlaceholder('密码').fill(PASSWORD)
  await page.locator('.el-checkbox').filter({ hasText: '记住我' }).click()
  await page.locator('.login-btn').click()

  await expectShellReady(page)
  await monitor.expectClean('interactive login')
})

test.describe('authenticated daily UI click tour', () => {
  test.beforeEach(async ({ page, request }) => {
    await seedAuth(page, await loginByApi(request))
  })

  test('shell header and side navigation clicks stay stable', async ({ page }) => {
    const monitor = createUiErrorMonitor(page)
    await gotoWithRetry(page, '/')
    await expectShellReady(page)

    await page.locator('[data-guide="collapse-button"]').click()
    await page.locator('[data-guide="collapse-button"]').click()
    await monitor.expectClean('sidebar collapse toggle')

    await page.locator('[data-guide="guide-entry"]').click()
    await expect(page.locator('.guide-center').first()).toBeVisible()
    await closeAnyFloatingLayer(page)
    await monitor.expectClean('guide center open')

    await page.locator('[data-guide="user-menu"]').click()
    await expect(page.getByText('退出登录').first()).toBeVisible()
    await closeAnyFloatingLayer(page)
    await monitor.expectClean('user menu open')

    let clickedMenus = 0
    for (const target of sideMenuTargets) {
      if (await clickSideMenu(page, target, monitor)) clickedMenus += 1
    }
    expect(clickedMenus, 'at least core side menus should be clickable').toBeGreaterThanOrEqual(3)
  })

  test('HR and materials app card clicks expose usable grid controls', async ({ page }) => {
    const monitor = createUiErrorMonitor(page)

    await gotoWithRetry(page, '/hr/apps')
    await expectSubAppReady(page)
    await clickAppCard(page, 'a')
    await exerciseGridControls(page, monitor, 'HR roster')

    await gotoWithRetry(page, '/materials/apps')
    await expectSubAppReady(page)
    await clickAppCard(page, 'a')
    await exerciseGridControls(page, monitor, 'materials list')
  })

  test('app center common entry cards can be clicked and safely cancelled', async ({ page }) => {
    const monitor = createUiErrorMonitor(page)
    await gotoWithRetry(page, '/apps/')
    await expectSubAppReady(page)

    await clickAppCard(page, 'create')
    await expect(page.locator('.el-dialog').filter({ hasText: '创建新应用' }).first()).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: '取消' }).click()
    await monitor.expectClean('app center create dialog cancel')

    await clickAppCard(page, 'config')
    await expectSubAppReady(page)
    await expect(page.locator('[data-guide="subapp-viewport"]')).toContainText(/配置|应用|流程|表格|闪念/, { timeout: 20_000 })
    await monitor.expectClean('app center config card')
  })
})
