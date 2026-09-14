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
  { name: 'app center module', path: '/apps/' },
  { name: 'company site operations module', path: '/company-site/' }
]

test('public login page renders employee entry', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })

  await expect(page.locator('.brand-slogan')).toContainText('从南方水果出发')
  await expect(page.locator('.public-product-card')).toHaveCount(5)
  const firstProductCardBox = await page.locator('.public-product-card').first().boundingBox()
  expect(firstProductCardBox.width / firstProductCardBox.height).toBeCloseTo(16 / 9, 1)
  await expect(page.locator('.product-card-media img')).toHaveCount(5)
  await page.locator('.product-card-media img').last().scrollIntoViewIfNeeded()
  await expect.poll(() => page.locator('.product-card-media img').evaluateAll((images) => (
    images.every((image) => image.complete && image.naturalWidth > 0)
  ))).toBe(true)
  await expect(page.getByRole('button', { name: '查看应用方向', exact: true })).toHaveCount(5)
  await expect(page.locator('.public-solution-list article')).toHaveCount(4)
  await expect(page.locator('.solution-feature-media img')).toHaveCount(1)
  await page.locator('.public-solution-list article').nth(1).hover()
  await expect(page.locator('.solution-feature-media figcaption strong')).toHaveText('餐饮与零售应用')
  await expect(page.locator('.hero-media img')).toHaveAttribute('src', '/enterprise-assets/site/factory-overview.jpg')
  await expect(page.locator('.gallery-track img')).toHaveCount(12)
  await expect.poll(() => page.locator('.gallery-track img').evaluateAll((images) => (
    images.every((image) => image.complete && image.naturalWidth > 0)
  ))).toBe(true)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex,nofollow')
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1)
  await expect(page.getByText('待确认非生产发布')).toHaveCount(0)
  await expect(page.locator('.auth-panel')).toBeHidden()
  await expect(page.getByPlaceholder('用户名')).toBeHidden()
  await page.locator('.header-login').click()
  await expect(page.locator('.auth-panel')).toBeVisible()
  await expect(page.getByPlaceholder('用户名')).toBeVisible()
  await expect(page.getByPlaceholder('密码')).toBeVisible()
  await expect(page.locator('.login-btn')).toBeVisible()
  await expectNoBlankPage(page)
})

test('public company portal switches to the English research package', async ({ page }) => {
  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'EN', exact: true }).click()

  await expect(page.getByRole('heading', { level: 1, name: 'Nanpai Food' })).toBeVisible()
  await expect(page.locator('.brand-slogan')).toContainText('From southern fruit')
  await expect(page.locator('.public-product-card')).toHaveCount(5)
  await expect(page.locator('.product-card-media img')).toHaveCount(5)
  await page.locator('.product-card-media img').last().scrollIntoViewIfNeeded()
  await expect.poll(() => page.locator('.product-card-media img').evaluateAll((images) => (
    images.every((image) => image.complete && image.naturalWidth > 0)
  ))).toBe(true)
  await expect(page.getByRole('button', { name: 'View applications', exact: true })).toHaveCount(5)
  await expect(page.locator('.public-solution-list article')).toHaveCount(4)
  await expect(page.locator('.solution-feature-media img')).toHaveCount(1)
  await page.locator('.public-solution-list article').nth(1).focus()
  await expect(page.locator('.solution-feature-media figcaption strong')).toHaveText('Foodservice and retail applications')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-US')
  await expect(page.locator('.auth-panel')).toBeHidden()
  await page.getByRole('button', { name: 'Employee access', exact: true }).click()
  await expect(page.getByPlaceholder('Username')).toBeVisible()
  await expect(page.getByPlaceholder('Password')).toBeVisible()
  await expectNoBlankPage(page)
})

test('standalone company operations adopts the active enterprise title and icon', async ({ page, request }) => {
  await seedAuth(page, await loginByApi(request))
  await page.goto('http://127.0.0.1:8092/company-site/', { waitUntil: 'domcontentloaded' })

  await expect(page).toHaveTitle('南派食品｜企业站点运营｜EISCore')
  await expect(page.locator('#enterprise-favicon')).toHaveAttribute(
    'href',
    '/company-site/enterprise-assets/site/favicon.svg'
  )
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

  test('company site operations loads source evidence and keyword records', async ({ page }) => {
    await page.goto('/company-site/', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-guide="company-site-ops"]')).toBeVisible()
    await expect(page.getByText('南派食品', { exact: true }).first()).toBeVisible()
    await page.getByRole('tab', { name: '内容资产' }).click()

    await page.locator('.content-type-select').click()
    await page.getByRole('option', { name: '证据记录', exact: true }).click()
    await expect(page.locator('.content-table tbody tr')).toHaveCount(9)

    await page.locator('.content-type-select').click()
    await page.getByRole('option', { name: '关键词地图', exact: true }).click()
    const activeKeywordRows = page.locator('.content-table tbody tr').filter({ hasNotText: '已归档' })
    await expect(activeKeywordRows).toHaveCount(20)
  })

  for (const route of authenticatedRoutes) {
    test(`${route.name} deep link renders through host shell`, async ({ page }) => {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' })
      await expectSubAppReady(page)
    })
  }
})
