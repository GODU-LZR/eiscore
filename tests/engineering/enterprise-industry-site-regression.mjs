// SPDX-License-Identifier: AGPL-3.0-or-later
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_ENTERPRISE_PROFILE,
  enterpriseProfileFromSiteConfig,
  mergeEnterpriseProfileIntoSystemConfig
} from '../../packages/eiscore-platform/src/enterprise-profile.mjs'

const payload = {
  site: {
    siteKey: 'industry-fixture',
    template: 'industry-ink-v1',
    legalName: '示例产业科技',
    brandName: '示例科技',
    domain: 'industry.example.test',
    theme: { primaryColor: '#176661' },
    settings: { publicPath: '/login' },
    trademark: { asset: '/enterprise-assets/site/brand.png' },
    contact: { email: 'contact@example.test' },
    status: 'published',
    defaultLocale: 'zh-CN',
    enabledLocales: ['zh-CN']
  },
  content: {
    requestedLocale: 'zh-CN',
    pages: [{
      slug: 'home',
      blocks: {
        homepage: {
          hero: {
            titleLines: ['产业应用与持续服务'],
            summary: '面向企业与园区提供技术应用和运营服务。',
            image: { src: '/enterprise-assets/site/landscape.webp', alt: '山水画卷' }
          },
          headerLoginText: '企业登录',
          authTitle: '登录企业工作区',
          businessChain: [{ title: '需求诊断', description: '确认应用场景与交付边界。' }],
          capabilities: [{ title: '技术平台', description: '管理业务数据与行业应用。' }]
        }
      }
    }],
    products: [{
      slug: 'platform', name: '企业平台', category: '技术底座',
      summary: '协同处理业务数据。', imageUrls: ['/enterprise-assets/site/platform.webp']
    }],
    solutions: [{ slug: 'park', name: '园区服务', summary: '企业服务与项目协作。' }],
    seo: [{ path: '/login', locale: 'zh-CN', title: '示例科技｜产业应用与服务' }]
  }
}

const profile = enterpriseProfileFromSiteConfig(payload)
assert.equal(profile.template, 'industry-ink-v1')
assert.equal(profile.displayName, '示例科技')
assert.equal(profile.logoUrl, '/enterprise-assets/site/brand.png')
assert.equal(profile.seo.title, '示例科技｜产业应用与服务')
assert.equal(profile.contact.email, 'contact@example.test')
assert.equal(profile.portal.loginBranding.slogan, '产业应用与持续服务')
assert.equal(profile.portal.loginBranding.backgroundImage, '/enterprise-assets/site/landscape.webp')
assert.equal(profile.portal.products[0].imageUrl, '/enterprise-assets/site/platform.webp')
assert.equal(profile.portal.solutions[0].id, 'park')
assert.equal(profile.portal.loginBranding.businessChain[0].title, '需求诊断')
assert.equal(profile.portal.loginBranding.capabilities[0].title, '技术平台')
const branding = mergeEnterpriseProfileIntoSystemConfig({}, profile).loginBranding
assert.equal(branding.companyName, profile.displayName)
assert.equal(branding.headerLoginText, '企业登录')
assert.equal(branding.authTitle, '登录企业工作区')

const alias = structuredClone(payload)
delete alias.site.template
alias.site.templateKey = 'industry-ink-v1'
assert.equal(enterpriseProfileFromSiteConfig(alias).template, 'industry-ink-v1')
const existing = structuredClone(payload)
delete existing.site.template
assert.equal(enterpriseProfileFromSiteConfig(existing).template, '')
existing.site.template = 'manufacturer-editorial-v1'
assert.notEqual(enterpriseProfileFromSiteConfig(existing).template, 'industry-ink-v1')
assert.equal(enterpriseProfileFromSiteConfig({}).template, '')
assert.equal(DEFAULT_ENTERPRISE_PROFILE.template, '')

const source = readFileSync(resolve(import.meta.dirname, '../../eiscore-base/src/views/LoginView.vue'), 'utf8')
assert.match(source, /<EnterpriseIndustrySite\s+v-if="isIndustrySite"/)
assert.match(source, /:profile="systemStore\.enterpriseProfile"/)
assert.match(source, /:branding="branding"/)
assert.match(source, /@login="focusLogin"/)
assert.match(source, /<template v-else-if="portalReady">/)
assert.match(source, /<template v-if="portalReady && !isIndustrySite">/)
assert.match(source, /<\/template>\s*<Transition name="auth-dialog">/)
assert.match(source, /!isServicePage\.value && systemStore\.enterpriseProfile\?\.template === 'industry-ink-v1'/)
assert.match(source, /await systemStore\.loadConfig\([\s\S]*?if \(!isIndustrySite\.value\)\s*\{\s*await readPublicServiceContent/)
assert.match(source, /portalReady\.value = true[\s\S]*?eiscore:initial-content-ready/)
assert.match(source, /route\.query\.login === '1'/)

console.log('enterprise-industry-site-regression: PASS')
