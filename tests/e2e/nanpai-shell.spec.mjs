// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { expect, test } from '@playwright/test'
import {
  expectNoBlankPage,
  expectShellReady,
  expectSubAppReady,
  loginByApi,
  seedAuth
} from './helpers.mjs'

const authenticatedRoutes = [
  { name: 'materials module', path: '/materials/apps' },
  { name: 'hr employee module', path: '/hr/employee' },
  { name: 'app center module', path: '/apps/' }
]

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
