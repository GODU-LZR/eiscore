// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import {
  createEnterpriseProfileService,
  mergeEnterpriseProfileIntoSystemConfig,
  stripEnterpriseProfileFromSystemConfig
} from '../../packages/eiscore-platform/src/enterprise-profile.mjs'
import { DEFAULT_ENTERPRISE_CONFIG } from '../../packages/eiscore-platform/src/enterprise-config.mjs'

const require = createRequire(import.meta.url)
const { createCompanySiteHandlers } = require('../../realtime/company-site.js')

const state = {
  site_key: 'primary',
  legal_name: '变更前企业',
  brand_name: '变更前品牌',
  brand_short_name: '旧品牌',
  factory_name: '旧工厂',
  domain: 'old.example.test',
  template_key: 'manufacturer-editorial-v1',
  default_locale: 'zh-CN',
  enabled_locales: ['zh-CN'],
  theme: { primaryColor: '#409EFF' },
  contact: {},
  social_links: [],
  trademark: { asset: '/brand.svg' },
  settings: { publicPath: '/company' },
  seo: {},
  status: 'published',
  published_version: 1,
  published_at: '2026-09-01T00:00:00.000Z',
  published_by: 'previous-admin'
}

const parseJson = (value) => typeof value === 'string' ? JSON.parse(value) : value
const query = async (sql, params = []) => {
  const statement = String(sql)
  if (statement.includes('UPDATE company_site.site_config') && statement.includes('published_version = CASE')) {
    state.status = params[0]
    if (state.status === 'published') state.published_version += 1
    state.published_at = state.status === 'published' ? '2026-09-02T10:00:00.000Z' : null
    state.published_by = state.status === 'published' ? params[2] : ''
    return { rows: [{ ...state }] }
  }
  if (statement.includes('UPDATE company_site.site_config')) {
    assert.deepEqual(params.slice(0, 4), ['primary', '合并后制造有限公司', '合并后品牌', 'merged.example.test'])
    Object.assign(state, {
      legal_name: params[1],
      brand_name: params[2],
      domain: params[3],
      enabled_locales: parseJson(params[4]),
      theme: parseJson(params[5]),
      contact: parseJson(params[6]),
      trademark: parseJson(params[7]),
      seo: parseJson(params[8]),
      status: 'draft',
      published_at: null,
      published_by: ''
    })
    return { rows: [{ ...state }] }
  }
  if (statement.includes('INSERT INTO company_site.audit_events')) return { rows: [] }
  if (statement.includes('FROM company_site.site_config c')) {
    return { rows: state.status === 'published' ? [{ ...state }] : [] }
  }
  if (statement.includes('FROM company_site.site_locales')) return { rows: [] }
  if (/FROM company_site\.(content_pages|products|solutions|cases|knowledge_documents)/.test(statement)) return { rows: [] }
  throw new Error(`Unexpected lifecycle query: ${statement}`)
}

const readJsonBody = async (req) => req.body || {}
const sendJson = (res, status, payload) => Object.assign(res, { status, payload })
const sendText = (res, status, payload) => Object.assign(res, { status, payload })
const handlers = createCompanySiteHandlers({
  query,
  readJsonBody,
  sendJson,
  sendText,
  siteKey: 'primary',
  now: () => new Date('2026-09-02T10:00:00.000Z')
})
const request = (body = {}, url = '/') => ({
  body,
  url,
  headers: { host: 'merged.example.test' },
  socket: { remoteAddress: '127.0.0.1' }
})

const updateResponse = {}
await handlers.handleUpdateAdminSiteConfig(request({
  legalName: '合并后制造有限公司',
  brandName: '合并后品牌',
  domain: 'merged.example.test',
  enabledLocales: ['zh-CN', 'en-US'],
  theme: { primaryColor: '#176B57' },
  contact: { phone: '400-123-4567', email: 'sales@merged.example.test' },
  trademark: { asset: '/assets/merged-logo.svg' },
  seo: { title: '合并后品牌官网', description: '唯一企业公开档案' }
}), updateResponse, { id: 'admin-1' })
assert.equal(updateResponse.status, 200)
assert.equal(updateResponse.payload.site.status, 'draft')

const publishResponse = {}
await handlers.handlePublishContent(request({
  objectType: 'site_config',
  id: 'primary',
  status: 'published'
}), publishResponse, { id: 'admin-1' })
assert.equal(publishResponse.status, 200)
assert.equal(publishResponse.payload.item.published_version, 2)

const publicResponse = {}
await handlers.handleGetPublicSiteConfig(request({}, '/company-site/public/site-config'), publicResponse)
assert.equal(publicResponse.status, 200)
assert.equal(publicResponse.payload.site.legalName, '合并后制造有限公司')

const service = createEnterpriseProfileService({
  enterpriseConfig: DEFAULT_ENTERPRISE_CONFIG,
  httpClient: {
    async requestJson(path, options) {
      assert.equal(path, '/company-site/public/site-config')
      assert.deepEqual(options, { service: 'agent' })
      return { data: publicResponse.payload }
    }
  }
})
const profile = await service.readProfile({ required: true })
assert.equal(profile.source, 'published-site')
assert.equal(profile.displayName, '合并后品牌')
assert.equal(profile.legalName, '合并后制造有限公司')
assert.equal(profile.publicSiteUrl, 'https://merged.example.test/company/')
assert.equal(profile.logoUrl, '/assets/merged-logo.svg')
assert.equal(profile.contact.email, 'sales@merged.example.test')
assert.equal(profile.seo.title, '合并后品牌官网')
assert.equal(profile.publishedVersion, 2)

const merged = mergeEnterpriseProfileIntoSystemConfig({
  title: 'EISCore 内部系统',
  loginBranding: { companyName: '不得覆盖公开档案', authTitle: '账号登录' }
}, profile)
assert.equal(merged.loginBranding.companyName, '合并后品牌')
assert.equal(merged.loginBranding.authTitle, '账号登录')
assert.equal(Object.hasOwn(stripEnterpriseProfileFromSystemConfig(merged).loginBranding, 'companyName'), false)

console.log('enterprise-profile-lifecycle-regression: PASS')
