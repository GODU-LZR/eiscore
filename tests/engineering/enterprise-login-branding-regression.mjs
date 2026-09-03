// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  EnterpriseConfigError,
  parseEnterpriseConfig
} from '../../packages/eiscore-platform/src/enterprise-config.mjs'
import { normalizeLoginBranding } from '../../packages/eiscore-platform/src/login-branding.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const runtimeProfilePath = resolve(repoRoot, 'eiscore-base/public/config/eiscore-enterprise.json')
const runtimeProfile = JSON.parse(readFileSync(runtimeProfilePath, 'utf8'))
const enterpriseConfig = parseEnterpriseConfig(runtimeProfile, { source: 'compatibility runtime profile' })
const v2Profile = parseEnterpriseConfig(
  JSON.parse(readFileSync(resolve(repoRoot, 'config/enterprise.v2.example.json'), 'utf8')),
  { source: 'v2 runtime profile' }
)

const desktop = normalizeLoginBranding({}, { enterpriseConfig })
assert.equal(desktop.companyName, '广东南派食品有限公司')
assert.equal(desktop.logo, 'https://29761748.s21i.faiusr.com/2/ABUIABACGAAg3MisnwYo8JqKqQYw9AM49AM.jpg')
assert.equal(desktop.slogan, '深耕热带水果全产业链，打造高品质水果制品方案')
assert.equal(desktop.metrics.length, 3)
assert.equal(desktop.businessChain.length, 3)
assert.equal(desktop.capabilities.length, 3)
assert.equal(desktop.carouselImages.length, 3)
assert.equal(desktop.footerText, 'Copyright © EISCore')

const mobile = normalizeLoginBranding({}, { enterpriseConfig, surface: 'mobile' })
assert.equal(mobile.companyName, desktop.companyName)
assert.equal(mobile.authFootnote, '仅授权人员使用')
assert.equal(mobile.showSecondaryAction, false)
assert.equal(mobile.passBadgeText, '员工通行')
assert.equal(mobile.businessChainTitle, '从产地到交付的服务路径')
assert.equal(mobile.footerText, 'Copyright © 广东南派食品有限公司')

const v2Neutral = normalizeLoginBranding({}, { enterpriseConfig: v2Profile })
assert.equal(v2Neutral.companyName, '示例制造企业')
assert.equal(v2Neutral.logo, '/config/assets/logo.svg')
assert.equal(v2Neutral.slogan, '连接业务、数据与智能协作')
assert.equal(v2Neutral.siteTag, '企业数字化平台')
assert.deepEqual(v2Neutral.navItems, [])
assert.deepEqual(v2Neutral.metrics, [])
assert.deepEqual(v2Neutral.businessChain, [])
assert.deepEqual(v2Neutral.capabilities, [])
assert.deepEqual(v2Neutral.leaders, [])

const custom = normalizeLoginBranding({
  companyName: '运行期自定义企业',
  slogan: '运行期自定义口号',
  metrics: []
}, { enterpriseConfig })
assert.equal(custom.companyName, '运行期自定义企业')
assert.equal(custom.slogan, '运行期自定义口号')
assert.deepEqual(custom.metrics, [])
assert.notEqual(custom, desktop)
assert.equal(Object.isFrozen(custom), false)

const unsafe = structuredClone(runtimeProfile)
unsafe.branding.login.carouselImages[0].url = 'javascript:alert(1)'
assert.throws(
  () => parseEnterpriseConfig(unsafe, { source: 'unsafe login branding' }),
  (error) => error instanceof EnterpriseConfigError &&
    error.issues.some((issue) => issue.path === '$.branding.login.carouselImages[0].url' && issue.code === 'unsafe-url')
)

const unknown = structuredClone(runtimeProfile)
unknown.branding.login.metrics[0].internalNote = 'must not leak into the public profile'
assert.throws(
  () => parseEnterpriseConfig(unknown, { source: 'unknown login branding field' }),
  (error) => error instanceof EnterpriseConfigError &&
    error.issues.some((issue) => issue.path === '$.branding.login.metrics[0].internalNote' && issue.code === 'unknown-key')
)

const productSources = [
  'eiscore-base/src/stores/system.js',
  'eiscore-base/src/views/LoginView.vue',
  'eiscore-base/src/views/SettingsView.vue',
  'eiscore-mobile/src/views/LoginView.vue'
]
const customerHardcodePattern = /广东南派|热带水果|faiusr\.com|海边姑娘|NANPAI/i
for (const path of productSources) {
  const source = readFileSync(resolve(repoRoot, path), 'utf8')
  assert.doesNotMatch(source, customerHardcodePattern, `${path} must consume enterprise configuration`)
}

const mobileMainSource = readFileSync(resolve(repoRoot, 'eiscore-mobile/src/main.js'), 'utf8')
const loadIndex = mobileMainSource.indexOf('await loadEnterpriseConfig')
const publishIndex = mobileMainSource.indexOf('publishEnterpriseConfig(enterpriseConfig')
const mountIndex = mobileMainSource.indexOf('mountMobileApplication()')
assert.ok(loadIndex >= 0 && publishIndex > loadIndex && mountIndex > publishIndex)
assert.match(mobileMainSource, /required:\s*import\.meta\.env\.PROD/)

const mobilePackage = JSON.parse(readFileSync(resolve(repoRoot, 'eiscore-mobile/package.json'), 'utf8'))
assert.equal(mobilePackage.dependencies['@eiscore/platform'], 'file:../packages/eiscore-platform')

console.log('PASS: enterprise login branding compatibility')
