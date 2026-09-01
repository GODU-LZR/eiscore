// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getSalesCockpitFullscreenAction } from '../../eiscore-sales/src/domain/sales-cockpit-fullscreen-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
assert.equal(getSalesCockpitFullscreenAction(false), 'enter')
assert.equal(getSalesCockpitFullscreenAction(true), 'exit')
assert.equal(getSalesCockpitFullscreenAction(0), 'enter')
assert.equal(getSalesCockpitFullscreenAction(1), 'exit')

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/domain/sales-cockpit-fullscreen-policy.js'), 'utf8')
for (const forbidden of ["from 'vue'", 'element-plus', 'request(', 'axios', 'fetch(', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'Math.random', 'new Date']) {
  assert.equal(moduleSource.includes(forbidden), false, 'sales cockpit fullscreen policy gained runtime dependency: ' + forbidden)
}
const pageSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/views/SalesCockpit.vue'), 'utf8')
assert.ok(pageSource.includes('@/domain/sales-cockpit-fullscreen-policy.js'))
assert.ok(pageSource.includes('getSalesCockpitFullscreenAction(document.fullscreenElement)'))
assert.ok(pageSource.includes("action === 'enter'"))
assert.ok(pageSource.includes('target.requestFullscreen?.()'))
assert.ok(pageSource.includes('document.exitFullscreen?.()'))

console.log('PASS: SalesCockpit fullscreen policy preserves enter/exit decision boundary')
