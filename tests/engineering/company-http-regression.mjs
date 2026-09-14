// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { COMPANY_HTTP_ROUTE_MANIFEST, createCompanyHttpModule } = require('../../realtime/company-http.js')
const { createHttpRequestHandler } = require('../../realtime/http-router.js')

assert.ok(Object.isFrozen(COMPANY_HTTP_ROUTE_MANIFEST))
assert.ok(COMPANY_HTTP_ROUTE_MANIFEST.every(Object.isFrozen))
assert.equal(COMPANY_HTTP_ROUTE_MANIFEST.filter((route) => route.path === '/company-site/public/site-config').length, 1)
assert.equal(COMPANY_HTTP_ROUTE_MANIFEST.find((route) => route.handler === 'company.handleUpdateAdminSiteConfig')?.authorize, 'companySiteManage')
assert.equal(COMPANY_HTTP_ROUTE_MANIFEST.find((route) => route.handler === 'company.handleApproveDraft')?.authorize, 'companySalesApproval')

const calls = []
const siteHandlers = new Proxy({}, {
  get: (_target, name) => (...args) => calls.push({ target: `site.${String(name)}`, args })
})
const salesHandlers = new Proxy({}, {
  get: (_target, name) => (...args) => calls.push({ target: `sales.${String(name)}`, args })
})
const sent = []
const getRequestPath = (req) => String(req.url).replace(/^\/agent/, '').split('?')[0]
const module = createCompanyHttpModule({
  companySiteHandlers: siteHandlers,
  companySalesHandlers: salesHandlers,
  getRequestPath,
  getBearerFromAuthHeader: (req) => req.headers?.authorization?.replace(/^Bearer\s+/i, '') || '',
  verifyToken: (token) => token === 'manager-token' ? { sub: 'u1', app_role: 'company_site_admin' } : null,
  asUser: (payload, token) => ({ id: payload.sub, role: payload.app_role, permissions: [], token }),
  readJsonBody: async (req) => req.body || {},
  sendJson: (res, status, payload) => {
    res.status = status
    res.payload = payload
  },
  env: {}
})

const requestHandler = createHttpRequestHandler({
  routes: module.routes,
  getRequestPath,
  setCorsHeaders: () => {},
  authorizers: module.authorizers,
  handlers: { company: module.handlers }
})
const response = () => ({ status: 0, writeHead(status) { this.status = status }, end() {} })

await requestHandler({ method: 'GET', url: '/agent/company-site/public/pages/about', headers: {} }, response())
assert.equal(calls.at(-1).target, 'site.handleGetPublicPage')
assert.equal(calls.at(-1).args[2], 'about')

const denied = response()
await requestHandler({ method: 'PATCH', url: '/agent/company-site/admin/site-config', headers: {} }, denied)
assert.equal(denied.status, 401)

await requestHandler({ method: 'PATCH', url: '/agent/company-site/admin/site-config', headers: { authorization: 'Bearer manager-token' } }, response())
assert.equal(calls.at(-1).target, 'site.handleUpdateAdminSiteConfig')
assert.equal(calls.at(-1).args[2].id, 'u1')

await requestHandler({ method: 'GET', url: '/agent/company-site/admin/keywords', headers: { authorization: 'Bearer manager-token' } }, response())
assert.equal(calls.at(-1).target, 'site.handleListAdminContent')
assert.equal(calls.at(-1).args[2], 'keywords')

await requestHandler({ method: 'PATCH', url: '/agent/company-site/admin/geo/snapshots/geo-1/review', headers: { authorization: 'Bearer manager-token' } }, response())
assert.equal(calls.at(-1).target, 'site.handleReviewGeoSnapshot')
assert.equal(calls.at(-1).args[2], 'geo-1')

await requestHandler({ method: 'POST', url: '/agent/sales/drafts/quote/q-1/approval', headers: { authorization: 'Bearer manager-token' } }, response())
assert.equal(calls.at(-1).target, 'sales.handleApproveDraft')
assert.deepEqual(calls.at(-1).args.slice(2, 4), ['quote', 'q-1'])

console.log(`PASS: company HTTP module routes, parameters and authorization (${COMPANY_HTTP_ROUTE_MANIFEST.length} routes)`)
