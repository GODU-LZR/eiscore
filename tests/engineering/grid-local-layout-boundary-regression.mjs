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

const gridCorePath = 'shared/eis-data-grid-v2/composables/useGridCore.js'
const gridCoreSource = readSource(gridCorePath)
assert.match(gridCoreSource, /createGridLocalLayout\s*}\s*from\s*['"]@shared\/eis-grid-local-layout['"]/, gridCorePath)
assert.match(gridCoreSource, /createGridLocalLayout\(\{/, gridCorePath)
assert.doesNotMatch(gridCoreSource, /\b(?:window\.)?localStorage\b|safeReadLocalLayout|safeWriteLocalLayout/, gridCorePath)

for (const application of applications) {
  const path = `eiscore-${application}/src/components/eis-data-grid-v2/index.vue`
  const source = readSource(path)
  assert.match(
    source,
    /import\s*{\s*useGridCore\s*}\s*from\s*['"]@shared\/eis-data-grid-v2\/composables\/useGridCore['"]/,
    path
  )
  if (application === 'hr') assert.match(source, /layoutMode:\s*['"]hr-employee['"]/, path)
  else assert.doesNotMatch(source, /layoutMode:\s*['"]hr-employee['"]/, path)
}

assert.match(gridCoreSource, /layoutMode === ['"]hr-employee['"]/)
assert.match(gridCoreSource, /scheduleApply:\s*nextTick/)
assert.match(gridCoreSource, /resolveRowKey:\s*\(rowData\)/)
assert.match(gridCoreSource, /rowData\.employee_no/)
assert.doesNotMatch(gridCoreSource, /rowData\.doc_no|rowData\.order_no|rowData\.work_order_no/)

const layoutSource = readSource('shared/eis-grid-local-layout.js')
assert.match(layoutSource, /createSafeStorage\s*}\s*from\s*['"]\.\.\/packages\/eiscore-platform\/src\/safe-storage\.mjs['"]/)
assert.match(layoutSource, /safeStorage\.getJson\(layoutStorageKey\.value,\s*{}\)/)
assert.match(layoutSource, /safeStorage\.setJson\(layoutStorageKey\.value,/)
assert.match(layoutSource, /version:\s*1/)
assert.match(layoutSource, /columns:\s*localLayoutState\.columns/)
assert.match(layoutSource, /rows:\s*localLayoutState\.rows/)
assert.match(layoutSource, /typeof resolveRowKey === ['"]function['"]/)
assert.match(layoutSource, /scheduleApply\(\(\) =>/)
assert.doesNotMatch(layoutSource, /window\.localStorage|\.getItem\(|\.setItem\(/)

console.log('PASS: all eight Grid entries share one safe-layout Core with HR row-key and nextTick compatibility')
