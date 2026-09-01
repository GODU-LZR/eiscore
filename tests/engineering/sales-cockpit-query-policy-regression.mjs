// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildSalesCockpitQueryRequests } from '../../eiscore-sales/src/domain/sales-cockpit-query-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const expected = [
  { url: '/sales_customers?select=*&status=neq.deleted&order=created_at.desc&limit=500', method: 'get' },
  { url: '/sales_orders?select=*&status=neq.deleted&order_status=neq.%E5%B7%B2%E5%8F%96%E6%B6%88&order=order_date.desc&limit=500', method: 'get' },
  { url: '/sales_opportunities?select=*&status=neq.deleted&order=expected_close_date.asc&limit=500', method: 'get' },
  { url: '/sales_payments?select=*&status=neq.deleted&order=payment_date.desc&limit=500', method: 'get' },
  { url: '/sales_follow_ups?select=*&status=neq.deleted&order=follow_date.desc&limit=500', method: 'get' }
]
assert.deepEqual(buildSalesCockpitQueryRequests(), expected)
assert.notStrictEqual(buildSalesCockpitQueryRequests(), buildSalesCockpitQueryRequests())
assert.notStrictEqual(buildSalesCockpitQueryRequests()[0], buildSalesCockpitQueryRequests()[0])
const source = readFileSync(resolve(repoRoot, 'eiscore-sales/src/domain/sales-cockpit-query-policy.js'), 'utf8')
for (const forbidden of ["from 'vue'", 'element-plus', 'request(', 'axios', 'fetch(', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'new Date', 'Math.random']) {
  assert.equal(source.includes(forbidden), false, 'sales cockpit query policy gained runtime dependency: ' + forbidden)
}
const page = readFileSync(resolve(repoRoot, 'eiscore-sales/src/views/SalesCockpit.vue'), 'utf8')
assert.match(page, /from ['"]@\/domain\/sales-cockpit-query-policy\.js['"]/)
assert.equal(page.includes('buildSalesCockpitQueryRequests().map((config) => request(config))'), true)
for (const removed of ["request({ url: '/sales_customers", "request({ url: '/sales_orders", "request({ url: '/sales_opportunities", "request({ url: '/sales_payments", "request({ url: '/sales_follow_ups"]) {
  assert.equal(page.includes(removed), false, 'SalesCockpit retained inline query: ' + removed)
}
console.log('PASS: SalesCockpit query policy preserves five request contracts and ordering')
