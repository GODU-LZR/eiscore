// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const pdaEntry = readFileSync(resolve(repoRoot, 'eiscore-mobile/src/views/pda/PdaEntry.vue'), 'utf8')
const warehouseApi = readFileSync(resolve(repoRoot, 'eiscore-mobile/src/api/warehouse.js'), 'utf8')

assert.match(pdaEntry, /fetchRecentChecks\(5\)/, 'PDA page should request five recent inventory checks')
assert.doesNotMatch(pdaEntry, /\bfetch\s*\(|\bgetToken\b/, 'PDA protected reads should use the mobile API boundary')
assert.match(warehouseApi, /select:\s*['"][^'"]*check_no[^'"]*['"]/, 'recent check list should select check_no')
assert.match(warehouseApi, /select:\s*['"][^'"]*warehouse_id[^'"]*['"]/, 'recent check list should select warehouse_id')
assert.doesNotMatch(warehouseApi, /select:\s*['"][^'"]*warehouse_code/, 'inventory_checks does not expose warehouse_code')
assert.doesNotMatch(warehouseApi, /select:\s*['"][^'"]*location_code/, 'inventory_checks does not expose location_code')
assert.match(pdaEntry, /isCompletedCheck/, 'PDA page should normalize check status display')

console.log('PASS: mobile PDA regression')
