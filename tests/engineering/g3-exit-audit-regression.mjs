// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'))

const auditDocs = [
  'G3_REALTIME_EXIT_AUDIT.md',
  'G3_AI_COPILOT_EXIT_AUDIT.md',
  'G3_APP_RUNTIME_EXIT_AUDIT.md',
  'G3_BASE_LAYOUT_EXIT_AUDIT.md',
  'G3_DOCUMENT_INTAKE_EXIT_AUDIT.md',
  'G3_EQUIPMENT_HOME_EXIT_AUDIT.md',
  'G3_FLASH_BUILDER_EXIT_AUDIT.md',
  'G3_ONTOLOGY_WORKBENCH_EXIT_AUDIT.md',
  'G3_PRODUCTION_GRID_EXIT_AUDIT.md',
  'G3_PURCHASE_DOCUMENT_DETAIL_EXIT_AUDIT.md',
  'G3_PURCHASE_GRID_EXIT_AUDIT.md',
  'G3_SALES_COCKPIT_EXIT_AUDIT.md',
  'G3_SALES_GRID_EXIT_AUDIT.md'
]
for (const doc of auditDocs) {
  assert.equal(existsSync(resolve(repoRoot, 'docs/engineering', doc)), true, 'missing G3 audit: ' + doc)
}

const compositionGates = [
  'realtime-composition-root-regression.mjs',
  'ai-copilot-composition-exit-regression.mjs',
  'app-runtime-composition-exit-regression.mjs',
  'base-layout-composition-exit-regression.mjs',
  'document-intake-composition-exit-regression.mjs',
  'equipment-home-composition-exit-regression.mjs',
  'flash-builder-composition-exit-regression.mjs',
  'ontology-workbench-composition-exit-regression.mjs',
  'production-grid-composition-exit-regression.mjs',
  'purchase-document-detail-composition-exit-regression.mjs',
  'purchase-grid-composition-exit-regression.mjs',
  'sales-cockpit-composition-exit-regression.mjs',
  'sales-grid-composition-exit-regression.mjs'
]
for (const gate of compositionGates) {
  assert.equal(existsSync(resolve(repoRoot, 'tests/engineering', gate)), true, 'missing G3 composition gate: ' + gate)
}

const qualityScript = packageJson.scripts?.['test:quality'] || ''
assert.match(qualityScript, /test:g3-exit/)
assert.match(qualityScript, /test:runtime-router/)
assert.match(qualityScript, /test:database-migrations/)
assert.match(qualityScript, /test:vue-complexity/)

const g3Script = packageJson.scripts?.['test:g3-exit'] || ''
assert.match(g3Script, /realtime-composition-root-regression/)
assert.match(g3Script, /database-migration-governance-regression/)
assert.match(g3Script, /vue-complexity-inventory-regression/)
for (const gate of compositionGates) {
  assert.equal(g3Script.includes(gate), true, 'G3 script omitted composition gate: ' + gate)
}

console.log('PASS: G3 exit audit registry (' + auditDocs.length + ' audit docs, ' + compositionGates.length + ' composition gates)')
