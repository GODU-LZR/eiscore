// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  createEnterpriseProfileSummary,
  isPublishedEnterpriseProfile,
  resolveEnterpriseProfilePreviewUrl
} from '../../eiscore-base/src/domain/settings-enterprise-profile-policy.js'

const profile = {
  source: 'published-site',
  siteKey: 'tenant-a',
  displayName: '示例品牌',
  legalName: '示例制造有限公司',
  publicSiteUrl: 'https://factory.example.test/company/',
  logoUrl: '/assets/brand.svg',
  description: '公开企业介绍',
  enabledLocales: ['zh-CN', 'en-US'],
  contact: { phone: '10086', email: 'contact@example.test' },
  publishedVersion: 3
}

assert.equal(isPublishedEnterpriseProfile(profile), true)
assert.equal(isPublishedEnterpriseProfile({ ...profile, source: 'deployment-fallback' }), false)
assert.equal(resolveEnterpriseProfilePreviewUrl(profile), profile.publicSiteUrl)
assert.equal(resolveEnterpriseProfilePreviewUrl({ source: 'deployment-fallback' }), '/login')
assert.deepEqual(createEnterpriseProfileSummary(profile), {
  displayName: '示例品牌',
  legalName: '示例制造有限公司',
  siteKey: 'tenant-a',
  publicSiteUrl: 'https://factory.example.test/company/',
  logoUrl: '/assets/brand.svg',
  description: '公开企业介绍',
  contact: '10086 / contact@example.test',
  locales: 'zh-CN、en-US',
  publishedVersion: 3
})

const repoRoot = resolve(import.meta.dirname, '../..')
const settingsSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/views/SettingsView.vue'), 'utf8')
const profileComponentSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/components/settings/PublishedEnterpriseProfile.vue'), 'utf8')
assert.match(settingsSource, /<PublishedEnterpriseProfile/)
assert.match(settingsSource, /v-if="hasPublishedEnterpriseProfile"/)
assert.match(profileComponentSource, /进入企业站点运营/)
assert.match(settingsSource, /router\.push\('\/company-site'\)/)
assert.match(settingsSource, /<template v-else>/)

const operationsSource = readFileSync(resolve(repoRoot, 'eiscore-company-site/src/composables/use-company-site-operations.js'), 'utf8')
assert.match(operationsSource, /['"]\/company-site\/admin\/content\/publish['"]/)
assert.match(operationsSource, /objectType:\s*['"]site_config['"]/)
assert.match(operationsSource, /status:\s*['"]published['"]/)

console.log('PASS: settings exposes one published enterprise profile and keeps legacy fallback')
