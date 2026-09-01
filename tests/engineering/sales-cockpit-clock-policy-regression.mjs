// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  decrementSalesCockpitRefreshCountdown,
  formatSalesCockpitClock
} from '../../eiscore-sales/src/domain/sales-cockpit-clock-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const timestamp = new Date(2026, 5, 2, 8, 9, 10)
assert.equal(formatSalesCockpitClock(timestamp), timestamp.toLocaleString('zh-CN', { hour12: false }))
assert.equal(formatSalesCockpitClock(new Date('invalid')), '')
assert.equal(formatSalesCockpitClock(null), '')
assert.equal(decrementSalesCockpitRefreshCountdown(60), 59)
assert.equal(decrementSalesCockpitRefreshCountdown(0), 0)
assert.equal(decrementSalesCockpitRefreshCountdown(-1), 0)

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/domain/sales-cockpit-clock-policy.js'), 'utf8')
for (const forbidden of ["from 'vue'", 'element-plus', 'request(', 'axios', 'fetch(', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'Math.random', 'new Date()']) {
  assert.equal(moduleSource.includes(forbidden), false, 'sales cockpit clock policy gained runtime dependency: ' + forbidden)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/views/SalesCockpit.vue'), 'utf8')
assert.ok(pageSource.includes('@/domain/sales-cockpit-clock-policy.js'))
assert.ok(pageSource.includes('formatSalesCockpitClock(now)'))
assert.ok(pageSource.includes('decrementSalesCockpitRefreshCountdown(refreshCountdown.value)'))
assert.ok(pageSource.includes('setInterval(updateClock, 1000)'))

console.log('PASS: SalesCockpit clock policy preserves locale formatting and countdown behavior')
