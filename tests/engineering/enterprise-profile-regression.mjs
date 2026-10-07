// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import {
  createEnterpriseProfileService,
  enterprisePortalFromSiteConfig,
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

const noLogoProfile = enterpriseProfileFromSiteConfig({
  site: {
    siteKey: 'primary',
    legalName: '无标识示例企业',
    trademark: { asset: '' }
  }
}, { enterpriseConfig: DEFAULT_ENTERPRISE_CONFIG })
assert.equal(noLogoProfile.logoUrl, '')

const portal = enterprisePortalFromSiteConfig({
  site: {
    legalName: '示例制造有限公司',
    status: 'draft-preview',
    settings: { previewMode: true, previewLabel: '本地案例演示' }
  },
  content: {
    pages: [{
      slug: 'home',
      title: '从原料到交付',
      blocks: {
        homepage: {
          hero: {
            eyebrow: '示例制造',
            titleLines: ['从原料，', '到稳定交付。'],
            summary: '公开门户介绍',
            signals: ['批次协同']
          },
          metrics: [{ label: '业务重点', value: '制造协同' }],
          businessChain: [{ title: '原料管理', description: '按批次进入生产。' }],
          capabilities: [{ title: '过程追踪', description: '保持业务上下文。' }],
          carouselImages: [{ url: '/hero.jpg', title: '设备与产品', hasEmbeddedText: true }]
        }
      }
    }],
    products: [{ productCode: 'DEMO-001', name: '示例产品', applications: ['应用一'] }],
    solutions: [{ slug: 'solution-one', title: '示例方案', industry: '示例行业' }]
  },
  governance: { factStatus: 'pending' }
})

assert.equal(portal.loginBranding.slogan, '从原料，到稳定交付。')
assert.equal(portal.loginBranding.metrics[0].value, '制造协同')
assert.equal(portal.loginBranding.carouselImages[0].hasEmbeddedText, true)
assert.equal(portal.products[0].code, 'DEMO-001')
assert.deepEqual(portal.products[0].applications, ['应用一'])
assert.equal(portal.solutions[0].name, '示例方案')
assert.equal(portal.previewMode, true)
assert.equal(portal.factStatus, 'pending')
assert.ok(Object.isFrozen(portal.products))

const englishPortal = enterprisePortalFromSiteConfig({
  site: { legalName: '示例制造有限公司', defaultLocale: 'zh-CN' },
  content: {
    requestedLocale: 'en-US',
    pages: [{
      slug: 'home',
      blocks: { homepage: { hero: { titleLines: ['Example foods,', 'made reliably.'] } } }
    }]
  }
})
assert.equal(englishPortal.loginBranding.slogan, 'Example foods, made reliably.')

const legacyLunduPortal = enterprisePortalFromSiteConfig({
  site: { legalName: '伦度机电有限公司' },
  content: {
    pages: [{
      slug: 'home',
      blocks: {
        homepage: {
          carouselImages: [
            { url: '/enterprise-assets/site/ratio/hero-wide.png', title: '设备与产品' },
            { url: '/enterprise-assets/site/ratio/application-wide.png', title: '应用场景' },
            { url: '/enterprise-assets/site/ratio/factory-wide.png', title: '制造现场' }
          ]
        }
      }
    }]
  }
})
assert.equal(legacyLunduPortal.loginBranding.carouselImages[0].hasEmbeddedText, true)
assert.equal(legacyLunduPortal.loginBranding.carouselImages[1].url, '/enterprise-assets/site/crops/generated-application-flow-wide.jpg')
assert.equal(legacyLunduPortal.loginBranding.carouselImages[2].url, '/enterprise-assets/site/crops/generated-factory-floor-wide.jpg')

const merged = mergeEnterpriseProfileIntoSystemConfig({
  title: '内部系统标题',
  themeColor: '#409EFF',
  notifications: false,
  loginBranding: {
    companyName: '历史重复名称',
    logo: '/legacy-logo.png',
    description: '历史重复企业介绍',
    authTitle: '登录内部系统',
    secondaryActionUrl: '/legacy-site',
    carouselImages: [{ url: '/hero.jpg', hasEmbeddedText: true }]
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

const mergedSlides = mergeEnterpriseProfileIntoSystemConfig({
  loginBranding: { carouselImages: [{ url: '/hero.jpg', hasEmbeddedText: true }] }
}, {
  ...profile,
  portal: {
    ...profile.portal,
    loginBranding: {
      ...profile.portal.loginBranding,
      carouselImages: [{ url: '/hero.jpg', title: '旧站点标题', subtitle: '旧站点副标题' }]
    }
  }
})
assert.equal(mergedSlides.loginBranding.carouselImages[0].hasEmbeddedText, true)

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
  getRequestHost: () => 'factory.example.test',
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

const domainWarnings = []
const mismatchedDomainService = createEnterpriseProfileService({
  enterpriseConfig: DEFAULT_ENTERPRISE_CONFIG,
  getRequestHost: () => 'localhost',
  httpClient: {
    async requestJson() {
      return { data: sitePayload }
    }
  },
  onWarning: (event) => domainWarnings.push(event)
})
const mismatchedDomainProfile = await mismatchedDomainService.readProfile()
assert.equal(mismatchedDomainProfile.source, 'deployment-fallback')
assert.equal(mismatchedDomainProfile.displayName, DEFAULT_ENTERPRISE_CONFIG.enterprise.displayName)
assert.equal(domainWarnings[0].code, 'profile-domain-mismatch')

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
