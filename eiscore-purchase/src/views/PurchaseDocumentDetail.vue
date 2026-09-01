<template>
  <div class="detail-page" data-guide="detail-page">
    <div class="page-header" data-guide="detail-header">
      <div class="header-main">
        <el-button icon="ArrowLeft" data-guide="detail-back" @click="goBack">返回列表</el-button>
        <div class="title-block">
          <h2>{{ pageTitle }}</h2>
          <div class="doc-meta">
            <span>{{ docMainName }}</span>
            <span v-if="formData?.id">ID: {{ formData.id }}</span>
          </div>
        </div>
      </div>

      <div class="header-actions" data-guide="detail-actions">
        <el-select v-model="selectedTemplateId" size="small" placeholder="选择模板" style="width: 220px;" data-guide="template-select">
          <el-option
            v-for="tpl in templates"
            :key="tpl.id"
            :label="tpl.name"
            :value="tpl.id"
          />
        </el-select>
        <el-button
          data-sop-action="detail-template-library"
          data-sop-title="维护单据模板库"
          data-sop-desc="管理当前采购应用的单据模板，可新增、预览、改名或删除模板。"
          data-sop-steps="先确认当前采购应用类型|打开模板库|预览或选择模板|只删除确认废弃的模板|回到单据页重新选择模板并复核显示效果"
          @click="openTemplateManager"
        >模板库</el-button>
        <el-button
          type="primary"
          data-sop-action="detail-ai-form"
          data-sop-title="AI生成表单"
          data-sop-desc="用 AI 辅助生成当前采购单据模板或字段建议，生成后必须人工复核。"
          data-sop-steps="先确认当前应用是供应商、需求、订单还是到货|点击 AI生成表单|检查生成字段是否符合采购业务|删除不需要的字段并补齐关键项|保存前由采购负责人复核"
          data-sop-risk="AI 只能辅助生成模板，不能代替采购审批、供应商评审和入库质检判断。"
          @click="openAiFormAssistant"
        >AI生成表单</el-button>
        <el-button
          type="primary"
          plain
          data-sop-action="detail-print-doc"
          data-sop-title="打印单据"
          data-sop-desc="按当前模板打印或导出当前采购单据。"
          data-sop-steps="先确认模板、供应商、物料、数量、价格和交期|点击打印单据|检查打印预览中的页边距、字段和签字栏|打印或导出 PDF 后按制度留档"
          @click="printDoc"
        >打印单据</el-button>
        <el-button
          type="primary"
          plain
          data-sop-action="detail-business-flow"
          data-sop-title="查看采购业务流程"
          data-sop-desc="查看当前采购单据与销售订单、采购需求、采购订单、到货和入库之间的链路。"
          data-sop-steps="先确认当前单据对象|点击业务流程|查看上游、当前和下游单据状态|已有下游单据时优先查看不要重复生成|需要撤销时先确认下游是否已处理"
          @click="openBusinessFlowDialog"
        >业务流程</el-button>
        <el-button
          type="success"
          :loading="saving"
          data-sop-action="detail-save-doc"
          data-sop-title="保存单据修改"
          data-sop-desc="保存当前采购单据正文、扩展字段和附件，保存前必须复核供应商、物料、数量、价格、交期和状态。"
          data-sop-steps="先复核供应商、物料、数量、价格、交期、状态和负责人|检查必填项和风险提示|确认附件已上传且内容正确|点击保存修改|保存后回到表格搜索该记录复核状态"
          data-sop-risk="保存后请回到采购表格搜索该单据，确认业务状态、单据链路和下游处理结果都正确。"
          @click="saveDoc"
        >保存修改</el-button>
      </div>
    </div>

    <div v-if="businessActions.length" class="action-strip" data-guide="detail-business-actions">
      <el-button
        v-for="action in businessActions"
        :key="action.key"
        :type="action.type || 'primary'"
        :plain="action.plain !== false"
        :loading="detailActionLoading"
        :data-sop-action="action.sopAction"
        :data-sop-title="action.sopTitle"
        :data-sop-desc="action.sopDesc"
        :data-sop-steps="action.sopSteps"
        :data-sop-risk="action.sopRisk"
        @click="action.handler"
      >
        {{ action.label }}
      </el-button>
    </div>

    <div class="form-container" v-loading="loading" ref="docContainerRef" data-guide="form-wrapper">
      <EisDocumentEngine
        v-if="formData && activeSchema"
        :model-value="formModel"
        @update:modelValue="handleFormUpdate"
        :schema="activeSchema"
        :file-options="fileOptions"
        :columns="allColumns"
      />
      <el-empty v-else description="正在加载数据或配置..." />
    </div>

    <el-dialog v-model="templateManagerVisible" title="采购模板库" width="860px">
      <div class="template-toolbar">
        <span class="template-tip">当前应用模板独立保存，可预览、改名或删除</span>
        <el-button type="primary" size="small" @click="openTemplateCreate">新增模板</el-button>
      </div>
      <el-table :data="templates" size="small" border style="width: 100%">
        <el-table-column prop="name" label="模板名称" min-width="200" />
        <el-table-column prop="id" label="编号" min-width="180" />
        <el-table-column label="更新时间" width="170">
          <template #default="scope">
            {{ formatTemplateTime(scope.row.updated_at || scope.row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320" align="center">
          <template #default="scope">
            <div class="template-actions">
              <el-button size="small" plain @click="openTemplatePreview(scope.row)">预览</el-button>
              <el-button size="small" type="primary" @click="setCurrentTemplate(scope.row)">使用</el-button>
              <el-button size="small" type="warning" plain @click="openTemplateRename(scope.row)">改名</el-button>
              <el-button size="small" type="danger" @click="removeTemplate(scope.row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="templateEditVisible" :title="templateEditTitle" width="420px">
      <el-form :model="templateEditForm" label-width="90px">
        <el-form-item label="模板名称">
          <el-input v-model="templateEditForm.name" placeholder="如：采购订单单据" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="templateEditVisible = false">取消</el-button>
        <el-button type="primary" :loading="templateSaving" @click="submitTemplateEdit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="templatePreviewVisible" title="模板预览" width="980px">
      <div class="template-preview-body">
        <EisDocumentEngine
          v-if="templatePreview"
          :model-value="formModel || {}"
          :schema="templatePreview.schema"
          :file-options="fileOptions"
          :columns="allColumns"
          :readonly="true"
        />
        <el-empty v-else description="暂无可预览的模板" />
      </div>
    </el-dialog>

    <el-dialog
      v-model="businessFlowVisible"
      title="采购业务流程"
      width="920px"
      append-to-body
      destroy-on-close
      @closed="resetBusinessFlowDialog"
    >
      <div
        class="business-flow-dialog"
        data-guide="flow-wrapper"
        data-sop-flow="purchase-detail-flow"
        data-sop-title="采购单据链路查看流程"
        data-sop-desc="查看当前采购单据与销售订单、采购需求、采购订单、到货和入库之间的上下游链路。"
        data-sop-steps="先确认当前采购单据对象|查看链路中每个节点是否已有单号|已有下游单据时优先查看下游结果|需要撤销时先确认下游没有继续生成单据|撤销后回到上下游应用分别复核状态"
        data-sop-risk="采购链路撤销必须从下游逐级反审核，不能在已有采购订单、到货或入库后直接撤销上游销售下推。"
        v-loading="flowLoading"
      >
        <div class="flow-chain" data-guide="flow-chain">
          <div
            v-for="node in purchaseFlowNodes"
            :key="node.key"
            class="flow-step"
            :class="{ active: !!node.docNo, current: node.current }"
          >
            <span class="step-type">{{ node.type }}</span>
            <strong>{{ node.docNo || '未生成' }}</strong>
            <small>{{ node.status || '待流转' }}</small>
          </div>
        </div>
        <div class="flow-actions" data-guide="flow-actions">
          <el-button
            type="warning"
            data-guide="flow-confirm"
            data-sop-action="purchase-detail-reverse-sales-flow"
            data-sop-title="撤销销售下推"
            data-sop-desc="从采购需求详情撤销销售订单下推关系，仅在未生成下游采购订单时允许。"
            data-sop-steps="先检查链路中是否已有采购订单、到货或入库|确认允许撤销后点击反审核/撤销销售下推|等待系统解除来源关系|回到销售订单和采购需求分别复核状态"
            data-sop-risk="已有下游单据时不能直接撤销，必须从采购入库、到货、采购订单逐级反审核。"
            :disabled="!canReverseSalesDemandFlow"
            :loading="flowActionLoading"
            @click="reverseSalesDemandFromPurchase"
          >
            反审核/撤销销售下推
          </el-button>
        </div>
        <el-alert
          v-if="!canReverseSalesDemandFlow && purchaseFlowDocs.salesOrder"
          data-guide="flow-risk"
          title="当前采购需求已生成下游采购订单时，需先反审核下游单据后才能撤销销售下推。"
          type="warning"
          show-icon
          :closable="false"
        />
        <div class="flow-doc-panel" data-guide="flow-risk">
          <div class="flow-doc-card">
            <span>上一个应用单据</span>
            <strong>{{ purchaseFlowDocs.salesOrder?.order_no || '无' }}</strong>
            <small>{{ purchaseFlowDocs.salesOrder?.customer_name || '销售订单来源' }}</small>
          </div>
          <div class="flow-doc-card">
            <span>当前单据</span>
            <strong>{{ docMainName }}</strong>
            <small>{{ detailConfig.name }}</small>
          </div>
          <div class="flow-doc-card">
            <span>采购入库</span>
            <strong>{{ purchaseFlowDocs.inventoryInbound?.inbound_no || purchaseFlowDocs.inventoryInbound?.docNo || '未生成' }}</strong>
            <small>{{ purchaseFlowDocs.purchaseArrival?.arrival_status || '待流转' }}</small>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/utils/request'
import { pushAiContext, pushAiCommand } from '@/utils/ai-context'
import { findPurchaseApp, SUPPLIER_COLUMNS } from '@/utils/purchase-apps'
import { hasPerm } from '@/utils/permission'
import {
  applyDocumentFormulaUpdates,
  buildDocumentAgentContext,
  buildDocumentFormPrompt
} from '@shared/eis-document-agent-context'
import { applyPurchaseColumnPolicies } from '@/utils/business-status'
import {
  DOC_TYPES,
  RELATION_TYPES,
  createDocumentLinkPayload,
  tryCreateDocumentAudit,
  tryCreateDocumentLink
} from '@/utils/business-flow'
import {
  buildPurchaseDocumentActionAvailability,
  buildPurchaseDocumentBusinessActions,
  buildPurchaseDocumentPermissionKeys
} from '@/domain/purchase-document-detail-action-policy.js'
import {
  buildPurchaseDocumentFallbackSchema
} from '@/domain/purchase-document-detail-schema-policy.js'
import {
  buildPurchaseDocumentFileColumnPayload,
  getPurchaseDocumentFieldValue,
  sanitizePurchaseDocumentCascaderValues
} from '@/domain/purchase-document-detail-field-policy.js'
import {
  applyPurchaseDocumentTemplateScope,
  normalizePurchaseDocumentTemplates,
  selectPurchaseDocumentTemplateId
} from '@/domain/purchase-document-detail-template-policy.js'
import {
  buildPurchaseDocumentManualTemplate,
  removePurchaseDocumentTemplate,
  renamePurchaseDocumentTemplate
} from '@/domain/purchase-document-detail-template-edit-policy.js'
import {
  buildPurchaseArrivalExceptionPatch,
  buildPurchaseDemandClosePatch,
  buildPurchaseDemandReopenPatch,
  buildPurchaseDemandSubmitPatch,
  buildPurchaseOrderCancelPatch,
  buildPurchaseOrderConfirmPatch,
  buildPurchaseSupplierPausePatch,
  buildPurchaseSupplierResumePatch,
  buildPurchaseSupplierReviewPatch
} from '@/domain/purchase-document-detail-status-policy.js'
import {
  buildPurchaseDetailArrivalDraft,
  buildPurchaseDetailInboundPatch,
  calculatePurchaseDetailPendingArrivalQuantity,
  resolvePurchaseDetailAcceptedQuantity,
  resolvePurchaseDetailLinkedArrivalQuantity
} from '@/domain/purchase-document-detail-quantity-policy.js'
import {
  buildPurchaseOrderDraft,
  buildPurchaseOrderDuplicateQuery
} from '@/domain/purchase-document-detail-order-policy.js'
import {
  buildPurchaseArrivalOrderLinkPatch,
  buildPurchaseArrivalOrderLookupQuery,
  selectPurchaseArrivalLinkOrder
} from '@/domain/purchase-document-detail-arrival-link-policy.js'
import {
  buildPurchaseDocumentFlowNodes,
  buildPurchaseDocumentLinkQuery,
  buildPurchaseDocumentRowsQuery,
  buildPurchaseInventoryInboundProjection,
  canReversePurchaseSalesDemandFlow,
  encodePurchaseDocumentFilterValue,
  pickPurchaseDocumentRowForLinkSource,
  pickPurchaseDocumentRowForLinkTarget
} from '@/domain/purchase-document-detail-business-flow-policy.js'
import {
  buildPurchaseDocumentFormValueKey,
  buildPurchaseDocumentFormValuesQuery,
  buildPurchaseDocumentSavePayload,
  splitPurchaseDocumentFormUpdate
} from '@/domain/purchase-document-detail-form-policy.js'
import EisDocumentEngine from '@/components/eis-document-engine/EisDocumentEngine.vue'

const props = defineProps({
  id: { type: [String, Number], required: true }
})

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const saving = ref(false)
const detailActionLoading = ref(false)
const formData = ref(null)
const templates = ref([])
const selectedTemplateId = ref('')
const extraValues = ref({})
const dynamicColumns = ref([])
const docContainerRef = ref(null)
const templateManagerVisible = ref(false)
const templateEditVisible = ref(false)
const templatePreviewVisible = ref(false)
const templateSaving = ref(false)
const businessFlowVisible = ref(false)
const flowLoading = ref(false)
const flowActionLoading = ref(false)
const purchaseFlowDocs = ref({})
const purchaseFlowRelationLinks = ref([])
const templateEditMode = ref('create')
const templatePreview = ref(null)
const templateEditForm = ref({ id: '', name: '' })

const appKey = computed(() => (route.query.appKey ? String(route.query.appKey) : 'suppliers'))
const appConfig = computed(() => findPurchaseApp(appKey.value) || findPurchaseApp('suppliers'))

const normalizeStaticColumns = (cols) => (
  Array.isArray(cols) ? cols.map(col => ({ ...col, type: col.type || 'text' })) : []
)

const detailConfig = computed(() => ({
  key: appConfig.value?.key || 'suppliers',
  name: appConfig.value?.name || '采购单据',
  apiUrl: appConfig.value?.apiUrl || '/purchase_suppliers',
  writeUrl: appConfig.value?.writeUrl || appConfig.value?.apiUrl || '/purchase_suppliers',
  configKey: appConfig.value?.configKey || 'purchase_suppliers_cols',
  supportsProperties: appConfig.value?.includeProperties !== false,
  staticColumns: normalizeStaticColumns(appConfig.value?.staticColumns || SUPPLIER_COLUMNS),
  defaultExtraColumns: appConfig.value?.defaultExtraColumns || [],
  ops: appConfig.value?.ops || {},
  businessOps: appConfig.value?.businessOps || {}
}))

const supportsProperties = computed(() => detailConfig.value.supportsProperties !== false)
const staticColumns = computed(() => applyPurchaseColumnPolicies(detailConfig.value.key, detailConfig.value.staticColumns))
const templateLibraryKey = computed(() => `purchase_${detailConfig.value.key}_form_templates`)
const templateScope = computed(() => ({
  app: 'purchase',
  key: detailConfig.value.key || 'purchase_document',
  configKey: detailConfig.value.configKey || '',
  apiUrl: detailConfig.value.apiUrl || '',
  templateLibraryKey: templateLibraryKey.value
}))
const templateEditTitle = computed(() => (templateEditMode.value === 'rename' ? '修改模板名称' : '新增模板'))
const pageTitle = computed(() => `${detailConfig.value.name}单据`)

const formModel = computed(() => {
  if (!formData.value) return null
  const base = { ...formData.value }
  if (supportsProperties.value) {
    base.properties = {
      ...(formData.value.properties || {}),
      ...(extraValues.value || {})
    }
  } else {
    base.properties = { ...(extraValues.value || {}) }
  }
  return base
})

const knownPropertyKeys = computed(() => {
  if (!supportsProperties.value) return new Set()
  return new Set(dynamicColumns.value.map(col => col?.prop).filter(Boolean))
})

const allColumns = computed(() => getAllColumns())

const docMainName = computed(() => {
  const row = formData.value || {}
  return row.name || row.supplier_name || row.material_name || row.order_no || row.demand_no || row.arrival_no || '采购单据'
})
const purchaseFlowNodes = computed(() => buildPurchaseDocumentFlowNodes({
  docs: purchaseFlowDocs.value,
  currentKey: detailConfig.value.key
}))
const canReverseSalesDemandFlow = computed(() => canReversePurchaseSalesDemandFlow({
  docs: purchaseFlowDocs.value,
  permitted: hasPerm('op:business_flow.reverse')
}))

const fileOptions = computed(() => {
  if (!formData.value) return []
  const propsData = supportsProperties.value ? (formData.value.properties || {}) : (extraValues.value || {})
  return dynamicColumns.value
    .filter(col => col.type === 'file')
    .map(col => {
      const rawFiles = Array.isArray(propsData[col.prop]) ? propsData[col.prop] : []
      const files = rawFiles
        .map(file => ({
          name: file?.name || file?.fileName || file?.filename || '文件',
          url: file?.dataUrl || file?.url || file?.file_url || '',
          id: file?.id || ''
        }))
        .filter(file => file.url)
      return { field: col.prop, label: col.label, files }
    })
})

const row = computed(() => formData.value || {})
const actionPermissionKeys = computed(() => buildPurchaseDocumentPermissionKeys({
  ops: detailConfig.value.ops,
  businessOps: detailConfig.value.businessOps
}))
const actionPermissions = computed(() => Object.fromEntries(
  Object.entries(actionPermissionKeys.value).map(([key, permission]) => [key, hasPerm(permission)])
))
const actionAvailability = computed(() => buildPurchaseDocumentActionAvailability({
  appKey: detailConfig.value.key,
  row: row.value,
  permissions: actionPermissions.value
}))

const businessActions = computed(() => buildPurchaseDocumentBusinessActions({
  appKey: detailConfig.value.key,
  availability: actionAvailability.value,
  handlers: {
    reviewSupplier,
    pauseSupplier,
    resumeSupplier,
    submitDemand: submitPurchaseDemand,
    createOrder: createOrderFromDemand,
    closeDemand: closePurchaseDemand,
    reopenDemand: reopenPurchaseDemand,
    confirmOrder: confirmPurchaseOrder,
    cancelOrder: cancelPurchaseOrder,
    registerArrival: registerArrivalFromOrder,
    linkArrival: linkArrivalToOrder,
    confirmInbound: confirmArrivalInbound,
    markException: markArrivalException,
    related: goRelatedApp
  }
}))

const buildFallbackSchema = () => {
  return buildPurchaseDocumentFallbackSchema({
    appKey: detailConfig.value.key,
    pageTitle: pageTitle.value,
    scope: templateScope.value,
    staticColumns: staticColumns.value,
    dynamicColumns: dynamicColumns.value
  })
}

const activeSchema = computed(() => {
  const current = templates.value.find(item => item.id === selectedTemplateId.value)
  return current?.schema || buildFallbackSchema()
})

const todayText = () => new Date().toISOString().slice(0, 10)
const nextDocNo = (prefix) => `${prefix}${Date.now().toString().slice(-8)}`
const resolveWriteUrl = () => {
  const url = detailConfig.value.writeUrl || detailConfig.value.apiUrl || ''
  return url.split('?')[0]
}
const detailFormValueKey = computed(() => buildPurchaseDocumentFormValueKey({
  templateLibraryKey: templateLibraryKey.value,
  templateId: selectedTemplateId.value
}))

const writeFlowAudit = async ({ actionType, source, target, reason = '', payload = {} }) => {
  await tryCreateDocumentAudit({
    action_type: actionType,
    source_doc_type: source?.docType || '',
    source_doc_id: source?.docId || null,
    source_doc_no: source?.docNo || '',
    target_doc_type: target?.docType || '',
    target_doc_id: target?.docId || null,
    target_doc_no: target?.docNo || '',
    reason,
    actor_username: 'admin',
    payload
  })
}

const loadPurchaseDocumentRows = async (params) => {
  const url = buildPurchaseDocumentRowsQuery(params)
  if (!url) return []
  const rows = await request({
    url,
    method: 'get',
    headers: { 'Accept-Profile': 'public' },
    silentError: true
  })
  return Array.isArray(rows) ? rows : []
}

const resetBusinessFlowDialog = () => {
  purchaseFlowDocs.value = {}
  purchaseFlowRelationLinks.value = []
  flowLoading.value = false
  flowActionLoading.value = false
}

const loadPurchaseBusinessFlow = async () => {
  const current = row.value
  if (!current?.id) return
  flowLoading.value = true
  try {
    let purchaseDemand = detailConfig.value.key === 'demands' ? current : null
    let purchaseOrder = detailConfig.value.key === 'orders' ? current : null
    let purchaseArrival = detailConfig.value.key === 'arrivals' ? current : null
    let salesOrder = null
    let inventoryInbound = null
    const collectedLinks = []

    if (purchaseArrival && !purchaseOrder) {
      const links = await request({
        url: `/document_links?${buildPurchaseDocumentLinkQuery({ direction: 'target', docType: DOC_TYPES.PURCHASE_ARRIVAL, docId: purchaseArrival.id, docNo: purchaseArrival.arrival_no })}&select=*`,
        method: 'get',
        headers: { 'Accept-Profile': 'public' },
        silentError: true
      }).catch(() => [])
      collectedLinks.push(...(links || []))
      const orderLink = (links || []).find((link) => link.source_doc_type === DOC_TYPES.PURCHASE_ORDER)
      const orders = await loadPurchaseDocumentRows({
        table: 'purchase_orders',
        noField: 'order_no',
        ids: orderLink ? [orderLink.source_doc_id] : [purchaseArrival.order_id],
        nos: orderLink ? [orderLink.source_doc_no] : [purchaseArrival.order_no]
      })
      purchaseOrder = pickPurchaseDocumentRowForLinkSource(orders, orderLink, 'order_no')
    }

    if (purchaseOrder && !purchaseDemand) {
      const links = await request({
        url: `/document_links?${buildPurchaseDocumentLinkQuery({ direction: 'target', docType: DOC_TYPES.PURCHASE_ORDER, docId: purchaseOrder.id, docNo: purchaseOrder.order_no })}&select=*`,
        method: 'get',
        headers: { 'Accept-Profile': 'public' },
        silentError: true
      }).catch(() => [])
      collectedLinks.push(...(links || []))
      const demandLink = (links || []).find((link) => link.source_doc_type === DOC_TYPES.PURCHASE_DEMAND)
      const demands = await loadPurchaseDocumentRows({
        table: 'purchase_demands',
        noField: 'demand_no',
        ids: demandLink ? [demandLink.source_doc_id] : [purchaseOrder.demand_id],
        nos: demandLink ? [demandLink.source_doc_no] : [purchaseOrder.source_demand_no]
      })
      purchaseDemand = pickPurchaseDocumentRowForLinkSource(demands, demandLink, 'demand_no')
    }

    if (purchaseDemand) {
      const salesLinks = await request({
        url: `/document_links?${buildPurchaseDocumentLinkQuery({ direction: 'target', docType: DOC_TYPES.PURCHASE_DEMAND, docId: purchaseDemand.id, docNo: purchaseDemand.demand_no })}&select=*`,
        method: 'get',
        headers: { 'Accept-Profile': 'public' },
        silentError: true
      }).catch(() => [])
      collectedLinks.push(...(salesLinks || []))
      const salesLink = (salesLinks || []).find((link) => link.source_doc_type === DOC_TYPES.SALES_ORDER)
      const salesRows = await loadPurchaseDocumentRows({
        table: 'sales_orders',
        noField: 'order_no',
        ids: salesLink ? [salesLink.source_doc_id] : [purchaseDemand.properties?.source_order_id],
        nos: salesLink ? [salesLink.source_doc_no] : [purchaseDemand.properties?.source_order_no]
      })
      salesOrder = pickPurchaseDocumentRowForLinkSource(salesRows, salesLink, 'order_no')
    }

    if (purchaseDemand && !purchaseOrder) {
      const links = await request({
        url: `/document_links?${buildPurchaseDocumentLinkQuery({ direction: 'source', docType: DOC_TYPES.PURCHASE_DEMAND, docId: purchaseDemand.id, docNo: purchaseDemand.demand_no })}&select=*`,
        method: 'get',
        headers: { 'Accept-Profile': 'public' },
        silentError: true
      }).catch(() => [])
      collectedLinks.push(...(links || []))
      const orderLink = (links || []).find((link) => link.target_doc_type === DOC_TYPES.PURCHASE_ORDER)
      const orders = await loadPurchaseDocumentRows({
        table: 'purchase_orders',
        noField: 'order_no',
        ids: orderLink ? [orderLink.target_doc_id] : [],
        nos: orderLink ? [orderLink.target_doc_no] : []
      })
      purchaseOrder = pickPurchaseDocumentRowForLinkTarget(orders, orderLink, 'order_no')
    }

    if (purchaseOrder && !purchaseArrival) {
      const links = await request({
        url: `/document_links?${buildPurchaseDocumentLinkQuery({ direction: 'source', docType: DOC_TYPES.PURCHASE_ORDER, docId: purchaseOrder.id, docNo: purchaseOrder.order_no })}&select=*`,
        method: 'get',
        headers: { 'Accept-Profile': 'public' },
        silentError: true
      }).catch(() => [])
      collectedLinks.push(...(links || []))
      const arrivalLink = (links || []).find((link) => link.target_doc_type === DOC_TYPES.PURCHASE_ARRIVAL)
      const arrivals = await loadPurchaseDocumentRows({
        table: 'purchase_arrivals',
        noField: 'arrival_no',
        ids: arrivalLink ? [arrivalLink.target_doc_id] : [],
        nos: arrivalLink ? [arrivalLink.target_doc_no] : []
      })
      purchaseArrival = pickPurchaseDocumentRowForLinkTarget(arrivals, arrivalLink, 'arrival_no')
    }

    if (purchaseArrival) {
      const links = await request({
        url: `/document_links?${buildPurchaseDocumentLinkQuery({ direction: 'source', docType: DOC_TYPES.PURCHASE_ARRIVAL, docId: purchaseArrival.id, docNo: purchaseArrival.arrival_no })}&select=*`,
        method: 'get',
        headers: { 'Accept-Profile': 'public' },
        silentError: true
      }).catch(() => [])
      collectedLinks.push(...(links || []))
      const inboundLink = (links || []).find((link) => link.target_doc_type === DOC_TYPES.INVENTORY_INBOUND)
      inventoryInbound = buildPurchaseInventoryInboundProjection(inboundLink)
    }

    purchaseFlowDocs.value = { salesOrder, purchaseDemand, purchaseOrder, purchaseArrival, inventoryInbound }
    purchaseFlowRelationLinks.value = collectedLinks
  } catch (e) {
    console.warn('load purchase business flow failed', e)
    ElMessage.warning('业务流程加载失败')
  } finally {
    flowLoading.value = false
  }
}

const openBusinessFlowDialog = async () => {
  businessFlowVisible.value = true
  await loadPurchaseBusinessFlow()
}

const reverseSalesDemandFromPurchase = async () => {
  const salesOrder = purchaseFlowDocs.value?.salesOrder
  const demand = purchaseFlowDocs.value?.purchaseDemand
  if (!salesOrder?.id || !demand?.id) return
  if (!canReverseSalesDemandFlow.value) {
    ElMessage.warning('当前链路不允许直接撤销')
    return
  }
  try {
    const result = await ElMessageBox.prompt(
      `确认撤销销售订单 ${salesOrder.order_no || salesOrder.id} 到采购需求 ${demand.demand_no || demand.id} 的下推关联？`,
      '反审核/撤销销售下推',
      {
        confirmButtonText: '确认撤销',
        cancelButtonText: '取消',
        inputPattern: /\S+/,
        inputErrorMessage: '请填写反审核原因'
      }
    )
    const reason = String(result?.value || '').trim()
    flowActionLoading.value = true
    const link = purchaseFlowRelationLinks.value.find((item) => item.relation_type === RELATION_TYPES.SALES_TO_PURCHASE_DEMAND)
    if (link?.id) {
      await request({
        url: `/document_links?id=eq.${encodePurchaseDocumentFilterValue(link.id)}`,
        method: 'patch',
        headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
        data: { status: 'reversed', reversed_by: 'purchase', reversed_at: new Date().toISOString(), reverse_reason: reason }
      })
    }
    await request({
      url: `/purchase_demands?id=eq.${encodePurchaseDocumentFilterValue(demand.id)}`,
      method: 'patch',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
      data: {
        demand_status: '已关闭',
        status: 'disabled',
        properties: {
          ...(demand.properties || {}),
          audit_status: '已反审核',
          reverse_audit_reason: reason,
          reverse_audit_at: new Date().toISOString()
        }
      }
    })
    await writeFlowAudit({
      actionType: 'reverse_sales_order_purchase_demand',
      source: { docType: DOC_TYPES.SALES_ORDER, docId: salesOrder.id, docNo: salesOrder.order_no || '' },
      target: { docType: DOC_TYPES.PURCHASE_DEMAND, docId: demand.id, docNo: demand.demand_no || '' },
      reason
    })
    ElMessage.success('已撤销销售下推关联')
    await loadData()
    await loadPurchaseBusinessFlow()
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    console.error(e)
    ElMessage.error('撤销销售下推失败')
  } finally {
    flowActionLoading.value = false
  }
}

const loadData = async () => {
  if (!props.id) return
  loading.value = true
  try {
    const res = await request({
      url: `${detailConfig.value.apiUrl}?id=eq.${props.id}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    if (Array.isArray(res) && res.length > 0) {
      formData.value = res[0]
      if (supportsProperties.value && !formData.value.properties) formData.value.properties = {}
      applyFormulaUpdates(formData.value)
    } else {
      formData.value = null
      ElMessage.warning('未找到单据数据')
    }
  } catch (e) {
    console.error(e)
    ElMessage.error('数据加载失败')
  } finally {
    loading.value = false
  }
}

const loadTemplates = async () => {
  try {
    const res = await request({
      url: `/system_configs?key=eq.${templateLibraryKey.value}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    const list = res && res.length > 0 ? (res[0].value || []) : []
    templates.value = normalizePurchaseDocumentTemplates(list, templateScope.value)
    if (!selectedTemplateId.value && templates.value.length > 0) {
      selectedTemplateId.value = templates.value[0].id
    }
  } catch (e) {
    templates.value = []
  }
}

const saveTemplateLibrary = async (list) => {
  return request({
    url: '/system_configs',
    method: 'post',
    headers: {
      'Accept-Profile': 'public',
      'Content-Profile': 'public',
      'Prefer': 'resolution=merge-duplicates'
    },
    data: { key: templateLibraryKey.value, value: list }
  })
}

const handleTemplatesUpdated = (event) => {
  const eventKey = event?.detail?.templateLibraryKey || event?.detail?.key || 'form_templates'
  if (eventKey !== templateLibraryKey.value) return
  const list = event?.detail?.templates
  if (Array.isArray(list)) {
    const filtered = normalizePurchaseDocumentTemplates(list, templateScope.value)
    templates.value = filtered
    selectedTemplateId.value = selectPurchaseDocumentTemplateId({
      recordId: event?.detail?.record?.id,
      currentId: selectedTemplateId.value,
      templates: filtered
    })
  } else {
    loadTemplates()
  }
}

const loadDynamicColumns = async () => {
  try {
    const res = await request({
      url: `/system_configs?key=eq.${detailConfig.value.configKey}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    if (res && res.length > 0 && Array.isArray(res[0].value)) {
      dynamicColumns.value = res[0].value
    } else {
      dynamicColumns.value = detailConfig.value.defaultExtraColumns || []
    }
  } catch (e) {
    dynamicColumns.value = detailConfig.value.defaultExtraColumns || []
  }
}

const loadFormValues = async () => {
  if (!formData.value?.id || !selectedTemplateId.value) {
    extraValues.value = {}
    return
  }
  try {
    const res = await request({
      url: buildPurchaseDocumentFormValuesQuery({
        rowId: formData.value.id,
        templateLibraryKey: templateLibraryKey.value,
        templateId: selectedTemplateId.value
      }),
      method: 'get',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
    })
    extraValues.value = Array.isArray(res) && res.length > 0 ? (res[0].payload || {}) : {}
  } catch (e) {
    extraValues.value = {}
  }
}

const saveFormValues = async () => {
  if (!formData.value?.id || !selectedTemplateId.value) return
  try {
    await request({
      url: '/form_values?on_conflict=template_id,row_id',
      method: 'post',
      headers: {
        'Accept-Profile': 'public',
        'Content-Profile': 'public',
        'Prefer': 'resolution=merge-duplicates'
      },
      data: {
        row_id: String(formData.value.id),
        template_id: detailFormValueKey.value,
        payload: extraValues.value || {}
      }
    })
  } catch (e) {
    ElMessage.warning('扩展字段保存失败')
  }
}

const handleFormUpdate = (nextValue) => {
  if (!nextValue || !formData.value) return
  sanitizePurchaseDocumentCascaderValues(nextValue, dynamicColumns.value)
  const { rowPatch, properties, extraValues: nextExtraValues } = splitPurchaseDocumentFormUpdate({
    currentRow: formData.value,
    nextValue,
    knownKeys: knownPropertyKeys.value,
    supportsProperties: supportsProperties.value
  })
  Object.assign(formData.value, rowPatch)
  if (supportsProperties.value) formData.value.properties = properties
  extraValues.value = nextExtraValues
  applyFormulaUpdates(formData.value)
}

const getAllColumns = () => ([
  ...(staticColumns.value || []),
  ...applyPurchaseColumnPolicies(detailConfig.value.key, dynamicColumns.value.map(col => ({
    ...col,
    label: col.label,
    prop: col.prop,
    type: col.type || 'text'
  })))
])

const applyFormulaUpdates = (rowData) => {
  applyDocumentFormulaUpdates({
    rowData,
    staticColumns: staticColumns.value,
    dynamicColumns: dynamicColumns.value
  })
}

const buildAiFormPrompt = () => {
  const columns = getAllColumns()
  const model = formModel.value || formData.value
  columns.forEach(col => getPurchaseDocumentFieldValue(model, col.prop))
  buildPurchaseDocumentFileColumnPayload(columns, model)
  return buildDocumentFormPrompt({
    title: detailConfig.value.name || '采购单据',
    columns,
    rowData: model
  })
}

const syncAiContext = () => {
  const columns = getAllColumns()
  pushAiContext(buildDocumentAgentContext({
    app: 'purchase',
    view: detailConfig.value.key || 'purchase_document',
    viewName: detailConfig.value.name || '',
    apiUrl: detailConfig.value.apiUrl,
    writeUrl: detailConfig.value.writeUrl || detailConfig.value.apiUrl,
    rowId: formData.value?.id,
    rowData: formModel.value || formData.value,
    columns,
    staticColumns: staticColumns.value,
    dynamicColumns: dynamicColumns.value,
    templateScope: templateScope.value,
    templateLibraryKey: templateLibraryKey.value,
    aiScene: 'form',
    allowImport: false
  }))
}

const openAiFormAssistant = () => {
  if (!formData.value) {
    ElMessage.warning('请先加载采购单据')
    return
  }
  if (!getAllColumns().length) {
    ElMessage.warning('未找到表格列信息')
    return
  }
  syncAiContext()
  pushAiCommand({
    id: `purchase_form_${Date.now()}`,
    type: 'open-worker',
    prompt: buildAiFormPrompt()
  })
}

const openTemplateManager = () => {
  templateManagerVisible.value = true
}

const openTemplatePreview = (template) => {
  templatePreview.value = template || null
  templatePreviewVisible.value = true
}

const openTemplateCreate = () => {
  templateEditMode.value = 'create'
  templateEditForm.value = {
    id: '',
    name: activeSchema.value?.title || '采购单据模板'
  }
  templateEditVisible.value = true
}

const openTemplateRename = (template) => {
  templateEditMode.value = 'rename'
  templateEditForm.value = {
    id: template?.id || '',
    name: template?.name || template?.schema?.title || ''
  }
  templateEditVisible.value = true
}

const setCurrentTemplate = (template) => {
  if (!template?.id) return
  selectedTemplateId.value = template.id
  ElMessage.success('已切换模板')
}

const submitTemplateEdit = async () => {
  const name = templateEditForm.value.name ? templateEditForm.value.name.trim() : ''
  if (!name) {
    ElMessage.warning('请输入模板名称')
    return
  }
  templateSaving.value = true
  try {
    const list = Array.isArray(templates.value) ? [...templates.value] : []
    const now = new Date().toISOString()
    if (templateEditMode.value === 'rename') {
      list.splice(0, list.length, ...renamePurchaseDocumentTemplate({
        templates: list,
        templateId: templateEditForm.value.id,
        name,
        updatedAt: now,
        scope: templateScope.value,
        applyScope: applyPurchaseDocumentTemplateScope
      }))
    } else {
      const templateId = `purchase_${detailConfig.value.key}_${Date.now()}`
      const record = buildPurchaseDocumentManualTemplate({
        id: templateId,
        name,
        schema: buildFallbackSchema(),
        now,
        scope: templateScope.value,
        applyScope: applyPurchaseDocumentTemplateScope
      })
      list.unshift(record)
      selectedTemplateId.value = record.id
    }
    await saveTemplateLibrary(list)
    templates.value = list
    templateEditVisible.value = false
    ElMessage.success('模板已保存')
  } catch (e) {
    ElMessage.error('模板保存失败')
  } finally {
    templateSaving.value = false
  }
}

const removeTemplate = async (template) => {
  if (!template?.id) return
  try {
    await ElMessageBox.confirm('确定删除这个模板吗？删除后无法恢复。', '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消'
    })
  } catch (e) {
    return
  }
  try {
    const result = removePurchaseDocumentTemplate({
      templates: templates.value,
      templateId: template.id,
      selectedId: selectedTemplateId.value
    })
    await saveTemplateLibrary(result.templates)
    templates.value = result.templates
    selectedTemplateId.value = result.selectedId
    ElMessage.success('模板已删除')
  } catch (e) {
    ElMessage.error('模板删除失败')
  }
}

const formatTemplateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

const saveDoc = async () => {
  if (!formData.value?.id) return
  saving.value = true
  try {
    applyFormulaUpdates(formData.value)
    await request({
      url: `${resolveWriteUrl()}?id=eq.${props.id}`,
      method: 'patch',
      headers: { 'Content-Profile': 'public', 'Accept-Profile': 'public' },
      data: buildPurchaseDocumentSavePayload({
        row: formData.value,
        supportsProperties: supportsProperties.value
      })
    })
    await saveFormValues()
    ElMessage.success('保存成功')
    await loadData()
  } catch (e) {
    console.error(e)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

const patchAndReload = async (url, data, successText, errorText) => {
  detailActionLoading.value = true
  try {
    await request({
      url,
      method: 'patch',
      headers: { 'Content-Profile': 'public', 'Accept-Profile': 'public' },
      data
    })
    ElMessage.success(successText)
    await loadData()
  } catch (e) {
    console.error(e)
    ElMessage.error(errorText)
  } finally {
    detailActionLoading.value = false
  }
}

const reviewSupplier = async () => {
  if (!row.value.id) return
  await patchAndReload(`/purchase_suppliers?id=eq.${row.value.id}`, buildPurchaseSupplierReviewPatch({
    row: row.value,
    reviewDate: todayText(),
    reviewedAt: new Date().toISOString()
  }), '已完成供应商评审', '供应商评审失败')
}

const pauseSupplier = async () => {
  if (!row.value.id) return
  try {
    const result = await ElMessageBox.prompt(
      `请输入暂停合作原因，供应商 ${row.value.name || row.value.supplier_no || row.value.id} 将不可继续用于新采购。`,
      '暂停供应商合作',
      {
        confirmButtonText: '暂停合作',
        cancelButtonText: '取消',
        inputValue: row.value.properties?.pause_reason || '',
        inputPattern: /\S+/,
        inputErrorMessage: '请填写暂停原因'
      }
    )
    const pauseReason = String(result?.value || '').trim()
    await patchAndReload(`/purchase_suppliers?id=eq.${row.value.id}`, buildPurchaseSupplierPausePatch({
      row: row.value,
      reason: pauseReason,
      pausedAt: new Date().toISOString()
    }), '已暂停供应商合作', '暂停供应商失败')
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    console.error(e)
    ElMessage.error('暂停供应商失败')
  }
}

const resumeSupplier = async () => {
  if (!row.value.id) return
  try {
    await ElMessageBox.confirm(
      `恢复供应商 ${row.value.name || row.value.supplier_no || row.value.id} 的合作状态？`,
      '恢复供应商合作',
      { type: 'warning', confirmButtonText: '恢复合作', cancelButtonText: '取消' }
    )
    await patchAndReload(`/purchase_suppliers?id=eq.${row.value.id}`, buildPurchaseSupplierResumePatch({
      row: row.value,
      resumedAt: new Date().toISOString()
    }), '已恢复供应商合作', '恢复供应商失败')
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    console.error(e)
    ElMessage.error('恢复供应商失败')
  }
}

const ensureOrderSupplierActive = async (orderRow) => {
  const supplierId = orderRow?.supplier_id
  const supplierName = String(orderRow?.supplier_name || '').trim()
  if (!supplierId && (!supplierName || supplierName === '待选择供应商')) {
    ElMessage.warning('请先选择合作中的供应商')
    return false
  }
  const query = supplierId
    ? `id=eq.${supplierId}`
    : `name=eq.${encodeURIComponent(supplierName)}`
  const suppliers = await request({
    url: `/purchase_suppliers?${query}&select=id,name,supplier_status,status&limit=1`,
    method: 'get',
    headers: { 'Accept-Profile': 'public' }
  })
  const supplier = Array.isArray(suppliers) && suppliers.length > 0 ? suppliers[0] : null
  if (!supplier) {
    ElMessage.warning(`未找到供应商“${supplierName}”的有效档案，请先维护供应商档案`)
    return false
  }
  const active = supplier.supplier_status === '合作中' && supplier.status === 'active'
  if (!active) {
    ElMessage.warning(`供应商“${supplier.name || supplierName}”当前为“${supplier.supplier_status || supplier.status || '不可用'}”，不能继续执行该订单`)
  }
  return active
}

const submitPurchaseDemand = async () => {
  if (!row.value.id) return
  const quantity = Number(row.value.quantity) || 0
  if (quantity <= 0) {
    ElMessage.warning('需求数量必须大于 0')
    return
  }
  await patchAndReload(`/purchase_demands?id=eq.${row.value.id}`, buildPurchaseDemandSubmitPatch(), '已提交采购', '提交采购失败')
}

const closePurchaseDemand = async () => {
  if (!row.value.id) return
  try {
    const result = await ElMessageBox.prompt(
      `请输入关闭原因，需求 ${row.value.demand_no || row.value.id} 将不再生成采购订单。`,
      '关闭采购需求',
      {
        confirmButtonText: '关闭需求',
        cancelButtonText: '取消',
        inputValue: row.value.properties?.close_reason || '',
        inputPattern: /\S+/,
        inputErrorMessage: '请填写关闭原因'
      }
    )
    const closeReason = String(result?.value || '').trim()
    await patchAndReload(`/purchase_demands?id=eq.${row.value.id}`, buildPurchaseDemandClosePatch({
      row: row.value,
      reason: closeReason,
      closedAt: new Date().toISOString()
    }), '已关闭需求', '关闭需求失败')
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    console.error(e)
    ElMessage.error('关闭需求失败')
  }
}

const reopenPurchaseDemand = async () => {
  if (!row.value.id) return
  try {
    await ElMessageBox.confirm(
      `重新打开采购需求 ${row.value.demand_no || row.value.id}？`,
      '重新打开需求',
      { type: 'warning', confirmButtonText: '重新打开', cancelButtonText: '取消' }
    )
    await patchAndReload(`/purchase_demands?id=eq.${row.value.id}`, buildPurchaseDemandReopenPatch({
      row: row.value,
      reopenedAt: new Date().toISOString()
    }), '已重新打开需求', '重新打开需求失败')
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    console.error(e)
    ElMessage.error('重新打开需求失败')
  }
}

const createOrderFromDemand = async () => {
  if (!row.value.id) return
  detailActionLoading.value = true
  try {
    const existingOrders = await request({
      url: buildPurchaseOrderDuplicateQuery({
        demandId: row.value.id,
        demandNo: row.value.demand_no
      }),
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    if (Array.isArray(existingOrders) && existingOrders.length > 0) {
      ElMessage.warning(`该需求已生成采购订单：${existingOrders[0].order_no || existingOrders[0].id}`)
      return
    }

    let supplier = null
    const supplierName = row.value.preferred_supplier || ''
    if (supplierName) {
      const supplierRows = await request({
        url: `/purchase_suppliers?name=eq.${encodeURIComponent(supplierName)}&supplier_status=eq.合作中&status=eq.active&select=id,name,buyer_name,lead_time_days&limit=1`,
        method: 'get',
        headers: { 'Accept-Profile': 'public' }
      })
      supplier = Array.isArray(supplierRows) && supplierRows.length > 0 ? supplierRows[0] : null
      if (!supplier) {
        const blockedRows = await request({
          url: `/purchase_suppliers?name=eq.${encodeURIComponent(supplierName)}&select=id,name,supplier_status,status&limit=1`,
          method: 'get',
          headers: { 'Accept-Profile': 'public' }
        })
        const blocked = Array.isArray(blockedRows) && blockedRows.length > 0 ? blockedRows[0] : null
        if (blocked) {
          ElMessage.warning(`建议供应商当前为“${blocked.supplier_status || blocked.status || '不可用'}”，请先恢复合作或更换供应商`)
          return
        }
      }
    }

    const payload = buildPurchaseOrderDraft({
      row: row.value,
      supplier,
      orderNo: nextDocNo('PO'),
      orderDate: todayText()
    })
    const createdOrders = await request({
      url: '/purchase_orders',
      method: 'post',
      headers: { 'Content-Profile': 'public', 'Accept-Profile': 'public', Prefer: 'return=representation' },
      data: payload
    })
    const createdOrder = Array.isArray(createdOrders) ? createdOrders[0] : createdOrders
    await request({
      url: `/purchase_demands?id=eq.${row.value.id}`,
      method: 'patch',
      headers: { 'Content-Profile': 'public', 'Accept-Profile': 'public' },
      data: { demand_status: '已下单', status: 'active' }
    })
    const sourceDoc = {
      docType: DOC_TYPES.PURCHASE_DEMAND,
      docId: row.value.id,
      docNo: row.value.demand_no || ''
    }
    const targetDoc = {
      docType: DOC_TYPES.PURCHASE_ORDER,
      docId: createdOrder?.id || null,
      docNo: createdOrder?.order_no || payload.order_no
    }
    await tryCreateDocumentLink(createDocumentLinkPayload({
      source: sourceDoc,
      target: targetDoc,
      relationType: RELATION_TYPES.DEMAND_TO_ORDER,
      quantity: payload.quantity,
      amount: payload.total_amount,
      payload: { material_name: payload.material_name }
    }))
    await writeFlowAudit({
      actionType: 'create_order_from_demand',
      source: sourceDoc,
      target: targetDoc,
      payload: { material_name: payload.material_name, quantity: payload.quantity }
    })
    ElMessage.success('已生成采购订单')
    await router.push('/app/orders')
  } catch (e) {
    console.error(e)
    ElMessage.error('生成采购订单失败')
  } finally {
    detailActionLoading.value = false
  }
}

const confirmPurchaseOrder = async () => {
  if (!row.value.id) return
  const quantity = Number(row.value.quantity) || 0
  if (quantity <= 0) {
    ElMessage.warning('订单数量必须大于 0')
    return
  }
  try {
    const supplierActive = await ensureOrderSupplierActive(row.value)
    if (!supplierActive) return
    await ElMessageBox.confirm(
      `确认下达采购订单 ${row.value.order_no || row.value.id}？`,
      '确认下单',
      { type: 'warning', confirmButtonText: '确认下单', cancelButtonText: '取消' }
    )
    await patchAndReload(`/purchase_orders?id=eq.${row.value.id}`, buildPurchaseOrderConfirmPatch(), '已确认下单', '确认下单失败')
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    console.error(e)
    ElMessage.error('确认下单失败')
  }
}

const cancelPurchaseOrder = async () => {
  if (!row.value.id) return
  if ((Number(row.value.arrived_quantity) || 0) > 0) {
    ElMessage.warning('已有到货记录的订单不能取消')
    return
  }
  try {
    const result = await ElMessageBox.prompt(
      `请输入取消原因，订单 ${row.value.order_no || row.value.id} 将停止执行。`,
      '取消采购订单',
      {
        confirmButtonText: '取消订单',
        cancelButtonText: '关闭',
        inputValue: row.value.properties?.cancel_reason || '',
        inputPattern: /\S+/,
        inputErrorMessage: '请填写取消原因'
      }
    )
    const cancelReason = String(result?.value || '').trim()
    detailActionLoading.value = true
    await request({
      url: `/purchase_orders?id=eq.${row.value.id}`,
      method: 'patch',
      headers: { 'Content-Profile': 'public', 'Accept-Profile': 'public' },
      data: buildPurchaseOrderCancelPatch({
        row: row.value,
        reason: cancelReason,
        canceledAt: new Date().toISOString()
      })
    })
    if (row.value.demand_id) {
      await request({
        url: `/purchase_demands?id=eq.${row.value.demand_id}`,
        method: 'patch',
        headers: { 'Content-Profile': 'public', 'Accept-Profile': 'public' },
        data: { demand_status: '待采购', status: 'active' }
      })
    }
    ElMessage.success('已取消订单')
    await loadData()
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    console.error(e)
    ElMessage.error('取消订单失败')
  } finally {
    detailActionLoading.value = false
  }
}

const registerArrivalFromOrder = async () => {
  if (!row.value.id) return
  if (!['已下单', '部分到货'].includes(row.value.order_status)) {
    ElMessage.warning('只有已下单或部分到货的订单可以登记到货')
    return
  }
  detailActionLoading.value = true
  try {
    const supplierActive = await ensureOrderSupplierActive(row.value)
    if (!supplierActive) return
    const orderQuantity = Number(row.value.quantity) || 0
    const arrivals = await request({
      url: `/purchase_arrivals?order_id=eq.${row.value.id}&status=neq.deleted&select=arrival_quantity`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    const quantity = calculatePurchaseDetailPendingArrivalQuantity(orderQuantity, arrivals)
    if (quantity <= 0) {
      ElMessage.warning('该订单已无待到货数量')
      return
    }
    const result = await ElMessageBox.prompt(
      `请输入本次到货数量，当前待到货 ${quantity} ${row.value.unit || ''}`,
      '登记到货',
      {
        confirmButtonText: '登记到货',
        cancelButtonText: '取消',
        inputValue: String(quantity),
        inputPattern: /^(?:[1-9]\d*|0?\.\d*[1-9]\d*)$/,
        inputErrorMessage: '请输入大于 0 的数字'
      }
    )
    const arrivalQuantity = Number(result?.value)
    if (!Number.isFinite(arrivalQuantity) || arrivalQuantity <= 0) {
      ElMessage.warning('本次到货数量必须大于 0')
      return
    }
    if (arrivalQuantity > quantity) {
      ElMessage.warning(`本次到货数量不能超过待到货 ${quantity}`)
      return
    }
    const arrivalPayload = buildPurchaseDetailArrivalDraft({
      row: row.value,
      arrivalQuantity,
      arrivalNo: nextDocNo('PA'),
      arrivalDate: todayText()
    })
    const createdArrivals = await request({
      url: '/purchase_arrivals',
      method: 'post',
      headers: { 'Content-Profile': 'public', 'Accept-Profile': 'public', Prefer: 'return=representation' },
      data: arrivalPayload
    })
    const createdArrival = Array.isArray(createdArrivals) ? createdArrivals[0] : createdArrivals
    const sourceDoc = {
      docType: DOC_TYPES.PURCHASE_ORDER,
      docId: row.value.id,
      docNo: row.value.order_no || ''
    }
    const targetDoc = {
      docType: DOC_TYPES.PURCHASE_ARRIVAL,
      docId: createdArrival?.id || null,
      docNo: createdArrival?.arrival_no || arrivalPayload.arrival_no
    }
    await tryCreateDocumentLink(createDocumentLinkPayload({
      source: sourceDoc,
      target: targetDoc,
      relationType: RELATION_TYPES.ORDER_TO_ARRIVAL,
      quantity: arrivalQuantity,
      payload: { material_name: arrivalPayload.material_name }
    }))
    await writeFlowAudit({
      actionType: 'register_arrival_from_order',
      source: sourceDoc,
      target: targetDoc,
      payload: { material_name: arrivalPayload.material_name, quantity: arrivalQuantity }
    })
    ElMessage.success('已登记到货记录')
    await router.push('/app/arrivals')
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    console.error(e)
    ElMessage.error('登记到货失败')
  } finally {
    detailActionLoading.value = false
  }
}

const linkArrivalToOrder = async () => {
  if (!row.value.id) return
  if (['已入库', '异常'].includes(row.value.arrival_status) || row.value.iqc_status === '不合格') {
    ElMessage.warning('已入库或异常到货不能重新关联订单')
    return
  }
  detailActionLoading.value = true
  try {
    const orders = await request({
      url: buildPurchaseArrivalOrderLookupQuery(row.value),
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    const order = selectPurchaseArrivalLinkOrder(orders)
    if (!order?.id) {
      ElMessage.warning('未找到可关联的未到齐采购订单')
      return
    }
    const pendingQuantity = Number(order.pending_quantity) || 0
    const nextArrivalQuantity = resolvePurchaseDetailLinkedArrivalQuantity(pendingQuantity, row.value.arrival_quantity)
    await patchAndReload(`/purchase_arrivals?id=eq.${row.value.id}`, buildPurchaseArrivalOrderLinkPatch({
      row: row.value,
      order,
      arrivalQuantity: nextArrivalQuantity,
      linkedAt: new Date().toISOString()
    }), `已关联采购订单 ${order.order_no}`, '关联采购订单失败')
    const sourceDoc = {
      docType: DOC_TYPES.PURCHASE_ORDER,
      docId: order.id,
      docNo: order.order_no || ''
    }
    const targetDoc = {
      docType: DOC_TYPES.PURCHASE_ARRIVAL,
      docId: row.value.id,
      docNo: row.value.arrival_no || ''
    }
    await tryCreateDocumentLink(createDocumentLinkPayload({
      source: sourceDoc,
      target: targetDoc,
      relationType: RELATION_TYPES.ORDER_TO_ARRIVAL,
      quantity: nextArrivalQuantity,
      payload: { material_name: order.material_name || row.value.material_name || '' }
    }))
    await writeFlowAudit({
      actionType: 'link_arrival_to_order',
      source: sourceDoc,
      target: targetDoc,
      payload: { material_name: order.material_name || row.value.material_name || '', quantity: nextArrivalQuantity }
    })
  } catch (e) {
    console.error(e)
    ElMessage.error('关联采购订单失败')
  } finally {
    detailActionLoading.value = false
  }
}

const confirmArrivalInbound = async () => {
  if (!row.value.id) return
  try {
    const arrivalQuantity = Number(row.value.arrival_quantity) || 0
    if (arrivalQuantity <= 0) {
      ElMessage.warning('到货数量必须大于 0')
      return
    }
    if (row.value.iqc_status === '不合格' || row.value.arrival_status === '异常') {
      ElMessage.warning('异常到货不能直接入库')
      return
    }
    const acceptedQuantity = resolvePurchaseDetailAcceptedQuantity(arrivalQuantity, row.value.accepted_quantity)
    await ElMessageBox.confirm(
      `确认将到货单 ${row.value.arrival_no || row.value.id} 入库？合格数量为 ${acceptedQuantity}。`,
      '确认入库',
      { type: 'warning', confirmButtonText: '确认入库', cancelButtonText: '取消' }
    )
    const inboundNo = row.value.inbound_no || nextDocNo('IN')
    await patchAndReload(`/purchase_arrivals?id=eq.${row.value.id}`, buildPurchaseDetailInboundPatch({
      row: row.value,
      acceptedQuantity,
      inboundNo
    }), '已确认入库', '确认入库失败')
    const sourceDoc = {
      docType: DOC_TYPES.PURCHASE_ARRIVAL,
      docId: row.value.id,
      docNo: row.value.arrival_no || ''
    }
    const targetDoc = {
      docType: DOC_TYPES.INVENTORY_INBOUND,
      docId: null,
      docNo: inboundNo
    }
    await tryCreateDocumentLink(createDocumentLinkPayload({
      source: sourceDoc,
      target: targetDoc,
      relationType: RELATION_TYPES.ARRIVAL_TO_INBOUND,
      quantity: acceptedQuantity,
      payload: { material_name: row.value.material_name || '' }
    }))
    await writeFlowAudit({
      actionType: 'confirm_arrival_inbound',
      source: sourceDoc,
      target: targetDoc,
      payload: { material_name: row.value.material_name || '', quantity: acceptedQuantity }
    })
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    console.error(e)
    ElMessage.error('确认入库失败')
  }
}

const markArrivalException = async () => {
  if (!row.value.id) return
  try {
    const result = await ElMessageBox.prompt(
      '请输入异常说明',
      '标记到货异常',
      {
        confirmButtonText: '标记异常',
        cancelButtonText: '取消',
        inputValue: row.value.properties?.exception_note || row.value.exception_note || '',
        inputPattern: /\S+/,
        inputErrorMessage: '请填写异常说明'
      }
    )
    const exceptionNote = String(result?.value || '').trim()
    await patchAndReload(`/purchase_arrivals?id=eq.${row.value.id}`, buildPurchaseArrivalExceptionPatch({
      row: row.value,
      reason: exceptionNote
    }), '已标记异常', '标记异常失败')
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    console.error(e)
    ElMessage.error('标记异常失败')
  }
}

const goRelatedApp = () => {
  const target = detailConfig.value.key === 'demands' ? '/app/orders' : '/app/arrivals'
  router.push(target)
}

const goBack = () => {
  router.push(`/app/${detailConfig.value.key}`)
}

const printDoc = () => {
  const container = docContainerRef.value
  const paper = container ? container.querySelector('.eis-document-paper') : null
  if (!paper) return
  const printWindow = window.open('', '_blank')
  if (!printWindow) return
  const clone = paper.cloneNode(true)
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT)
  while (walker.nextNode()) {
    const node = walker.currentNode
    if (node.tagName === 'SCRIPT') {
      node.remove()
      continue
    }
    Array.from(node.attributes || []).forEach((attr) => {
      if (attr.name.toLowerCase().startsWith('on')) node.removeAttribute(attr.name)
    })
  }
  const styleText = `
    body { margin: 0; padding: 20px; background: #fff; }
    .eis-document-paper { max-width: 900px; margin: 0 auto; font-family: "SimSun", "Songti SC", serif; color: #000; }
    .doc-header { text-align: center; margin-bottom: 20px; position: relative; }
    .doc-title { font-size: 24px; font-weight: bold; margin: 0; padding-bottom: 10px; border-bottom: 2px solid #000; display: inline-block; }
    .doc-no { position: absolute; right: 0; top: 5px; font-size: 12px; font-family: sans-serif; }
    .grid-row { border-top: 1px solid #000; border-left: 1px solid #000; }
    .grid-cell { border-right: 1px solid #000; border-bottom: 1px solid #000; padding: 8px; min-height: 40px; display: flex; align-items: center; }
    .field-label { font-weight: bold; margin-right: 8px; white-space: nowrap; font-size: 14px; }
    .field-content { flex: 1; font-size: 14px; }
    .section-title { font-weight: bold; padding: 5px 0; border-bottom: 1px solid #000; }
    .custom-doc-table { width: 100%; border: 1px solid #000; border-collapse: collapse; }
    .custom-doc-table th, .custom-doc-table td { border: 1px solid #000; padding: 6px; text-align: center; }
    .table-toolbar, .image-actions, button, input, textarea, select { display: none !important; }
  `
  printWindow.document.write(`<!DOCTYPE html><html><head><title>采购单据打印</title><style>${styleText}</style></head><body>${clone.outerHTML}</body></html>`)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 200)
}

onMounted(() => {
  loadDynamicColumns()
  loadTemplates()
  loadData()
  window.addEventListener('eis-form-templates-updated', handleTemplatesUpdated)
})

onUnmounted(() => {
  window.removeEventListener('eis-form-templates-updated', handleTemplatesUpdated)
})

watch([() => props.id, () => detailConfig.value.apiUrl], () => {
  selectedTemplateId.value = ''
  extraValues.value = {}
  loadDynamicColumns()
  loadTemplates()
  loadData()
})

watch(() => detailConfig.value.configKey, () => {
  loadDynamicColumns()
})

watch([selectedTemplateId, () => formData.value?.id], () => {
  loadFormValues()
})

watch([() => dynamicColumns.value, () => formData.value?.id], () => {
  syncAiContext()
  if (formData.value) applyFormulaUpdates(formData.value)
})
</script>

<style scoped>
.detail-page {
  padding: 20px;
  background: #f0f2f5;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.page-header {
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  background: #fff;
  padding: 14px 18px;
  border-radius: 6px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}

.header-main {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.title-block {
  min-width: 0;
}

.title-block h2 {
  margin: 0 0 5px;
  font-size: 18px;
  color: #303133;
}

.doc-meta {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 12px;
  color: #909399;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.action-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 10px 14px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #fff;
}

.action-strip :deep(.el-button) {
  margin-left: 0;
}

.form-container {
  flex: 1 1 auto;
  overflow-y: visible;
  display: flex;
  justify-content: center;
  padding-bottom: 40px;
}

.template-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.template-tip {
  font-size: 13px;
  color: #909399;
}

.template-actions {
  display: flex;
  gap: 8px;
  flex-wrap: nowrap;
  justify-content: center;
  align-items: center;
  white-space: nowrap;
}

.template-preview-body {
  max-height: 70vh;
  overflow: auto;
  padding: 10px 0;
}

.business-flow-dialog {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.flow-chain {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.flow-step {
  position: relative;
  min-height: 86px;
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 5px;
  padding: 10px;
}

.flow-step:not(:last-child)::after {
  content: "→";
  position: absolute;
  right: -18px;
  top: 50%;
  transform: translateY(-50%);
  color: #409eff;
  font-weight: 700;
}

.flow-step.active {
  border-color: #409eff;
  background: #eef6ff;
}

.flow-step.current {
  border-color: #67c23a;
  background: #f0f9eb;
}

.step-type {
  font-size: 12px;
  color: #909399;
}

.flow-step strong {
  font-size: 15px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.flow-step small {
  color: #606266;
}

.flow-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.flow-doc-panel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.flow-doc-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 10px;
  background: #fff;
  min-width: 0;
}

.flow-doc-card span,
.flow-doc-card small {
  display: block;
  color: #909399;
  font-size: 12px;
}

.flow-doc-card strong {
  display: block;
  margin: 5px 0;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.template-actions .el-button) {
  margin-left: 0;
}

@media (max-width: 900px) {
  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .header-actions {
    justify-content: flex-start;
  }

  .flow-chain,
  .flow-doc-panel {
    grid-template-columns: 1fr;
  }
}

@media print {
  .detail-page { background: white; padding: 0; height: auto; }
  .page-header, .action-strip { display: none; }
  .form-container { overflow: visible; padding: 0; }
}
</style>
