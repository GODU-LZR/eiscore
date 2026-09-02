// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { expect, test } from '@playwright/test'
import { createUiErrorMonitor, expectShellReady } from '../e2e/helpers.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const isolatedProject = process.env.EISCORE_E2E_ISOLATED_PROJECT
const dbContainer = process.env.EISCORE_E2E_DB_CONTAINER
const username = process.env.EISCORE_E2E_ADMIN_USERNAME
const password = process.env.EISCORE_E2E_ADMIN_PASSWORD
const backupInContainer = '/tmp/eiscore-company-site-full-stack.dump'
const backupOnHost = resolve(repoRoot, 'tests/.artifacts/eiscore-company-site-full-stack.dump')
let backupReady = false

const runDocker = (args, label) => {
  const result = spawnSync('docker', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024
  })
  if (result.error || result.status !== 0) {
    const detail = String(result.stderr || result.stdout || result.error?.message || '').trim()
    throw new Error(`${label} failed${detail ? `: ${detail}` : ''}`)
  }
  return String(result.stdout || '').trim()
}

const assertIsolatedDatabase = () => {
  expect(isolatedProject).toBe('eiscore-g35')
  expect(dbContainer).toBe(`${isolatedProject}-db`)
  const composeProject = runDocker([
    'inspect', '--format', '{{ index .Config.Labels "com.docker.compose.project" }}', dbContainer
  ], 'isolated database label check')
  expect(composeProject).toBe(isolatedProject)
}

const formInput = (page, label) => page
  .locator('.settings-section .el-form-item')
  .filter({ hasText: new RegExp(`^${label}`) })
  .locator('input')
  .first()

test.beforeAll(() => {
  assertIsolatedDatabase()
  const column = runDocker([
    'exec', dbContainer, 'psql', '-U', 'postgres', '-d', 'eiscore', '-Atc',
    "SELECT data_type || '|' || is_nullable FROM information_schema.columns WHERE table_schema='company_site' AND table_name='site_config' AND column_name='published_snapshot';"
  ], 'published snapshot schema check')
  expect(column).toBe('jsonb|NO')
  runDocker([
    'exec', dbContainer, 'pg_dump', '-U', 'postgres', '-d', 'eiscore', '-Fc',
    '-n', 'company_site', '-f', backupInContainer
  ], 'company-site pre-test backup')
  runDocker(['cp', `${dbContainer}:${backupInContainer}`, backupOnHost], 'company-site backup copy')
  expect(readFileSync(backupOnHost).byteLength).toBeGreaterThan(0)
  backupReady = true
})

test.afterAll(() => {
  if (!backupReady) return
  assertIsolatedDatabase()
  runDocker([
    'exec', dbContainer, 'psql', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', 'eiscore',
    '-c', 'DROP SCHEMA IF EXISTS company_site CASCADE;'
  ], 'company-site test cleanup')
  runDocker(['cp', backupOnHost, `${dbContainer}:${backupInContainer}`], 'company-site restore copy')
  runDocker([
    'exec', dbContainer, 'pg_restore', '--exit-on-error', '-U', 'postgres', '-d', 'eiscore',
    '--no-owner', backupInContainer
  ], 'company-site test restore')
  runDocker(['exec', dbContainer, 'rm', '-f', backupInContainer], 'company-site container backup cleanup')
  const restored = runDocker([
    'exec', dbContainer, 'psql', '-U', 'postgres', '-d', 'eiscore', '-Atc',
    "SELECT count(*) || '|' || min(status) FROM company_site.site_config WHERE site_key='primary';"
  ], 'company-site restore verification')
  expect(restored).toMatch(/^1\|/)
})

