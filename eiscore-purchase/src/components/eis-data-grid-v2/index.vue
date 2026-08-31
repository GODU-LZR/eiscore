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
  PURCHASE_ATTENTION_LEVEL_OPTIONS as attentionLevelOptions,
  attentionLevelRank,
  getManualAttentionLevel,
  normalizeAttentionLevel
} from '@/utils/purchase-attention'
import { evaluateFormulaExpression } from '@/utils/formula-eval'

defineOptions({ inheritAttrs: false })

const entryAdapter = {
  propDefaults: { acceptProfile: 'public', contentProfile: 'public' },
  configDialog: {
    aiApp: 'purchase',
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
    actionRendererOptions: {
      rowActionsEnabled: true,
      allowedIcons: ['Box', 'Document', 'OfficeBuilding', 'Position', 'Promotion', 'Tickets', 'Warning'],
      layout: 'standard'
    },
    defaultProfile: 'public',
    purchaseStatusEditable: true
  },
  attentionServices: { attentionLevelOptions, attentionLevelRank, getManualAttentionLevel, normalizeAttentionLevel },
  historyOptions: {
    defaultProfile: 'public',
    respectReadonlyStaticColumns: true,
    matchFieldDefaultsByLeaf: true,
    requiredFieldDefaults: {
      name: '未命名',
      supplier_no: () => `SUP${Date.now().toString().slice(-6)}`,
      supplier_name: '待选择供应商',
      material_name: '待录入物料',
      quantity: 0,
      unit: 'kg',
      unit_price: 0,
      total_amount: 0,
      order_date: () => new Date().toISOString().slice(0, 10),
      arrival_date: () => new Date().toISOString().slice(0, 10),
      demand_status: '草稿',
      order_status: '草稿',
      arrival_status: '待到货',
      iqc_status: '待检',
      status: 'active',
      properties: () => ({})
    },
    textFields: [
      'name', 'code', 'username', 'email', 'phone', 'address', 'status',
      'supplier_no', 'supplier_name', 'demand_no', 'order_no', 'arrival_no',
      'material_no', 'material_name', 'unit', 'contact_name', 'contact_phone',
      'category', 'payment_terms', 'buyer_name', 'source_dept', 'requester_name',
      'preferred_supplier', 'remark', 'inbound_no'
    ]
  },
  clipboardOptions: { clearMode: 'sanitized-nested' },
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
