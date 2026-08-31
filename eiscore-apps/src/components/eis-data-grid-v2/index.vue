<template>
  <SharedGrid ref="sharedGrid" v-bind="$attrs" :entry-adapter="entryAdapter">
    <template #toolbar><slot name="toolbar" /></template>
    <template #table-toolbar><slot name="table-toolbar" /></template>
  </SharedGrid>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { ref } from 'vue'
import { debounce } from 'lodash'
import SharedGrid from '@shared/eis-data-grid-v2/index.vue'
import GeoDialog from './components/GeoDialog.vue'
import GeoRenderer from './components/renderers/GeoRenderer.vue'
import CheckRenderer from './components/renderers/CheckRenderer.vue'
import StatusRenderer from '@shared/eis-data-grid-v2/components/renderers/StatusRenderer.vue'
import SelectRenderer from '@shared/eis-data-grid-v2/components/renderers/SelectRenderer.vue'
import CascaderRenderer from '@shared/eis-data-grid-v2/components/renderers/CascaderRenderer.vue'
import CascaderEditor from '@shared/eis-data-grid-v2/components/renderers/CascaderEditor.vue'
import RowHeightHandleRenderer from '@shared/eis-grid-row-height-handle.vue'
import { evaluateFormulaExpression } from '@shared/utils/formula-eval'

defineOptions({ inheritAttrs: false })

const entryAdapter = {
  toolbarLayout: 'split',
  tableToolsSlot: false,
  styleVariant: 'legacy-columns',
  initialSearchEnabled: false,
  reloadOnApiUrlChange: true,
  configDialog: { aiApp: 'app_center' },
  GeoDialog,
  rendererComponents: {
    StatusRenderer, SelectRenderer, CascaderRenderer, CascaderEditor,
    GeoRenderer, CheckRenderer, RowHeightHandleRenderer
  },
  coreOptions: {
    attentionEnabled: false,
    rowActionsEnabled: false,
    actionRendererOptions: { rowActionsEnabled: false, allowedIcons: ['Document'], layout: 'form-only' },
    legacyAppColumns: true
  },
  historyOptions: {},
  services: { debounce, evaluateFormulaExpression }
}

const sharedGrid = ref(null)
const invoke = (method, args) => sharedGrid.value?.[method]?.(...args)
const loadData = (...args) => invoke('loadData', args)
const loadNextPage = (...args) => invoke('loadNextPage', args)
const setWorkflowBinding = (...args) => invoke('setWorkflowBinding', args)
const prependRow = (...args) => invoke('prependRow', args)
const recalculateServerFormulas = (...args) => invoke('recalculateServerFormulas', args)

defineExpose({ loadData, loadNextPage, setWorkflowBinding, prependRow, recalculateServerFormulas })
</script>
