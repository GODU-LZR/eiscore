// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const readSource = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const applications = [
  'apps',
  'equipment',
  'hr',
  'materials',
  'production',
  'purchase',
  'quality',
  'sales'
]

for (const application of applications) {
  const path = `eiscore-${application}/src/components/eis-data-grid-v2/composables/useGridCore.js`
  const source = readSource(path)
  assert.match(source, /createGridLocalLayout\s*}\s*from\s*['"]@shared\/eis-grid-local-layout['"]/, path)
  assert.match(source, /createGridLocalLayout\(\{/, path)
  assert.doesNotMatch(source, /\b(?:window\.)?localStorage\b|safeReadLocalLayout|safeWriteLocalLayout/, path)
}

const hrSource = readSource('eiscore-hr/src/components/eis-data-grid-v2/composables/useGridCore.js')
assert.match(hrSource, /scheduleApply:\s*nextTick/)
assert.match(hrSource, /resolveRowKey:\s*\(rowData\)/)
assert.match(hrSource, /rowData\.employee_no/)
assert.doesNotMatch(hrSource, /rowData\.doc_no|rowData\.order_no|rowData\.work_order_no/)

const sharedSource = readSource('shared/eis-grid-local-layout.js')
assert.match(sharedSource, /createSafeStorage\s*}\s*from\s*['"]\.\.\/packages\/eiscore-platform\/src\/safe-storage\.mjs['"]/)
assert.match(sharedSource, /safeStorage\.getJson\(layoutStorageKey\.value,\s*{}\)/)
assert.match(sharedSource, /safeStorage\.setJson\(layoutStorageKey\.value,/)
assert.match(sharedSource, /version:\s*1/)
assert.match(sharedSource, /columns:\s*localLayoutState\.columns/)
assert.match(sharedSource, /rows:\s*localLayoutState\.rows/)
assert.match(sharedSource, /typeof resolveRowKey === ['"]function['"]/)
assert.match(sharedSource, /scheduleApply\(\(\) =>/)
assert.doesNotMatch(sharedSource, /window\.localStorage|\.getItem\(|\.setItem\(/)

console.log('PASS: all eight Grid cores share safe local layout with HR row-key and nextTick compatibility')
