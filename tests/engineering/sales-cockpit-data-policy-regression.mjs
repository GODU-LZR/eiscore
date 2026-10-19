// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  mergeSalesCockpitData,
  normalizeSalesCockpitData
} from '../../eiscore-sales/src/domain/sales-cockpit-data-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const input = [[{ id: 'c1' }], null, undefined, [{ id: 'p1' }], 'invalid']
const result = normalizeSalesCockpitData(input)
assert.deepEqual(result, { customers: [{ id: 'c1' }], orders: [], opportunities: [], payments: [{ id: 'p1' }], followUps: [] })
assert.strictEqual(result.customers, input[0])
assert.deepEqual(normalizeSalesCockpitData(), { customers: [], orders: [], opportunities: [], payments: [], followUps: [] })
assert.deepEqual(normalizeSalesCockpitData([[1], [2], [3], [4], [5], [6]]), { customers: [1], orders: [2], opportunities: [3], payments: [4], followUps: [5] })

const previous = [[{ id: 'old-customer' }], [{ id: 'old-order' }], [{ id: 'old-opportunity' }], [{ id: 'old-payment' }], [{ id: 'old-follow-up' }]]
const settled = [
  { status: 'fulfilled', value: [{ id: 'new-customer' }] },
  { status: 'rejected', reason: new Error('timeout') },
  { status: 'fulfilled', value: [] },
  { status: 'rejected', reason: new Error('network') },
  { status: 'fulfilled', value: [{ id: 'new-follow-up' }] }
]
assert.deepEqual(mergeSalesCockpitData(previous, settled), {
  customers: [{ id: 'new-customer' }],
  orders: [{ id: 'old-order' }],
  opportunities: [],
  payments: [{ id: 'old-payment' }],
  followUps: [{ id: 'new-follow-up' }],
  loadedSources: [true, false, true, false, true],
  updated: true,
  state: 'partial'
})
assert.deepEqual(mergeSalesCockpitData(previous, settled.map(() => ({ status: 'rejected' }))), {
  customers: previous[0],
  orders: previous[1],
  opportunities: previous[2],
  payments: previous[3],
  followUps: previous[4],
  loadedSources: [false, false, false, false, false],
  updated: false,
  state: 'error'
})
assert.equal(mergeSalesCockpitData(previous, previous.map((value) => ({ status: 'fulfilled', value }))).state, 'ready')
assert.equal(mergeSalesCockpitData([], settled.map(() => ({ status: 'rejected' }))).state, 'error')
assert.equal(mergeSalesCockpitData(previous, settled.map(() => ({ status: 'fulfilled', value: null }))).state, 'error')

const failures = settled.map(() => ({ status: 'rejected' }))
const firstLoad = mergeSalesCockpitData([], failures)
assert.equal(firstLoad.loadedSources.some(Boolean), false, 'failed first load must not establish any data baseline')
const partialLoad = mergeSalesCockpitData([], settled, firstLoad.loadedSources)
assert.equal(partialLoad.loadedSources.every(Boolean), false, 'partial first load must not render complete dashboard metrics')
assert.equal(partialLoad.loadedSources[2], true, 'a successful empty result is a known source')
const remainingSources = failures.map((failure, index) => [1, 3].includes(index) ? { status: 'fulfilled', value: [] } : failure)
const completeLoad = mergeSalesCockpitData(
  [partialLoad.customers, partialLoad.orders, partialLoad.opportunities, partialLoad.payments, partialLoad.followUps],
  remainingSources,
  partialLoad.loadedSources
)
assert.equal(completeLoad.loadedSources.every(Boolean), true, 'successful sources accumulate across refreshes, including empty results')
const failedRefresh = mergeSalesCockpitData(
  [completeLoad.customers, completeLoad.orders, completeLoad.opportunities, completeLoad.payments, completeLoad.followUps],
  failures,
  completeLoad.loadedSources
)
assert.equal(failedRefresh.loadedSources.every(Boolean), true, 'failed refresh must preserve an established baseline')
assert.strictEqual(failedRefresh.customers, partialLoad.customers)
assert.equal(failedRefresh.state, 'error')
assert.equal(mergeSalesCockpitData([], failures.map(() => ({ status: 'fulfilled', value: null }))).loadedSources.some(Boolean), false)

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/domain/sales-cockpit-data-policy.js'), 'utf8')
for (const forbidden of ["from 'vue'", 'element-plus', 'request(', 'axios', 'fetch(', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'Math.random', 'new Date']) {
  assert.equal(moduleSource.includes(forbidden), false, 'sales cockpit data policy gained runtime dependency: ' + forbidden)
}
const pageSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/views/SalesCockpit.vue'), 'utf8')
assert.ok(pageSource.includes('@/domain/sales-cockpit-data-policy.js'))
assert.ok(pageSource.includes('mergeSalesCockpitData(previousRows, results, loadedSources.value)'))
assert.ok(pageSource.includes('customers.value = merged.customers'))
assert.ok(pageSource.includes('followUps.value = merged.followUps'))
assert.ok(pageSource.includes('if (loading.value) return'))
assert.ok(pageSource.includes('dataLoadState.value = merged.state'))
assert.ok(pageSource.includes('loadedSources.value = merged.loadedSources'))
assert.ok(pageSource.includes('loadedSources.value.every(Boolean)'))
assert.ok(pageSource.includes('v-if="!hasCompleteBaseline"'))
assert.ok(pageSource.includes("loadedSources[1] ? stats.orderCount : '—'"))
assert.ok(pageSource.includes('if (!hasCompleteBaseline.value) return'))
assert.ok(pageSource.includes("dataLoadState === 'partial' ? '部分数据暂不可用'"))
assert.ok(pageSource.includes("dataLoadState === 'error' ? '数据暂不可用'"))

console.log('PASS: SalesCockpit data policy preserves five response normalization contracts')
