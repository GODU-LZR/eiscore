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
import RowHeightHandleRenderer from './components/renderers/RowHeightHandleRenderer.vue'
import StatusRenderer from '@shared/eis-data-grid-v2/components/renderers/StatusRenderer.vue'
import SelectRenderer from '@shared/eis-data-grid-v2/components/renderers/SelectRenderer.vue'
import CascaderRenderer from '@shared/eis-data-grid-v2/components/renderers/CascaderRenderer.vue'
import CascaderEditor from '@shared/eis-data-grid-v2/components/renderers/CascaderEditor.vue'
import GeoRenderer from '@shared/eis-data-grid-v2/components/renderers/GeoRenderer.vue'
import CheckRenderer from '@shared/eis-data-grid-v2/components/renderers/CheckRenderer.vue'
import {
  HR_ATTENTION_LEVEL_OPTIONS as attentionLevelOptions,
  attentionLevelRank,
  getManualAttentionLevel,
  normalizeAttentionLevel
} from '@/utils/hr-attention'
import { evaluateFormulaExpression } from '@shared/utils/formula-eval'

defineOptions({ inheritAttrs: false })

const entryAdapter = {
  propDefaults: { maxRowHeight: 160 },
  GeoDialog,
  rendererComponents: {
    StatusRenderer, SelectRenderer, CascaderRenderer, CascaderEditor,
    GeoRenderer, CheckRenderer, RowHeightHandleRenderer
  },
  coreOptions: {
    rowActionsEnabled: false,
    actionRendererOptions: { rowActionsEnabled: false, allowedIcons: ['Document'], layout: 'form-only' },
    layoutMode: 'hr-employee'
  },
  attentionServices: { attentionLevelOptions, attentionLevelRank, getManualAttentionLevel, normalizeAttentionLevel },
  historyOptions: {},
  services: { debounce, evaluateFormulaExpression }
}

const sharedGrid = ref(null)
const invoke = (method, args) => sharedGrid.value?.[method]?.(...args)
const loadData = (...args) => invoke('loadData', args)
const loadNextPage = (...args) => invoke('loadNextPage', args)
const setWorkflowBinding = (...args) => invoke('setWorkflowBinding', args)
const recalculateServerFormulas = (...args) => invoke('recalculateServerFormulas', args)

defineExpose({ loadData, loadNextPage, setWorkflowBinding, recalculateServerFormulas })
</script>
