// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { normalizeSalesCockpitData } from '../../eiscore-sales/src/domain/sales-cockpit-data-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const input = [[{ id: 'c1' }], null, undefined, [{ id: 'p1' }], 'invalid']
const result = normalizeSalesCockpitData(input)
assert.deepEqual(result, { customers: [{ id: 'c1' }], orders: [], opportunities: [], payments: [{ id: 'p1' }], followUps: [] })
assert.strictEqual(result.customers, input[0])
assert.deepEqual(normalizeSalesCockpitData(), { customers: [], orders: [], opportunities: [], payments: [], followUps: [] })
assert.deepEqual(normalizeSalesCockpitData([[1], [2], [3], [4], [5], [6]]), { customers: [1], orders: [2], opportunities: [3], payments: [4], followUps: [5] })

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/domain/sales-cockpit-data-policy.js'), 'utf8')
for (const forbidden of ["from 'vue'", 'element-plus', 'request(', 'axios', 'fetch(', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'Math.random', 'new Date']) {
  assert.equal(moduleSource.includes(forbidden), false, 'sales cockpit data policy gained runtime dependency: ' + forbidden)
}
const pageSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/views/SalesCockpit.vue'), 'utf8')
assert.ok(pageSource.includes('@/domain/sales-cockpit-data-policy.js'))
assert.ok(pageSource.includes('normalizeSalesCockpitData([customerRows, orderRows, opportunityRows, paymentRows, followRows])'))
assert.ok(pageSource.includes('customers.value = normalized.customers'))
assert.ok(pageSource.includes('followUps.value = normalized.followUps'))

console.log('PASS: SalesCockpit data policy preserves five response normalization contracts')
