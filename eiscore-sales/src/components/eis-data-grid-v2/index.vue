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
import StatusRenderer from '@shared/eis-data-grid-v2/components/renderers/StatusRenderer.vue'
import SelectRenderer from '@shared/eis-data-grid-v2/components/renderers/SelectRenderer.vue'
import CascaderRenderer from '@shared/eis-data-grid-v2/components/renderers/CascaderRenderer.vue'
import CascaderEditor from '@shared/eis-data-grid-v2/components/renderers/CascaderEditor.vue'
import GeoRenderer from '@shared/eis-data-grid-v2/components/renderers/GeoRenderer.vue'
import CheckRenderer from '@shared/eis-data-grid-v2/components/renderers/CheckRenderer.vue'
import RowHeightHandleRenderer from '@shared/eis-grid-row-height-handle.vue'
import {
  SALES_ATTENTION_LEVEL_OPTIONS as attentionLevelOptions,
  attentionLevelRank,
  getManualAttentionLevel,
  normalizeAttentionLevel
} from '@/utils/sales-attention'
import { evaluateFormulaExpression } from '@/utils/formula-eval'

defineOptions({ inheritAttrs: false })

const entryAdapter = {
  constrainHeight: true,
  propDefaults: { acceptProfile: 'public', contentProfile: 'public' },
  configDialog: {
    aiApp: 'sales',
    cellLabelExample: '订单金额',
    formulaDisplayExample: '{订单金额} * 0.18',
    formulaPromptExample: '{订单金额}*0.18'
  },
  GeoDialog,
  rendererComponents: {
    StatusRenderer, SelectRenderer, CascaderRenderer, CascaderEditor,
    GeoRenderer, CheckRenderer, RowHeightHandleRenderer
  },
  coreOptions: {
    actionColumnWidth: 240,
    actionColumnMinWidth: 230,
    actionRendererOptions: {
      rowActionsEnabled: true,
      allowedIcons: ['ChatLineSquare', 'Document', 'Money', 'Position', 'Promotion', 'Tickets', 'TrendCharts'],
      layout: 'compact'
    },
    defaultProfile: 'public'
  },
  attentionServices: { attentionLevelOptions, attentionLevelRank, getManualAttentionLevel, normalizeAttentionLevel },
  historyOptions: {
    defaultProfile: 'public',
    encodeFilterValues: true,
    textFields: [
      'name', 'code', 'username', 'email', 'phone', 'address', 'status',
      'customer_no', 'order_no', 'payment_no', 'customer_name', 'product_name',
      'contact_name', 'contact_phone', 'region', 'owner_name', 'handler_name'
    ]
  },
  services: { debounce, evaluateFormulaExpression }
}

const sharedGrid = ref(null)
const invoke = (method, args) => sharedGrid.value?.[method]?.(...args)
const loadData = (...args) => invoke('loadData', args)
const loadNextPage = (...args) => invoke('loadNextPage', args)
const setWorkflowBinding = (...args) => invoke('setWorkflowBinding', args)
const getSelectedRows = (...args) => invoke('getSelectedRows', args)
const recalculateServerFormulas = (...args) => invoke('recalculateServerFormulas', args)

defineExpose({ loadData, loadNextPage, setWorkflowBinding, getSelectedRows, recalculateServerFormulas })
</script>
