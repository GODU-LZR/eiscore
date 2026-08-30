// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const pdaEntry = readFileSync(resolve(repoRoot, 'eiscore-mobile/src/views/pda/PdaEntry.vue'), 'utf8')

const recentRequest = pdaEntry.match(/\/api\/inventory_checks\?select=([^'"]+)/)?.[1] || ''

assert.ok(recentRequest, 'PDA page should request recent inventory checks')
assert.match(recentRequest, /check_no/, 'recent check list should select check_no')
assert.match(recentRequest, /warehouse_id/, 'recent check list should select warehouse_id')
assert.doesNotMatch(recentRequest, /warehouse_code/, 'inventory_checks does not expose warehouse_code')
assert.doesNotMatch(recentRequest, /location_code/, 'inventory_checks does not expose location_code')
assert.match(pdaEntry, /isCompletedCheck/, 'PDA page should normalize check status display')

console.log('PASS: mobile PDA regression')
