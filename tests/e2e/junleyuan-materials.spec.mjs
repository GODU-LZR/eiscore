// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { expect, test } from '@playwright/test'

const isMaterialAsset = (url) => /\/company-site\/assets\/junleyuan-materials-v2\//.test(url)

test('君乐缘配置器加载 V2 材质卡并以 V3 纹理重建球杆', async ({ page }) => {
  const failedMaterialRequests = []
  const pageErrors = []
  page.on('requestfailed', (request) => {
    if (isMaterialAsset(request.url())) failedMaterialRequests.push(`${request.url()}: ${request.failure()?.errorText || 'unknown'}`)
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/company-site/')
  await expect(page.getByRole('heading', { name: '把官网内容、线索与发布流程放进 EISCore' })).toBeVisible()
  const initialTextureResponse = page.waitForResponse((response) => /\/textures\/JLY-MAT-MAPLE-V003\.webp$/.test(response.url()))
  await page.getByRole('button', { name: '3D 定制器 / BOM' }).click()
  await expect(page.getByRole('heading', { name: 'Design your cue' })).toBeVisible()
  await expect(page.locator('canvas[aria-label="Interactive prototype cue preview"]')).toBeVisible()
  await expect(page.locator('.stage-fallback')).toHaveCount(0)

  const mapleTexture = await initialTextureResponse
  expect(mapleTexture.status()).toBe(200)
  expect(mapleTexture.headers()['content-type']).toContain('image/webp')
  await expect(page.locator('.cue-stage')).toHaveAttribute('data-applied-material-textures', /JLY-MAT-MAPLE-TEXTURE-HQ-V003/)

  const mapleCardResponse = page.waitForResponse((response) => /\/cards\/JLY-MAT-MAPLE-V002\.webp$/.test(response.url()))
  await page.getByRole('button', { name: '04 Forearm & wood' }).click()
  await expect(page.getByRole('button', { name: /Birdseye maple \/ natural/ })).toBeVisible()
  const mapleCard = await mapleCardResponse
  expect(mapleCard.status()).toBe(200)
  expect(mapleCard.headers()['content-type']).toContain('image/webp')

  const ebonyTextureResponse = page.waitForResponse((response) => /\/textures\/JLY-MAT-EBONY-V003\.webp$/.test(response.url()))
  await page.getByRole('button', { name: /Ebony \/ satin black/ }).click()
  const ebonyTexture = await ebonyTextureResponse
  expect(ebonyTexture.status()).toBe(200)
  expect(ebonyTexture.headers()['content-type']).toContain('image/webp')
  await expect(page.locator('.cue-stage')).toHaveAttribute('data-applied-material-textures', /JLY-MAT-EBONY-TEXTURE-HQ-V003/)

  await expect(page.locator('.stage-error')).toHaveCount(0)
  expect(failedMaterialRequests).toEqual([])
  expect(pageErrors, 'Cue Builder should mount and rebuild without JavaScript errors').toEqual([])
})
