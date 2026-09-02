// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { expect, test } from '@playwright/test'
import { createUiErrorMonitor, expectShellReady } from './helpers.mjs'

const HOST_URL = 'http://127.0.0.1:18000'

const encodeJwtPart = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')

const createAdminAuth = () => {
  const username = 'enterprise-profile-e2e'
  const token = [
    encodeJwtPart({ alg: 'HS256', typ: 'JWT' }),
    encodeJwtPart({
      sub: username,
      username,
      role: 'web_user',
      app_role: 'super_admin',
      exp: Math.floor(Date.now() / 1000) + 3600
    }),
    'e2e-signature'
  ].join('.')
  return {
    token,
    user: {
      id: username,
      name: username,
      username,
      role: 'super_admin',
      app_role: 'super_admin',
      dbRole: 'web_user',
      permissions: ['*'],
      avatar: ''
    }
  }
}

const jsonResponse = (route, body, status = 200) => route.fulfill({
  status,
  contentType: 'application/json; charset=utf-8',
  body: JSON.stringify(body)
})

const formInput = (page, label) => page
  .locator('.settings-section .el-form-item')
  .filter({ hasText: new RegExp(`^${label}`) })
  .locator('input')
  .first()

test('published enterprise profile remains single-source across settings, draft and publish UI', async ({ page }) => {
  const initialBrandName = '合并验收企业'
  const draftBrandName = '合并验收企业·新版'
  const logo = 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2240%22 height=%2240%22%3E%3Crect width=%2240%22 height=%2240%22 fill=%22%23409eff%22/%3E%3C/svg%3E'
  let published = {
    siteKey: 'enterprise-profile-e2e',
    legalName: '合并验收企业有限公司',
    brandName: initialBrandName,
    brandShortName: '合并验收',
    factoryName: '合并验收工厂',
    domain: 'https://profile-e2e.example.test',
    defaultLocale: 'zh-CN',
    enabledLocales: ['zh-CN'],
    theme: { primaryColor: '#409eff' },
    contact: { email: 'profile-e2e@example.test', phone: '0759-0000000' },
    trademark: { asset: logo },
    seo: { description: '企业资料合并浏览器验收' },
    status: 'published',
    publishedVersion: 3
  }
  let draft = structuredClone(published)
  let saveCalls = 0
  let publishCalls = 0
  const auth = createAdminAuth()

  await page.route(`${HOST_URL}/api/**`, async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname === '/api/rpc/login' && route.request().method() === 'POST') {
      await jsonResponse(route, {
        token: auth.token,
        username: auth.user.username,
        app_role: auth.user.app_role,
        permissions: auth.user.permissions
      })
      return
    }
    if (url.pathname === '/api/system_configs' && url.searchParams.get('key') === 'eq.app_settings') {
      await jsonResponse(route, [{
        key: 'app_settings',
        value: {
          title: 'EISCore 合并验收',
          themeColor: '#409EFF',
          notifications: true,
          materialsCategoryDepth: 2
        }
      }])
      return
    }
    await jsonResponse(route, [])
  })

  await page.route(`${HOST_URL}/agent/**`, async (route) => {
    const url = new URL(route.request().url())
    const method = route.request().method()

    if (url.pathname === '/agent/company-site/public/site-config' && method === 'GET') {
      await jsonResponse(route, { site: published })
      return
    }
    if (url.pathname === '/agent/company-site/admin/site-config' && method === 'GET') {
      await jsonResponse(route, { config: { site: draft } })
      return
    }
    if (url.pathname === '/agent/company-site/admin/site-config' && method === 'PATCH') {
      const payload = route.request().postDataJSON()
      draft = {
        ...draft,
        ...payload,
        status: 'draft',
        trademark: payload.trademark || draft.trademark
      }
      saveCalls += 1
      await jsonResponse(route, { config: { site: draft } })
      return
    }
    if (url.pathname === '/agent/company-site/admin/content/publish' && method === 'POST') {
      published = {
        ...draft,
        status: 'published',
        publishedVersion: Number(published.publishedVersion || 0) + 1
      }
      draft = structuredClone(published)
      publishCalls += 1
      await jsonResponse(route, { item: published })
      return
    }
    if (url.pathname.startsWith('/agent/company-site/admin/')) {
      await jsonResponse(route, { items: [] })
      return
    }
    await jsonResponse(route, { items: [] })
  })

  const ui = createUiErrorMonitor(page)

  await page.goto('/login')
  await page.getByPlaceholder('用户名').fill(auth.user.username)
  await page.getByPlaceholder('密码').fill('enterprise-profile-e2e-password')
  await page.locator('.login-btn').click()
  await expectShellReady(page)

  await page.goto('/settings')
  await expectShellReady(page)
  await page.getByRole('tab', { name: '企业资料' }).click()

  const profile = page.locator('.enterprise-profile-panel')
  await expect(profile).toContainText('企业公开资料已合并到企业站点运营')
  await expect(profile.getByRole('heading', { name: initialBrandName })).toBeVisible()
  await expect(profile).toContainText('profile-e2e@example.test')
  await expect(profile.locator('input, textarea')).toHaveCount(0)

  await profile.getByRole('button', { name: '进入企业站点运营' }).click()
  await expect(page).toHaveURL(/\/company-site\/?$/)
  await expect(page.locator('[data-guide="company-site-ops"]')).toBeVisible({ timeout: 45_000 })

  await page.getByRole('tab', { name: '站点设置' }).click()
  await expect(formInput(page, '品牌名称')).toHaveValue(initialBrandName)
  await formInput(page, '品牌名称').fill(draftBrandName)
  await page.getByRole('button', { name: '保存设置' }).click()
  await expect(page.locator('.el-message--success')).toContainText('站点设置已保存为草稿')
  expect(saveCalls).toBe(1)
  expect(published.brandName).toBe(initialBrandName)

  const publicDraftCheck = await page.evaluate(async () => {
    const response = await fetch('/agent/company-site/public/site-config')
    return response.json()
  })
  expect(publicDraftCheck.site.brandName).toBe(initialBrandName)

  await page.goto('/settings')
  await expectShellReady(page)
  await page.getByRole('tab', { name: '企业资料' }).click()
  await expect(page.locator('.enterprise-profile-panel').getByRole('heading', { name: initialBrandName })).toBeVisible()

  await page.locator('.enterprise-profile-panel').getByRole('button', { name: '进入企业站点运营' }).click()
  await expect(page.locator('[data-guide="company-site-ops"]')).toBeVisible({ timeout: 45_000 })
  await page.getByRole('tab', { name: '站点设置' }).click()
  await expect(formInput(page, '品牌名称')).toHaveValue(draftBrandName)

  await page.getByRole('button', { name: '发布站点' }).click()
  await page.getByRole('button', { name: '确定' }).click()
  await expect(page.locator('.el-message--success')).toContainText('站点已发布')
  expect(publishCalls).toBe(1)
  expect(published.brandName).toBe(draftBrandName)
  expect(published.publishedVersion).toBe(4)

  await page.goto('/settings')
  await expectShellReady(page)
  await page.getByRole('tab', { name: '企业资料' }).click()
  await expect(page.locator('.enterprise-profile-panel').getByRole('heading', { name: draftBrandName })).toBeVisible()
  await expect(page.locator('.enterprise-profile-panel')).toContainText('v4')

  await page.reload()
  await expectShellReady(page)
  await page.getByRole('tab', { name: '企业资料' }).click()
  await expect(page.locator('.enterprise-profile-panel').getByRole('heading', { name: draftBrandName })).toBeVisible()
  await expect(page.locator('.enterprise-profile-panel')).toContainText('v4')
  await ui.expectClean('enterprise profile merge')
})
