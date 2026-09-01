// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildSalesCockpitFrame } from '../../eiscore-sales/src/domain/sales-cockpit-shell-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
assert.deepEqual(buildSalesCockpitFrame(), { scale: 1, width: 1600, height: 900, designWidth: 1600, designHeight: 900 })
assert.deepEqual(buildSalesCockpitFrame({ clientWidth: 800, clientHeight: 450 }), { scale: 0.5, width: 800, height: 450, designWidth: 1600, designHeight: 900 })
assert.deepEqual(buildSalesCockpitFrame({ clientWidth: 0, clientHeight: 0 }), { scale: 0.2, width: 320, height: 180, designWidth: 1600, designHeight: 900 })

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/domain/sales-cockpit-shell-policy.js'), 'utf8')
for (const forbidden of ["from 'vue'", 'element-plus', 'request(', 'axios', 'fetch(', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'new Date', 'Math.random']) {
  assert.equal(moduleSource.includes(forbidden), false, 'sales cockpit shell policy gained runtime dependency: ' + forbidden)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/views/SalesCockpit.vue'), 'utf8')
assert.ok(pageSource.includes('@/domain/sales-cockpit-shell-policy.js'))
assert.ok(pageSource.includes('buildSalesCockpitFrame()'))
assert.ok(pageSource.includes('buildSalesCockpitFrame({'))
assert.ok(pageSource.includes('window.getComputedStyle(root)'))
assert.ok(pageSource.includes('new ResizeObserver(scheduleCockpitScale)'))

console.log('PASS: SalesCockpit shell policy preserves responsive 16:9 frame projection')
