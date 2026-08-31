// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const apps = ['apps', 'equipment', 'hr', 'materials', 'production', 'purchase', 'quality', 'sales']
const alwaysSharedRenderers = ['CheckEditor', 'FileRenderer', 'LockHeader', 'SelectEditor', 'StatusEditor']
const sharedViteConfig = readFileSync(resolve(repoRoot, 'scripts/vite-shared-source-config.mjs'), 'utf8')
const rendererLocalVariants = new Map([
  ['CascaderEditor', new Set(['materials'])],
  ['CascaderRenderer', new Set(['materials'])],
  ['GeoRenderer', new Set(['apps'])],
  ['CheckRenderer', new Set(['apps'])],
  ['SelectRenderer', new Set(['materials'])],
  ['StatusRenderer', new Set(['materials'])]
])

for (const dependency of ['vue', 'element-plus', '@element-plus/icons-vue', 'ag-grid-community', 'ag-grid-vue3', 'leaflet', 'html2canvas']) {
  assert.match(sharedViteConfig, new RegExp(`['"]${dependency}['"]`))
}

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
  assert.match(
    entry,
    /import FileDialog from ['"]@shared\/eis-data-grid-v2\/components\/FileDialog\.vue['"]/
  )
  assert.equal(existsSync(resolve(gridRoot, 'components/FileDialog.vue')), false)
  assert.equal(existsSync(resolve(gridRoot, 'components/ColumnManagerDialog.vue')), false)
  const hasLocalGeoDialog = app === 'apps'
  assert.match(
    entry,
    hasLocalGeoDialog
      ? /import GeoDialog from ['"]\.\/components\/GeoDialog\.vue['"]/
      : /import GeoDialog from ['"]@shared\/eis-data-grid-v2\/components\/GeoDialog\.vue['"]/
  )
  assert.equal(existsSync(resolve(gridRoot, 'components/GeoDialog.vue')), hasLocalGeoDialog)
  assert.match(
    viteConfig,
    /import\s*{\s*sharedFrontendDedupe\s*}\s*from\s*['"]\.\.\/scripts\/vite-shared-source-config\.mjs['"]/
  )
  assert.match(viteConfig, /resolve:\s*{\s*dedupe:\s*sharedFrontendDedupe,/)
  for (const renderer of alwaysSharedRenderers) {
    assert.match(
      core,
      new RegExp(`import ${renderer} from ['"]@shared/eis-data-grid-v2/components/renderers/${renderer}\\.vue['"]`)
    )
    assert.equal(existsSync(resolve(gridRoot, `components/renderers/${renderer}.vue`)), false)
  }
  for (const [renderer, localVariants] of rendererLocalVariants) {
    const hasLocalVariant = localVariants.has(app)
    const importPath = hasLocalVariant
      ? `../components/renderers/${renderer}\\.vue`
      : `@shared/eis-data-grid-v2/components/renderers/${renderer}\\.vue`
    assert.match(core, new RegExp(`import ${renderer} from ['"]${importPath}['"]`))
    assert.equal(existsSync(resolve(gridRoot, `components/renderers/${renderer}.vue`)), hasLocalVariant)
  }
}

for (const renderer of [...alwaysSharedRenderers, ...rendererLocalVariants.keys()]) {
  assert.equal(
    existsSync(resolve(repoRoot, `shared/eis-data-grid-v2/components/renderers/${renderer}.vue`)),
    true
  )
}
for (const dialog of ['FileDialog', 'ColumnManagerDialog', 'GeoDialog']) {
  assert.equal(existsSync(resolve(repoRoot, `shared/eis-data-grid-v2/components/${dialog}.vue`)), true)
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

console.log('PASS: all eight Grid entries share selection, common dialogs, and renderer baselines with explicit local variants')
