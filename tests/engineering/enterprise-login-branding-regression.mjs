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
assert.equal(desktop.companyName, '伦度机电有限公司')
assert.equal(desktop.logo, '')
assert.equal(desktop.slogan, '专注电机与水泵产品，服务稳定运行。')
assert.equal(desktop.metrics.length, 4)
assert.equal(desktop.businessChain.length, 5)
assert.equal(desktop.capabilities.length, 4)
assert.equal(desktop.carouselImages.length, 6)
assert.equal(desktop.footerText, '伦度机电有限公司 · 浙江省台州市温岭市沈岙工业园区 · info@lundujd.com')

const mobile = normalizeLoginBranding({}, { enterpriseConfig, surface: 'mobile' })
assert.equal(mobile.companyName, desktop.companyName)
assert.equal(mobile.authFootnote, '账号由企业统一创建')
assert.equal(mobile.showSecondaryAction, false)
assert.equal(mobile.passBadgeText, '企业账户')
assert.equal(mobile.businessChainTitle, '产品体系与制造能力')
assert.equal(mobile.footerText, '伦度机电有限公司 · 浙江省台州市温岭市沈岙工业园区 · info@lundujd.com')

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

const withoutOptionalMedia = normalizeLoginBranding({
  logo: '',
  backgroundImage: ''
}, { enterpriseConfig })
assert.equal(withoutOptionalMedia.logo, '')
assert.equal(withoutOptionalMedia.backgroundImage, '')
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
const mobileLoginSource = readFileSync(resolve(repoRoot, 'eiscore-mobile/src/views/LoginView.vue'), 'utf8')
const loadIndex = mobileMainSource.indexOf('await loadEnterpriseConfig')
const publishIndex = mobileMainSource.indexOf('publishEnterpriseConfig(enterpriseConfig')
const mountIndex = mobileMainSource.indexOf('mountMobileApplication()')
assert.ok(loadIndex >= 0 && publishIndex > loadIndex && mountIndex > publishIndex)
assert.match(mobileMainSource, /required:\s*import\.meta\.env\.PROD/)
assert.match(mobileLoginSource, /PumpBomViewer/)
assert.match(mobileLoginSource, /showPumpViewer/)
assert.match(mobileLoginSource, /水泵 BOM 三维动画/)

const mobilePackage = JSON.parse(readFileSync(resolve(repoRoot, 'eiscore-mobile/package.json'), 'utf8'))
assert.equal(mobilePackage.dependencies['@eiscore/platform'], 'file:../packages/eiscore-platform')
assert.equal(mobilePackage.dependencies.three, '^0.185.1')

console.log('PASS: enterprise login branding compatibility')
