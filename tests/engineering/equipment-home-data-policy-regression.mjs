// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  EQUIPMENT_REALTIME_TABLES,
  buildEquipmentRowSignature,
  buildEquipmentRowsSignature,
  isEquipmentRealtimePayloadRelevant,
  normalizeEquipmentRows,
  parseEquipmentRealtimePayload,
  shouldReplaceEquipmentRows,
  toEquipmentSignatureValue
} from '../../eiscore-equipment/src/domain/equipment-home-data-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')

assert.deepEqual(EQUIPMENT_REALTIME_TABLES, [
  'equipment_assets',
  'equipment_checks',
  'equipment_issues',
  'equipment_work_orders',
  'equipment_maintenance_plans',
  'equipment_standards'
])
assert.equal(Object.isFrozen(EQUIPMENT_REALTIME_TABLES), true)
assert.equal(toEquipmentSignatureValue(null), '')
assert.equal(toEquipmentSignatureValue(undefined), '')
assert.equal(toEquipmentSignatureValue(''), '')
assert.equal(toEquipmentSignatureValue(12), '12')
assert.equal(toEquipmentSignatureValue(false), 'false')
assert.equal(toEquipmentSignatureValue(new Date('2026-06-02T00:00:00.000Z')), '2026-06-02T00:00:00.000Z')
assert.equal(toEquipmentSignatureValue({ b: 2, a: 1 }), '{"b":2,"a":1}')

const firstRow = { id: 'a1', status: 'active', nested: { b: 2, a: 1 } }
const reorderedRow = { nested: { b: 2, a: 1 }, status: 'active', id: 'a1' }
const reorderedNestedRow = { id: 'a1', status: 'active', nested: { a: 1, b: 2 } }
assert.equal(buildEquipmentRowSignature(firstRow), buildEquipmentRowSignature(reorderedRow))
assert.notEqual(buildEquipmentRowSignature(firstRow), buildEquipmentRowSignature(reorderedNestedRow))
assert.equal(buildEquipmentRowSignature(null), '')
assert.equal(buildEquipmentRowSignature('row'), 'row')

const currentRows = [firstRow, { id: 'a2', score: 80 }]
const equivalentRows = [reorderedRow, { score: 80, id: 'a2' }]
assert.equal(buildEquipmentRowsSignature(currentRows), buildEquipmentRowsSignature(equivalentRows))
assert.equal(shouldReplaceEquipmentRows(currentRows, equivalentRows), false)
assert.equal(shouldReplaceEquipmentRows(currentRows, equivalentRows.slice().reverse()), true)
assert.equal(shouldReplaceEquipmentRows(currentRows, [{ ...reorderedRow, status: 'deleted' }]), true)
assert.equal(shouldReplaceEquipmentRows([], null), false)
assert.strictEqual(normalizeEquipmentRows(currentRows), currentRows)
assert.deepEqual(normalizeEquipmentRows(null), [])
assert.deepEqual(normalizeEquipmentRows({ id: 'not-an-array' }), [])

const stringPayload = { payload: '{"schema":"public","table":"equipment_assets"}' }
assert.deepEqual(parseEquipmentRealtimePayload(stringPayload), {
  schema: 'public', table: 'equipment_assets'
})
const objectPayload = { payload: { schema: 'public', table: 'equipment_checks' } }
assert.strictEqual(parseEquipmentRealtimePayload(objectPayload), objectPayload.payload)
const directPayload = { schema: 'public', table: 'equipment_issues' }
assert.strictEqual(parseEquipmentRealtimePayload(directPayload), directPayload)
assert.equal(parseEquipmentRealtimePayload({ payload: '{invalid' }), null)
assert.equal(parseEquipmentRealtimePayload({ payload: '' }), null)
assert.equal(parseEquipmentRealtimePayload({ schema: 'public' }), null)
assert.equal(parseEquipmentRealtimePayload(null), null)
assert.equal(parseEquipmentRealtimePayload({ payload: 'true' }), true)

for (const table of EQUIPMENT_REALTIME_TABLES) {
  assert.equal(isEquipmentRealtimePayloadRelevant({ schema: 'public', table }), true)
}
assert.equal(isEquipmentRealtimePayloadRelevant({ schema: 'private', table: 'equipment_assets' }), false)
assert.equal(isEquipmentRealtimePayloadRelevant({ schema: 'public', table: 'equipment_unknown' }), false)
assert.equal(isEquipmentRealtimePayloadRelevant(true), false)
assert.equal(isEquipmentRealtimePayloadRelevant(null), false)

const moduleSource = readFileSync(resolve(
  repoRoot,
  'eiscore-equipment/src/domain/equipment-home-data-policy.js'
), 'utf8')
for (const forbidden of [
  "from 'vue'", 'element-plus', 'request({', 'axios', 'fetch(', 'window.', 'document.',
  'localStorage', 'sessionStorage', 'Date.now', 'new Date()', 'Math.random'
]) {
  assert.equal(moduleSource.includes(forbidden), false, `equipment data policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-equipment/src/views/EquipmentHome.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/equipment-home-data-policy\.js['"]/)
for (const requiredCall of [
  'normalizeEquipmentRows(rows)',
  'shouldReplaceEquipmentRows(target.value, nextRows)',
  'parseEquipmentRealtimePayload(event)',
  'isEquipmentRealtimePayloadRelevant(payload)'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `EquipmentHome lost ${requiredCall}`)
}
for (const removedDefinition of [
  'const EQUIPMENT_REALTIME_TABLES =', 'const signatureValue =', 'const rowSignature =',
  'const rowsSignature =', 'const parseRealtimePayload ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `EquipmentHome reintroduced ${removedDefinition}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 1820)

console.log('PASS: EquipmentHome data policy preserves row equality and Realtime payload qualification')
