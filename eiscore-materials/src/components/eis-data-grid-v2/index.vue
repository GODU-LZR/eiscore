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
import GeoDialog from '@shared/eis-data-grid-v2/components/GeoDialog.vue'
import CascaderEditor from './components/renderers/CascaderEditor.vue'
import CascaderRenderer from './components/renderers/CascaderRenderer.vue'
import SelectRenderer from './components/renderers/SelectRenderer.vue'
import StatusRenderer from './components/renderers/StatusRenderer.vue'
import GeoRenderer from '@shared/eis-data-grid-v2/components/renderers/GeoRenderer.vue'
import CheckRenderer from '@shared/eis-data-grid-v2/components/renderers/CheckRenderer.vue'
import RowHeightHandleRenderer from '@shared/eis-grid-row-height-handle.vue'
import {
  MATERIAL_ATTENTION_LEVEL_OPTIONS as attentionLevelOptions,
  attentionLevelRank,
  getManualAttentionLevel,
  normalizeAttentionLevel
} from '@/utils/material-attention'
import { evaluateFormulaExpression } from '@/utils/formula-eval'

defineOptions({ inheritAttrs: false })

const entryAdapter = {
  constrainHeight: true,
  toolbarFullWidthRows: true,
  emitSelectionChanged: true,
  respectAttentionReadonly: true,
  GeoDialog,
  rendererComponents: {
    StatusRenderer, SelectRenderer, CascaderRenderer, CascaderEditor,
    GeoRenderer, CheckRenderer, RowHeightHandleRenderer
  },
  coreOptions: {
    rowActionsEnabled: false,
    actionRendererOptions: { rowActionsEnabled: false, allowedIcons: ['Document'], layout: 'form-only' },
    materialColumns: true
  },
  attentionServices: { attentionLevelOptions, attentionLevelRank, getManualAttentionLevel, normalizeAttentionLevel },
  historyOptions: { profileFallbackFromProps: true, skipSaveColumns: true },
  clipboardOptions: { keyboardMode: 'preserve-editors' },
  services: { debounce, evaluateFormulaExpression }
}

const sharedGrid = ref(null)
const invoke = (method, args) => sharedGrid.value?.[method]?.(...args)
const loadData = (...args) => invoke('loadData', args)
const loadNextPage = (...args) => invoke('loadNextPage', args)
const setWorkflowBinding = (...args) => invoke('setWorkflowBinding', args)
const refreshCells = (...args) => invoke('refreshCells', args)
const recalculateServerFormulas = (...args) => invoke('recalculateServerFormulas', args)

defineExpose({ loadData, loadNextPage, setWorkflowBinding, refreshCells, recalculateServerFormulas })
</script>
