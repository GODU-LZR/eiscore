// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const apps = ['apps', 'equipment', 'hr', 'materials', 'production', 'purchase', 'quality', 'sales']
const alwaysSharedRenderers = ['CheckEditor', 'DocumentActionRenderer', 'FileRenderer', 'LockHeader', 'SelectEditor', 'StatusEditor']
const sharedViteConfig = readFileSync(resolve(repoRoot, 'scripts/vite-shared-source-config.mjs'), 'utf8')
const sharedCore = readFileSync(resolve(repoRoot, 'shared/eis-data-grid-v2/composables/useGridCore.js'), 'utf8')
const sharedEntry = readFileSync(resolve(repoRoot, 'shared/eis-data-grid-v2/index.vue'), 'utf8')
const rendererLocalVariants = new Map([
  ['CascaderEditor', new Set(['materials'])],
  ['CascaderRenderer', new Set(['materials'])],
  ['GeoRenderer', new Set(['apps'])],
  ['CheckRenderer', new Set(['apps'])],
  ['SelectRenderer', new Set(['materials'])],
  ['StatusRenderer', new Set(['materials'])]
])
const localFormulaEvaluators = new Set(['materials', 'production', 'purchase', 'sales'])
const documentActionOptions = new Map([
  ['apps', { enabled: false, icons: ['Document'], layout: 'form-only' }],
  ['equipment', { enabled: true, icons: ['CircleCheck', 'Document', 'Tools', 'Warning'], layout: 'standard' }],
  ['hr', { enabled: false, icons: ['Document'], layout: 'form-only' }],
  ['materials', { enabled: false, icons: ['Document'], layout: 'form-only' }],
  ['production', { enabled: true, icons: ['CircleCheck', 'Document', 'Edit', 'Position', 'Warning'], layout: 'standard' }],
  ['purchase', { enabled: true, icons: ['Box', 'Document', 'OfficeBuilding', 'Position', 'Promotion', 'Tickets', 'Warning'], layout: 'standard' }],
  ['quality', { enabled: true, icons: ['CircleCheck', 'Document', 'Warning'], layout: 'standard' }],
  ['sales', { enabled: true, icons: ['ChatLineSquare', 'Document', 'Money', 'Position', 'Promotion', 'Tickets', 'TrendCharts'], layout: 'compact' }]
])
const expectedExposes = new Map([
  ['apps', ['loadData', 'loadNextPage', 'setWorkflowBinding', 'prependRow', 'recalculateServerFormulas']],
  ['equipment', ['loadData', 'loadNextPage', 'setWorkflowBinding', 'recalculateServerFormulas']],
  ['hr', ['loadData', 'loadNextPage', 'setWorkflowBinding', 'recalculateServerFormulas']],
  ['materials', ['loadData', 'loadNextPage', 'setWorkflowBinding', 'refreshCells', 'recalculateServerFormulas']],
  ['production', ['loadData', 'loadNextPage', 'setWorkflowBinding', 'refreshCells', 'recalculateServerFormulas']],
  ['purchase', ['loadData', 'loadNextPage', 'setWorkflowBinding', 'getSelectedRows', 'recalculateServerFormulas']],
  ['quality', ['loadData', 'loadNextPage', 'setWorkflowBinding', 'recalculateServerFormulas']],
  ['sales', ['loadData', 'loadNextPage', 'setWorkflowBinding', 'getSelectedRows', 'recalculateServerFormulas']]
])

for (const dependency of ['vue', 'element-plus', '@element-plus/icons-vue', 'ag-grid-community', 'ag-grid-vue3', 'leaflet', 'html2canvas']) {
  assert.match(sharedViteConfig, new RegExp(`['"]${dependency}['"]`))
}

