// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const apps = ['apps', 'equipment', 'hr', 'materials', 'production', 'purchase', 'quality', 'sales']
const sharedRenderers = ['CheckEditor', 'FileRenderer', 'LockHeader', 'SelectEditor', 'StatusEditor']

for (const app of apps) {
  const gridRoot = resolve(repoRoot, `eiscore-${app}/src/components/eis-data-grid-v2`)
  const viteConfig = readFileSync(resolve(repoRoot, `eiscore-${app}/vite.config.js`), 'utf8')
  const entry = readFileSync(resolve(gridRoot, 'index.vue'), 'utf8')
  const core = readFileSync(resolve(gridRoot, 'composables/useGridCore.js'), 'utf8')
  assert.match(
    entry,
    /import\s*{\s*useGridSelection\s*}\s*from\s*['"]@shared\/eis-data-grid-v2\/composables\/useGridSelection['"]/
  )
  assert.equal(existsSync(resolve(gridRoot, 'composables/useGridSelection.js')), false)
  assert.match(viteConfig, /import\s*{\s*sharedFrontendDedupe\s*}\s*from\s*['"]\.\.\/scripts\/vite-shared-source-config\.mjs['"]/)
  assert.match(viteConfig, /resolve:\s*{\s*dedupe:\s*sharedFrontendDedupe,/)
  for (const renderer of sharedRenderers) {
    assert.match(
      core,
      new RegExp(`import ${renderer} from ['"]@shared/eis-data-grid-v2/components/renderers/${renderer}\\.vue['"]`)
    )
    assert.equal(existsSync(resolve(gridRoot, `components/renderers/${renderer}.vue`)), false)
  }
}

for (const renderer of sharedRenderers) {
  assert.equal(
    existsSync(resolve(repoRoot, `shared/eis-data-grid-v2/components/renderers/${renderer}.vue`)),
    true
  )
}

const selectionSource = readFileSync(
  resolve(repoRoot, 'shared/eis-data-grid-v2/composables/useGridSelection.js'),
  'utf8'
)
for (const contract of [
  'rangeSelection',
  'onCellMouseDown',
  'onCellMouseOver',
  'onSelectionChanged',
  'isCellInSelection',
  'selectColumnRange',
  'selectRowRange'
]) {
  assert.match(selectionSource, new RegExp(`\\b${contract}\\b`))
}
assert.match(selectionSource, /export function useGridSelection\(gridApi, selectedRowsCount, gridRootRef\)/)
assert.match(selectionSource, /requestAnimationFrame\(autoScroll\)/)
assert.match(selectionSource, /cancelAnimationFrame\(autoScrollRaf\)/)

console.log('PASS: all eight Grid entries share selection and five base renderer/editor implementations')