test('real database keeps the published enterprise profile online until a draft is published', async ({ page, request }) => {
  const ui = createUiErrorMonitor(page)

  await page.goto('/login')
  await page.getByPlaceholder('用户名').fill(username)
  await page.getByPlaceholder('密码').fill(password)
  await page.locator('.login-btn').click()
  await expectShellReady(page)

  const initialPublic = await page.evaluate(async () => {
    const response = await fetch('/agent/company-site/public/site-config')
    return { status: response.status, payload: await response.json() }
  })
  expect(initialPublic.status).toBe(200)
  const initialBrandName = initialPublic.payload.site.brandName
  const initialDomain = initialPublic.payload.site.domain
  const initialVersion = Number(initialPublic.payload.site.publishedVersion)
  expect(initialBrandName).toBeTruthy()
  expect(initialDomain).toBeTruthy()
  expect(initialVersion).toBeGreaterThanOrEqual(1)

  await page.goto('/settings')
  await expectShellReady(page)
  await page.getByRole('tab', { name: '企业资料' }).click()
  const profile = page.locator('.enterprise-profile-panel')
  await expect(profile.getByRole('heading', { name: initialBrandName })).toBeVisible()
  await expect(profile.locator('input, textarea')).toHaveCount(0)

  await profile.getByRole('button', { name: '进入企业站点运营' }).click()
  await expect(page).toHaveURL(/\/company-site\/?$/)
  await expect(page.locator('[data-guide="company-site-ops"]')).toBeVisible({ timeout: 45_000 })
  await page.getByRole('tab', { name: '站点设置' }).click()
  await expect(formInput(page, '品牌名称')).toHaveValue(initialBrandName)

  const draftBrandName = `全栈草稿-${Date.now()}`
  const secondDraftBrandName = `${draftBrandName}-二次保存`
  const draftDomain = `full-stack-${Date.now()}.example.test`
  await formInput(page, '品牌名称').fill(draftBrandName)
  await formInput(page, '站点域名').fill(draftDomain)
  await page.getByRole('button', { name: '保存设置' }).click()
  await expect(page.locator('.el-message--success')).toContainText('站点设置已保存为草稿')

  await formInput(page, '品牌名称').fill(secondDraftBrandName)
  await page.getByRole('button', { name: '保存设置' }).click()
  await expect(page.locator('.el-message--success').last()).toContainText('站点设置已保存为草稿')

  const publicDuringDraft = await page.evaluate(async () => {
    const response = await fetch('/agent/company-site/public/site-config')
    return { status: response.status, payload: await response.json() }
  })
  expect(publicDuringDraft.status).toBe(200)
  expect(publicDuringDraft.payload.site.brandName).toBe(initialBrandName)
  expect(publicDuringDraft.payload.site.domain).toBe(initialDomain)
  expect(publicDuringDraft.payload.site.publishedVersion).toBe(initialVersion)

  const publicAtDraftDomain = await request.get('/agent/company-site/public/site-config', {
    params: { domain: draftDomain }
  })
  expect(publicAtDraftDomain.status()).toBe(404)

  await page.goto('/settings')
  await expectShellReady(page)
  await page.getByRole('tab', { name: '企业资料' }).click()
  await expect(page.locator('.enterprise-profile-panel').getByRole('heading', { name: initialBrandName })).toBeVisible()

  await page.locator('.enterprise-profile-panel').getByRole('button', { name: '进入企业站点运营' }).click()
  await expect(page.locator('[data-guide="company-site-ops"]')).toBeVisible({ timeout: 45_000 })
  await page.getByRole('tab', { name: '站点设置' }).click()
  await expect(formInput(page, '品牌名称')).toHaveValue(secondDraftBrandName)
  await page.getByRole('button', { name: '发布站点' }).click()
  await page.getByRole('button', { name: '确定' }).click()
  await expect(page.locator('.el-message--success')).toContainText('站点已发布')

  const publicAfterPublish = await page.evaluate(async () => {
    const response = await fetch('/agent/company-site/public/site-config')
    return { status: response.status, payload: await response.json() }
  })
  expect(publicAfterPublish.status).toBe(200)
  expect(publicAfterPublish.payload.site.brandName).toBe(secondDraftBrandName)
  expect(publicAfterPublish.payload.site.domain).toBe(draftDomain)
  expect(publicAfterPublish.payload.site.publishedVersion).toBe(initialVersion + 1)

  const publicAtOldDomain = await request.get('/agent/company-site/public/site-config', {
    params: { domain: initialDomain }
  })
  expect(publicAtOldDomain.status()).toBe(404)

  await page.goto('/settings')
  await expectShellReady(page)
  await page.getByRole('tab', { name: '企业资料' }).click()
  const publishedProfile = page.locator('.enterprise-profile-panel')
  await expect(publishedProfile.getByRole('heading', { name: secondDraftBrandName })).toBeVisible()
  await expect(publishedProfile).toContainText(`v${initialVersion + 1}`)

  await page.reload()
  await expectShellReady(page)
  await page.getByRole('tab', { name: '企业资料' }).click()
  await expect(page.locator('.enterprise-profile-panel').getByRole('heading', { name: secondDraftBrandName })).toBeVisible()
  await expect(page.locator('.enterprise-profile-panel')).toContainText(`v${initialVersion + 1}`)
  await ui.expectClean('enterprise profile full-stack merge')

  const authToken = await page.evaluate(() => localStorage.getItem('auth_token'))
  expect(authToken).toBeTruthy()
  const suspendResponse = await request.post('/agent/company-site/admin/content/publish', {
    headers: { Authorization: `Bearer ${authToken}` },
    data: { objectType: 'site_config', id: 'primary', status: 'suspended' }
  })
  expect(suspendResponse.status()).toBe(200)
  const publicSuspended = await request.get('/agent/company-site/public/site-config')
  expect(publicSuspended.status()).toBe(404)

  await page.goto('/settings')
  await expectShellReady(page)
  await page.getByRole('tab', { name: '企业资料' }).click()
  const emptyProfile = page.locator('.enterprise-profile-empty')
  await expect(emptyProfile).toContainText('尚未读取到已发布企业档案')
  const unavailableUi = createUiErrorMonitor(page)
  await expect(emptyProfile.getByRole('button', { name: '进入企业站点运营' })).toBeVisible()
  await expect(emptyProfile.locator('input, textarea')).toHaveCount(0)
  await unavailableUi.expectClean('suspended enterprise profile remains read-only after the expected profile 404')

  const backupHash = createHash('sha256').update(readFileSync(backupOnHost)).digest('hex')
  expect(backupHash).toMatch(/^[0-9a-f]{64}$/)
})
