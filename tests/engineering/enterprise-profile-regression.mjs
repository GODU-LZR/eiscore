// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import {
  createEnterpriseProfileService,
  enterpriseProfileFromSiteConfig,
  mergeEnterpriseProfileIntoSystemConfig,
  stripEnterpriseProfileFromSystemConfig
} from '../../packages/eiscore-platform/src/enterprise-profile.mjs'
import { DEFAULT_ENTERPRISE_CONFIG } from '../../packages/eiscore-platform/src/enterprise-config.mjs'

const sitePayload = {
  ok: true,
  site: {
    siteKey: 'primary',
    legalName: '示例制造有限公司',
    brandName: '示例制造',
    brandShortName: '示例',
    factoryName: '示例工厂',
    domain: 'factory.example.test',
    defaultLocale: 'zh-CN',
    enabledLocales: ['zh-CN', 'en-US'],
    theme: { primaryColor: '#1f6755' },
    contact: {
      email: 'sales@example.test',
      phone: '12345678',
      address: '示例地址'
    },
    trademark: { asset: '/company-assets/brand.svg' },
    settings: { publicPath: '/company' },
    seo: { title: '示例制造官网', description: '示例企业公开介绍' },
    status: 'published',
    publishedVersion: 7
  }
}

const profile = enterpriseProfileFromSiteConfig(sitePayload, {
  enterpriseConfig: DEFAULT_ENTERPRISE_CONFIG
})

assert.equal(profile.siteKey, 'primary')
assert.equal(profile.legalName, '示例制造有限公司')
assert.equal(profile.displayName, '示例制造')
assert.equal(profile.shortName, '示例')
assert.equal(profile.logoUrl, '/company-assets/brand.svg')
assert.equal(profile.themeColor, '#1F6755')
assert.equal(profile.publicSiteUrl, 'https://factory.example.test/company/')
assert.deepEqual(profile.enabledLocales, ['zh-CN', 'en-US'])
assert.equal(profile.contact.email, 'sales@example.test')
assert.equal(profile.publishedVersion, 7)

const merged = mergeEnterpriseProfileIntoSystemConfig({
  title: '内部系统标题',
  themeColor: '#409EFF',
  notifications: false,
  loginBranding: {
    companyName: '历史重复名称',
    logo: '/legacy-logo.png',
    description: '历史重复企业介绍',
    authTitle: '登录内部系统',
    secondaryActionUrl: '/legacy-site'
  }
}, profile)

assert.equal(merged.title, '内部系统标题')
assert.equal(merged.themeColor, '#409EFF')
assert.equal(merged.notifications, false)
assert.equal(merged.loginBranding.companyName, '示例制造')
assert.equal(merged.loginBranding.logo, '/company-assets/brand.svg')
assert.equal(merged.loginBranding.description, '示例企业公开介绍')
assert.equal(merged.loginBranding.siteTag, '示例制造有限公司')
assert.equal(merged.loginBranding.authTitle, '登录内部系统')
assert.equal(merged.loginBranding.secondaryActionUrl, 'https://factory.example.test/company/')

const persisted = stripEnterpriseProfileFromSystemConfig(merged)
assert.equal(Object.hasOwn(persisted.loginBranding, 'companyName'), false)
assert.equal(Object.hasOwn(persisted.loginBranding, 'logo'), false)
assert.equal(Object.hasOwn(persisted.loginBranding, 'description'), false)
assert.equal(Object.hasOwn(persisted.loginBranding, 'siteTag'), false)
assert.equal(Object.hasOwn(persisted.loginBranding, 'secondaryActionUrl'), false)
assert.equal(persisted.loginBranding.authTitle, '登录内部系统')

const calls = []
const service = createEnterpriseProfileService({
  enterpriseConfig: DEFAULT_ENTERPRISE_CONFIG,
  httpClient: {
    async requestJson(path, options) {
      calls.push({ path, options })
      return { data: sitePayload }
    }
  }
})

assert.deepEqual(await service.readProfile(), profile)
assert.deepEqual(calls, [{
  path: '/company-site/public/site-config',
  options: { service: 'agent' }
}])

const fallbackWarnings = []
const fallbackService = createEnterpriseProfileService({
  enterpriseConfig: DEFAULT_ENTERPRISE_CONFIG,
  httpClient: {
    async requestJson() {
      throw new Error('offline')
    }
  },
  onWarning: (event) => fallbackWarnings.push(event)
})
const fallback = await fallbackService.readProfile()
assert.equal(fallback.displayName, DEFAULT_ENTERPRISE_CONFIG.enterprise.displayName)
assert.equal(fallback.source, 'deployment-fallback')
assert.equal(fallbackWarnings[0].code, 'profile-unavailable')

console.log('enterprise-profile-regression: PASS')
