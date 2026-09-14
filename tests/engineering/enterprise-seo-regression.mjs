// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { buildEnterpriseSeoHead } from '../../packages/eiscore-platform/src/enterprise-seo.mjs'
import { enterpriseProfileFromSiteConfig } from '../../packages/eiscore-platform/src/enterprise-profile.mjs'

const payload = {
  site: {
    siteKey: 'primary',
    legalName: '示例食品有限公司',
    brandName: '示例食品',
    domain: 'preview.localhost',
    defaultLocale: 'zh-CN',
    enabledLocales: ['zh-CN', 'en-US'],
    settings: { publicPath: '/login' },
    seo: {},
    status: 'draft'
  },
  content: {
    requestedLocale: 'en-US',
    pages: [{ slug: 'home', blocks: { homepage: { hero: { titleLines: ['Example Foods'], summary: 'English overview' } } } }],
    products: [{ productCode: 'EX-1', slug: 'fruit', name: 'Fruit products', summary: 'A product direction' }],
    faq: [{ id: 'faq-1', title: 'Can I order directly?', content: 'Contact an authorized representative.' }],
    seo: [{
      locale: 'en-US',
      path: '/login',
      title: 'Example Foods | Fruit Products',
      description: 'Fruit product directions.',
      canonical: '',
      robots: 'index,follow',
      keywords: ['fruit products'],
      structuredData: { '@type': 'WebPage', name: 'Example Foods' }
    }]
  }
}

const profile = enterpriseProfileFromSiteConfig(payload)
const head = buildEnterpriseSeoHead(profile, { pathname: '/login' })
assert.equal(profile.locale, 'en-US')
assert.equal(profile.seo.title, 'Example Foods | Fruit Products')
assert.equal(head.lang, 'en-US')
assert.equal(head.robots, 'noindex,nofollow')
assert.equal(head.canonical, '')
assert.deepEqual(head.alternates, [])
assert.deepEqual(head.keywords, ['fruit products'])
assert.ok(head.structuredData['@graph'].some((item) => item['@type'] === 'Organization'))
assert.ok(head.structuredData['@graph'].some((item) => item['@type'] === 'Product'))
assert.ok(head.structuredData['@graph'].some((item) => item['@type'] === 'FAQPage'))

const published = enterpriseProfileFromSiteConfig({
  ...payload,
  site: { ...payload.site, domain: 'www.example.com', status: 'published' }
})
const publishedHead = buildEnterpriseSeoHead(published, { pathname: '/login' })
assert.equal(publishedHead.canonical, 'https://www.example.com/login')
assert.equal(publishedHead.robots, 'index,follow')
assert.equal(publishedHead.alternates.length, 2)

console.log('enterprise-seo-regression: PASS')