for (const app of apps) {
  const gridRoot = resolve(repoRoot, `eiscore-${app}/src/components/eis-data-grid-v2`)
  const viteConfig = readFileSync(resolve(repoRoot, `eiscore-${app}/vite.config.js`), 'utf8')
  const entry = readFileSync(resolve(gridRoot, 'index.vue'), 'utf8')
  assert.match(
    entry,
    /import SharedGrid from ['"]@shared\/eis-data-grid-v2\/index\.vue['"]/
  )
  assert.match(entry, /<SharedGrid ref="sharedGrid" v-bind="\$attrs" :entry-adapter="entryAdapter">/)
  assert.match(entry, /defineOptions\(\{ inheritAttrs: false }\)/)
  assert.doesNotMatch(entry, /<ag-grid-vue|useGridCore|useGridSelection|useGridFormula|useGridClipboard|useGridHistory|<style/)
  assert.ok(entry.split(/\r?\n/).length <= 110, `${app} Grid entry must remain a thin adapter`)
  assert.equal(existsSync(resolve(gridRoot, 'composables/useGridCore.js')), false)
  assert.match(entry, /import\s*{\s*debounce\s*}\s*from\s*['"]lodash['"]/)
  assert.match(entry, /services:\s*{\s*debounce,\s*evaluateFormulaExpression\s*}/)
  assert.equal(existsSync(resolve(gridRoot, 'composables/useGridSelection.js')), false)
  assert.equal(existsSync(resolve(gridRoot, 'composables/useGridFormula.js')), false)
  assert.equal(existsSync(resolve(gridRoot, 'composables/useGridClipboard.js')), false)
  assert.equal(existsSync(resolve(gridRoot, 'composables/useGridHistory.js')), false)
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
      sharedCore,
      new RegExp(`import ${renderer} from ['"]@shared/eis-data-grid-v2/components/renderers/${renderer}\\.vue['"]`)
    )
    assert.equal(existsSync(resolve(gridRoot, `components/renderers/${renderer}.vue`)), false)
  }
  for (const [renderer, localVariants] of rendererLocalVariants) {
    const hasLocalVariant = localVariants.has(app)
    const importPath = hasLocalVariant
      ? `\\./components/renderers/${renderer}\\.vue`
      : `@shared/eis-data-grid-v2/components/renderers/${renderer}\\.vue`
    assert.match(entry, new RegExp(`import ${renderer} from ['"]${importPath}['"]`))
    assert.match(entry, new RegExp(`rendererComponents:\\s*{[^}]*\\b${renderer}\\b[^}]*}`))
    assert.doesNotMatch(sharedCore, new RegExp(`import ${renderer} from`))
    assert.equal(existsSync(resolve(gridRoot, `components/renderers/${renderer}.vue`)), hasLocalVariant)
  }
  const actionOptions = documentActionOptions.get(app)
  const actionRendererParams = entry.match(/actionRendererOptions:\s*{[^}]+}/)?.[0] || ''
  assert.match(actionRendererParams, new RegExp(`rowActionsEnabled:\\s*${actionOptions.enabled}`))
  assert.match(actionRendererParams, new RegExp(`allowedIcons:\\s*\\[${actionOptions.icons.map(icon => `['"]${icon}['"]`).join(',\\s*')}\\]`))
  assert.match(actionRendererParams, new RegExp(`layout:\\s*['"]${actionOptions.layout}['"]`))
  if (actionOptions.enabled) {
    assert.doesNotMatch(entry, /rowActionsEnabled:\s*false/)
  } else {
    assert.match(entry, /rowActionsEnabled:\s*false/)
  }

  if (app === 'apps') {
    assert.match(entry, /attentionEnabled:\s*false/)
    assert.match(entry, /legacyAppColumns:\s*true/)
    assert.doesNotMatch(entry, /from\s*['"]@\/utils\/[^'"]*attention['"]/)
  } else {
    assert.match(entry, /attentionLevelOptions,\s*attentionLevelRank,\s*getManualAttentionLevel,\s*normalizeAttentionLevel/)
  }
  if (app === 'hr') {
    assert.match(entry, /import RowHeightHandleRenderer from ['"]\.\/components\/renderers\/RowHeightHandleRenderer\.vue['"]/)
    assert.match(entry, /rendererComponents:\s*{[^}]*\bRowHeightHandleRenderer\b[^}]*}/)
    assert.match(entry, /layoutMode:\s*['"]hr-employee['"]/)
    assert.match(entry, /propDefaults:\s*{\s*maxRowHeight:\s*160\s*}/)
  }
  if (app === 'materials') assert.match(entry, /materialColumns:\s*true/)
  if (app === 'purchase') assert.match(entry, /purchaseStatusEditable:\s*true/)
  if (app === 'purchase' || app === 'sales') {
    assert.match(entry, /defaultProfile:\s*['"]public['"]/)
    assert.match(entry, /propDefaults:\s*{\s*acceptProfile:\s*['"]public['"],\s*contentProfile:\s*['"]public['"]\s*}/)
  }

  if (app === 'apps') {
    assert.match(entry, /toolbarLayout:\s*['"]split['"]/)
    assert.match(entry, /tableToolsSlot:\s*false/)
    assert.match(entry, /configDialog:\s*{\s*aiApp:\s*['"]app_center['"]\s*}/)
    assert.match(entry, /initialSearchEnabled:\s*false/)
    assert.match(entry, /reloadOnApiUrlChange:\s*true/)
  } else if (app === 'purchase' || app === 'sales') {
    assert.match(entry, new RegExp(`configDialog:\\s*{[\\s\\S]*?aiApp:\\s*['"]${app}['"][\\s\\S]*?cellLabelExample:\\s*['"]订单金额['"][\\s\\S]*?formulaDisplayExample:\\s*['"]\\{订单金额\\} \\* 0\\.18['"][\\s\\S]*?formulaPromptExample:\\s*['"]\\{订单金额\\}\\*0\\.18['"][\\s\\S]*?}`))
  } else {
    assert.doesNotMatch(entry, /\bconfigDialog:\s*{/)
  }

  if (app === 'materials') {
    assert.match(entry, /toolbarFullWidthRows:\s*true/)
  } else {
    assert.doesNotMatch(entry, /toolbarFullWidthRows:\s*true/)
  }
  if (app !== 'apps') assert.doesNotMatch(entry, /toolbarLayout:\s*['"]split['"]/)

  if (new Set(['equipment', 'materials', 'sales']).has(app)) {
    assert.match(entry, /constrainHeight:\s*true/)
  } else {
    assert.doesNotMatch(entry, /constrainHeight:\s*true/)
  }
  if (app === 'apps') assert.match(entry, /styleVariant:\s*['"]legacy-columns['"]/)
  else if (app === 'equipment') assert.match(entry, /styleVariant:\s*['"]bordered-attention['"]/)
  else assert.doesNotMatch(entry, /\bstyleVariant\b/)
  if (app === 'materials' || app === 'production') {
    assert.match(entry, /emitSelectionChanged:\s*true/)
  } else {
    assert.doesNotMatch(entry, /emitSelectionChanged:\s*true/)
  }
  if (app === 'materials') assert.match(entry, /respectAttentionReadonly:\s*true/)
  else assert.doesNotMatch(entry, /respectAttentionReadonly:\s*true/)

  if (app === 'materials') {
    assert.match(entry, /clipboardOptions:\s*{\s*keyboardMode:\s*['"]preserve-editors['"]\s*}/)
  } else {
    assert.doesNotMatch(entry, /keyboardMode:\s*['"]preserve-editors['"]/)
  }
  if (app === 'purchase') {
    assert.match(entry, /clipboardOptions:\s*{\s*clearMode:\s*['"]sanitized-nested['"]\s*}/)
  } else {
    assert.doesNotMatch(entry, /clearMode:\s*['"]sanitized-nested['"]/)
  }

  const historyOptionOwners = new Map([
    ['defaultProfile', new Set(['purchase', 'sales'])],
    ['removeEmptyPropertyValues', new Set(['equipment', 'quality'])],
    ['profileFallbackFromProps', new Set(['materials'])],
    ['skipSaveColumns', new Set(['materials'])],
    ['respectReadonlyStaticColumns', new Set(['purchase'])],
    ['matchFieldDefaultsByLeaf', new Set(['purchase'])],
    ['requiredFieldDefaults', new Set(['purchase'])],
    ['encodeFilterValues', new Set(['sales'])],
    ['textFields', new Set(['purchase', 'sales'])]
  ])
  for (const [option, owners] of historyOptionOwners) {
    if (owners.has(app)) {
      assert.match(entry, new RegExp(`\\b${option}\\b`))
    } else {
      assert.doesNotMatch(entry, new RegExp(`\\b${option}\\b`))
    }
  }

  if (localFormulaEvaluators.has(app)) {
    assert.match(
      entry,
      /import\s*{\s*evaluateFormulaExpression\s*}\s*from\s*['"]@\/utils\/formula-eval['"]/
    )
  } else {
    assert.match(
      entry,
      /import\s*{\s*evaluateFormulaExpression\s*}\s*from\s*['"]@shared\/utils\/formula-eval['"]/
    )
  }

  const exposed = (entry.match(/defineExpose\(\{([^}]+)}\)/)?.[1] || '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean)
    .sort()
  assert.deepEqual(exposed, [...expectedExposes.get(app)].sort())
}

for (const composable of ['useGridCore', 'useGridSelection', 'useGridFormula', 'useGridClipboard', 'useGridHistory']) {
  assert.match(sharedEntry, new RegExp(`from ['"]@shared/eis-data-grid-v2/composables/${composable}['"]`))
}
for (const component of ['FileDialog', 'ConfigDialog', 'GridToolbar']) {
  assert.match(sharedEntry, new RegExp(`import ${component} from ['"]@shared/eis-data-grid-v2/components/${component}\\.vue['"]`))
}
assert.match(sharedEntry, /<ag-grid-vue/)
assert.match(sharedEntry, /entryAdapter\.rendererComponents/)
assert.match(sharedEntry, /entryAdapter\.attentionServices/)
assert.match(sharedEntry, /entryAdapter\.historyOptions/)
assert.match(sharedEntry, /entryAdapter\.clipboardOptions/)
assert.match(sharedEntry, /adapterServices\.evaluateFormulaExpression/)
assert.match(sharedEntry, /adapterServices\.debounce/)
assert.match(sharedEntry, /entryAdapter\.emitSelectionChanged/)
assert.match(sharedEntry, /entryAdapter\.reloadOnApiUrlChange/)
assert.match(sharedEntry, /entryAdapter\.styleVariant === ['"]legacy-columns['"]/)
assert.match(sharedEntry, /entryAdapter\.styleVariant === ['"]bordered-attention['"]/)
assert.doesNotMatch(sharedEntry, /eiscore-(?:apps|equipment|hr|materials|production|purchase|quality|sales)/)

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

const formulaSource = readFileSync(
  resolve(repoRoot, 'shared/eis-data-grid-v2/composables/useGridFormula.js'),
  'utf8'
)
assert.match(formulaSource, /formulaServices\s*=\s*{}/)
assert.match(formulaSource, /const\s*{\s*evaluateFormulaExpression\s*}\s*=\s*formulaServices/)
assert.doesNotMatch(
  formulaSource,
  /from\s*['"][^'"]*formula-eval['"]/
)

const clipboardSource = readFileSync(
  resolve(repoRoot, 'shared/eis-data-grid-v2/composables/useGridClipboard.js'),
  'utf8'
)
assert.match(clipboardSource, /clipboardOptions\s*=\s*{}/)
assert.match(clipboardSource, /keyboardMode\s*=\s*['"]default['"]/)
assert.match(clipboardSource, /clearMode\s*=\s*['"]plain['"]/)
assert.match(clipboardSource, /keyboardMode\s*===\s*['"]preserve-editors['"]/)
assert.match(clipboardSource, /clearMode\s*===\s*['"]sanitized-nested['"]/)
assert.doesNotMatch(clipboardSource, /\b(?:apps|equipment|hr|materials|production|purchase|quality|sales)\b/)

const historySource = readFileSync(
  resolve(repoRoot, 'shared/eis-data-grid-v2/composables/useGridHistory.js'),
  'utf8'
)
assert.match(historySource, /historyOptions\s*=\s*{}/)
assert.match(historySource, /historyServices\s*=\s*{}/)
assert.match(historySource, /const\s*{\s*debounce\s*}\s*=\s*historyServices/)
assert.doesNotMatch(historySource, /from\s*['"]lodash['"]/)
for (const option of [
  'defaultProfile',
  'profileFallbackFromProps',
  'removeEmptyPropertyValues',
  'skipSaveColumns',
  'encodeFilterValues',
  'textFields',
  'requiredFieldDefaults',
  'matchFieldDefaultsByLeaf',
  'respectReadonlyStaticColumns'
]) {
  assert.match(historySource, new RegExp(`\\b${option}\\b`))
}
assert.doesNotMatch(historySource, /eiscore-(?:apps|equipment|hr|materials|production|purchase|quality|sales)/)

const documentActionSource = readFileSync(
  resolve(repoRoot, 'shared/eis-data-grid-v2/components/renderers/DocumentActionRenderer.vue'),
  'utf8'
)
assert.match(documentActionSource, /rowActionsEnabled\s*!==\s*true/)
assert.match(documentActionSource, /allowedIcons\.includes\(icon\)/)
assert.match(documentActionSource, /action-cell-wrapper--form-only/)
assert.match(documentActionSource, /action-cell-wrapper--compact/)
assert.doesNotMatch(documentActionSource, /eiscore-(?:apps|equipment|hr|materials|production|purchase|quality|sales)/)

assert.match(sharedCore, /coreOptions\s*=\s*{}/)
assert.match(sharedCore, /coreServices\s*=\s*{}/)
for (const option of [
  'rendererComponents',
  'attentionEnabled',
  'rowActionsEnabled',
  'actionColumnWidth',
  'actionColumnMinWidth',
  'actionRendererOptions',
  'defaultProfile',
  'layoutMode',
  'legacyAppColumns',
  'materialColumns',
  'purchaseStatusEditable'
]) {
  assert.match(sharedCore, new RegExp(`\\b${option}\\b`))
}
for (const service of [
  'attentionLevelOptions',
  'attentionLevelRank',
  'getManualAttentionLevel',
  'normalizeAttentionLevel'
]) {
  assert.match(sharedCore, new RegExp(`\\b${service}\\b`))
}
assert.doesNotMatch(sharedCore, /from\s*['"]@\/utils\/[^'"]*attention['"]/)
assert.doesNotMatch(sharedCore, /eiscore-(?:apps|equipment|hr|materials|production|purchase|quality|sales)/)

console.log('PASS: eight thin Grid adapters share one entry, core, composables, dialogs, and renderer baselines with explicit variants')
