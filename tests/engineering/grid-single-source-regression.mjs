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
  assert.match(
    entry,
    /import ConfigDialog from ['"]@shared\/eis-data-grid-v2\/components\/ConfigDialog\.vue['"]/
  )
  assert.match(
    entry,
    /import GridToolbar from ['"]@shared\/eis-data-grid-v2\/components\/GridToolbar\.vue['"]/
  )
  assert.equal(existsSync(resolve(gridRoot, 'components/FileDialog.vue')), false)
  assert.equal(existsSync(resolve(gridRoot, 'components/ColumnManagerDialog.vue')), false)
  assert.equal(existsSync(resolve(gridRoot, 'components/ConfigDialog.vue')), false)
  assert.equal(existsSync(resolve(gridRoot, 'components/GridToolbar.vue')), false)
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

  if (app === 'apps') {
    assert.match(entry, /<ConfigDialog[\s\S]*?ai-app="app_center"[\s\S]*?@save="saveConfig"/)
    assert.match(entry, /<GridToolbar[\s\S]*?layout="split"[\s\S]*?<\/GridToolbar>/)
  } else if (app === 'purchase' || app === 'sales') {
    assert.match(entry, new RegExp(`<ConfigDialog[\\s\\S]*?ai-app="${app}"[\\s\\S]*?cell-label-example="订单金额"[\\s\\S]*?formula-display-example="\\{订单金额\\} \\* 0\\.18"[\\s\\S]*?formula-prompt-example="\\{订单金额\\}\\*0\\.18"[\\s\\S]*?@save="saveConfig"`))
  } else {
    const configInvocation = entry.match(/<ConfigDialog[\s\S]*?@save="saveConfig"/)?.[0] || ''
    assert.doesNotMatch(configInvocation, /ai-app|cell-label-example|formula-display-example|formula-prompt-example/)
  }

  const toolbarInvocation = entry.match(/<GridToolbar[\s\S]*?<\/GridToolbar>/)?.[0] || ''
  if (app === 'materials') {
    assert.match(toolbarInvocation, /\bfull-width-rows\b/)
  } else {
    assert.doesNotMatch(toolbarInvocation, /\bfull-width-rows\b/)
  }
  if (app !== 'apps') assert.doesNotMatch(toolbarInvocation, /\blayout="split"/)
}

for (const renderer of [...alwaysSharedRenderers, ...rendererLocalVariants.keys()]) {
  assert.equal(
    existsSync(resolve(repoRoot, `shared/eis-data-grid-v2/components/renderers/${renderer}.vue`)),
    true
  )
}
for (const dialog of ['FileDialog', 'ColumnManagerDialog', 'GeoDialog', 'ConfigDialog']) {
  assert.equal(existsSync(resolve(repoRoot, `shared/eis-data-grid-v2/components/${dialog}.vue`)), true)
}

const gridToolbarSource = readFileSync(
  resolve(repoRoot, 'shared/eis-data-grid-v2/components/GridToolbar.vue'),
  'utf8'
)
for (const prop of ['layout', 'fullWidthRows']) {
  assert.match(gridToolbarSource, new RegExp(`['"]${prop}['"]`))
}
assert.match(
  gridToolbarSource,
  /props\.layout === ['"]split['"]/
)
assert.match(gridToolbarSource, /class="toolbar-business-row"/)
assert.match(gridToolbarSource, /class="left-tools"/)

const configDialogSource = readFileSync(
  resolve(repoRoot, 'shared/eis-data-grid-v2/components/ConfigDialog.vue'),
  'utf8'
)
for (const prop of ['aiApp', 'cellLabelExample', 'formulaDisplayExample', 'formulaPromptExample']) {
  assert.match(configDialogSource, new RegExp(`['"]${prop}['"]`))
}
assert.match(configDialogSource, /props\.aiApp \|\| ['"]hr['"]/)
assert.match(configDialogSource, /props\.cellLabelExample \|\| ['"]员工['"]/)
assert.match(configDialogSource, /props\.formulaDisplayExample \|\| ['"]\{基本工资\} \+ \{岗位津贴\}['"]/)
assert.match(configDialogSource, /props\.formulaPromptExample \|\| ['"]\{工资\}\+\{绩效\}['"]/)

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
