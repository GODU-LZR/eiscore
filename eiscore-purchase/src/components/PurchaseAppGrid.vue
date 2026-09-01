<template>
  <div class="app-container">
    <div class="app-header">
      <div class="header-text">
        <h2>{{ app.name }}</h2>
        <p>{{ app.desc }}</p>
      </div>
      <el-button type="primary" plain @click="goApps">返回应用列表</el-button>
    </div>

    <el-card
      shadow="never"
      class="grid-card"
      :body-style="{ height: '100%', display: 'flex', flexDirection: 'column' }"
    >
      <eis-data-grid
        ref="gridRef"
        :view-id="app.viewId"
        :api-url="gridApiUrl"
        :write-url="app.writeUrl || ''"
        :include-properties="app.includeProperties !== false"
        :write-mode="app.writeMode || 'patch'"
        :patch-required-fields="app.patchRequiredFields || []"
        :field-defaults="app.fieldDefaults || {}"
        :default-order="app.defaultOrder || 'id.desc'"
        accept-profile="public"
        content-profile="public"
        :static-columns="staticColumns"
        :extra-columns="policyExtraColumns"
        :summary="summaryConfig"
        :acl-module="app.aclModule"
        :attention-resolver="resolveAttention"
        :row-action-resolver="resolveRowActions"
        :row-filter="rowAttentionFilter"
        :summary-scope="summaryScope"
        :can-create="canCreate"
        :can-edit="canEdit"
        :can-delete="canDelete"
        :can-export="canExport"
        :can-config="canConfig"
        :auto-size-columns="false"
        :local-layout-key="gridLocalLayoutKey"
        :enable-row-height-resize="!!gridLocalLayoutKey"
        :default-row-height="35"
        :min-row-height="32"
        :max-row-height="180"
        @create="handleCreate"
        @config-columns="openColumnConfig"
        @view-document="handleViewDocument"
        @row-action="handleRowAction"
        @data-load-error="handleDataLoadError"
        @data-loaded="handleDataLoaded"
        @cell-value-changed="handlePurchaseCellValueChanged"
      >
        <template #toolbar>
          <GridCompactFilter
            v-model:time-mode="gridTimeMode"
            v-model:day="gridDay"
            v-model:month="gridMonth"
            v-model:year="gridYear"
            v-model:custom-range="gridCustomRange"
            v-model:attention-filter="attentionFilter"
            :time-options="gridTimeModeOptions"
            :time-field="gridTimeField"
            :time-field-label="gridTimeFieldLabel"
            :time-scope-label="gridTimeScopeLabel"
            :attention-options="attentionFilterOptions"
            :filter-summary="gridFilterSummary"
            :has-active-filters="hasActiveGridFilters"
            @shift-period="shiftGridPeriod"
            @reset-period="resetGridPeriod"
            @reset-filters="resetGridFilters"
          />
          <el-button
            v-if="app.key === 'demands' && canPushDemandToOrder"
            data-sop-action="purchase-push-demand-order"
            data-sop-title="采购需求下推采购订单"
            data-sop-desc="把选中的采购需求生成采购订单，并建立单据链路。"
            data-sop-steps="先勾选需要下推的采购需求|确认供应商、物料、数量、需求日期和状态可以下单|点击下推采购订单打开业务流转确认窗|确认生成后跳转到采购订单查看结果"
            data-sop-risk="下推会生成采购订单。供应商、数量或需求日期错误会影响采购执行和库存计划。"
            type="success"
            plain
            icon="Position"
            :loading="flowActionLoading"
            @click="openDemandPushFlowDialog"
          >
            下推采购订单
          </el-button>
          <el-button
            v-if="app.key === 'orders' && canPushOrderToArrival"
            data-sop-action="purchase-push-order-arrival"
            data-sop-title="采购订单下推到货跟踪"
            data-sop-desc="把选中的采购订单生成到货跟踪记录，进入收货准备环节。"
            data-sop-steps="先勾选需要跟踪到货的采购订单|复核订单号、供应商、物料、订单数量和预计到货日期|点击下推到货跟踪打开业务流转确认窗|确认后跳转到到货跟踪应用复核到货状态"
            data-sop-risk="到货跟踪会影响收货计划和质检准备。已关闭、取消或异常订单不要下推。"
            type="success"
            plain
            icon="Position"
            :loading="flowActionLoading"
            @click="openOrderPushFlowDialog"
          >
            下推到货跟踪
          </el-button>
          <el-button
            v-if="app.key === 'arrivals' && canPushArrivalToInbound"
            data-sop-action="purchase-push-arrival-inbound"
            data-sop-title="到货跟踪下推采购入库"
            data-sop-desc="把合格可入库的到货记录下推到仓储入库。"
            data-sop-steps="先勾选可入库的到货记录|复核到货数量、质检状态、批次、仓库和库位|点击下推采购入库打开业务流转确认窗|确认后跳转仓储入库，检查入库单和库存影响"
            data-sop-risk="入库会影响库存账。异常、不合格或数量未确认的到货记录不要直接入库。"
            type="warning"
            plain
            icon="Position"
            :loading="flowActionLoading"
            @click="openArrivalPushFlowDialog"
          >
            下推采购入库
          </el-button>
        </template>
      </eis-data-grid>

      <el-dialog
        v-model="flowDialogVisible"
        :title="flowDialogTitle"
        width="880px"
        append-to-body
        destroy-on-close
        @closed="resetFlowDialog"
      >
        <div
          class="business-flow-dialog"
          data-guide="flow-wrapper"
          data-sop-flow="purchase-flow-push"
          data-sop-title="采购业务下推流程"
          data-sop-desc="按采购需求、采购订单、到货跟踪、采购入库的链路完成采购单据下推。"
          data-sop-steps="先勾选可流转的采购记录|确认下一环节和已选数量|检查单据链路是否已有下游记录|点击确认下推并跳转|到下游应用搜索单号复核状态"
          data-sop-risk="采购下推会生成或关联下游单据，错误供应商、数量、质检状态或仓库信息会影响采购执行和库存账。"
          v-loading="flowLoading"
        >
          <div class="flow-push-header" data-guide="flow-selection">
            <div>
              <span>{{ flowSelectedLabel }}</span>
              <strong>{{ selectedFlowCount }}</strong>
            </div>
            <el-radio-group v-model="flowNextStep" size="small">
              <el-radio-button
                v-for="option in nextStepOptions"
                :key="option.value"
                :label="option.value"
              >
                {{ option.label }}
              </el-radio-button>
            </el-radio-group>
          </div>

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
              data-guide="flow-confirm"
              data-sop-action="purchase-confirm-flow-push"
              data-sop-title="确认采购下推并跳转"
              data-sop-desc="确认当前采购单据链路，并生成下一环节单据。"
              data-sop-steps="复核已选单据数量|确认下一环节是否正确|查看单据链路中是否已有下游单据|点击确认下推并跳转|跳转后搜索新单据并复核状态"
              data-sop-risk="确认后会生成或关联下游单据，错误下推会影响采购、到货和库存。"
              :type="flowConfirmButtonType"
              :loading="flowActionLoading"
              @click="confirmCurrentPush"
            >
              确认下推并跳转
            </el-button>
          </div>

          <div class="flow-doc-panel" data-guide="flow-risk">
            <div class="flow-doc-card">
              <span>{{ primaryDocLabel }}</span>
              <strong>{{ primaryDocNo }}</strong>
              <small>{{ primaryDocSummary }}</small>
            </div>
            <div class="flow-doc-card">
              <span>上一个应用单据</span>
              <strong>{{ previousDocNo }}</strong>
              <small>{{ previousDocSummary }}</small>
            </div>
            <div class="flow-doc-card">
              <span>{{ downstreamDocLabel }}</span>
              <strong>{{ downstreamDocNo }}</strong>
              <small>{{ downstreamDocStatus }}</small>
            </div>
          </div>
        </div>
      </el-dialog>

      <el-dialog v-model="colConfigVisible" title="列管理" width="600px" append-to-body destroy-on-close @closed="resetForm">
        <div class="column-manager">
          <p class="section-title">固定列显示：</p>
          <div class="col-list">
            <div v-for="col in staticColumnsAll" :key="col.prop" class="col-item">
              <div class="col-info">
                <span class="col-label">{{ col.label }}</span>
              </div>
              <div class="col-actions">
                <el-switch
                  :model-value="isStaticVisible(col.prop)"
                  active-text="显示"
                  inactive-text="隐藏"
                  @change="toggleStaticColumn(col.prop, $event)"
                />
              </div>
            </div>
          </div>

          <p class="section-title">已添加的列：</p>
          <div v-if="extraColumns.length === 0" class="empty-tip">还没有新增列</div>
          
          <div class="col-list">
            <div v-for="(col, index) in extraColumns" :key="index" class="col-item">
              <div class="col-info">
                <span class="col-label">{{ col.label }}</span>
                <el-tag v-if="col.type === 'formula'" size="small" type="warning" effect="plain" style="margin-left:8px">计算</el-tag>
              </div>
              <div class="col-actions">
                <el-button type="primary" link icon="Edit" @click="editColumn(index)">编辑</el-button>
                <el-button type="danger" link icon="Delete" @click="removeColumn(index)">删除</el-button>
              </div>
            </div>
          </div>
          
          <el-divider />
          
          <div class="form-header">
            <p class="section-title">{{ isEditing ? '编辑列' : '新增列' }}：</p>
            <el-button v-if="isEditing" type="info" link size="small" @click="resetForm">取消编辑</el-button>
          </div>

          <el-tabs v-model="addTab" type="border-card" class="add-tabs">
            <el-tab-pane label="普通文字" name="text">
              <div class="form-row">
                <el-input v-model="currentCol.label" placeholder="列名（比如：采购备注）" @keyup.enter="saveColumn" />
                <el-button type="primary" @click="saveColumn" :disabled="!currentCol.label">
                  {{ isEditing ? '保存修改' : '添加' }}
                </el-button>
              </div>
              <p class="hint-text">用于存放普通文字、数字或日期，直接填就行。</p>
            </el-tab-pane>

            <el-tab-pane label="下拉选项" name="select">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：采购类型）" style="margin-bottom: 10px;" />
                <div class="options-config">
                  <div class="option-row" v-for="(opt, idx) in currentCol.options" :key="idx">
                    <el-input v-model="opt.label" placeholder="选项内容" style="flex: 1;" />
                    <el-button type="danger" link @click="removeSelectOption(idx)">删除</el-button>
                  </div>
                  <el-button class="add-opt-btn" type="primary" plain size="small" @click="addSelectOption">
                    + 添加一项
                  </el-button>
                </div>

                <el-button type="primary" style="margin-top: 10px; width: 100%;" @click="saveColumn" :disabled="!currentCol.label">
                  {{ isEditing ? '保存修改' : '添加下拉列' }}
                </el-button>
              </div>
            </el-tab-pane>

            <el-tab-pane label="联动选择" name="cascader">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：物料分类）" style="margin-bottom: 10px;" />

                <el-select v-model="currentCol.dependsOn" placeholder="先选哪一列（下拉或联动都可以）" filterable style="width: 100%; margin-bottom: 10px;">
                  <el-option v-for="col in cascaderParentColumns" :key="col.prop" :label="col.label" :value="col.prop" />
                </el-select>

                <div v-if="currentCol.dependsOn && cascaderParentOptions.length === 0" class="hint-text">
                  先给上一级列设置选项，才能配置联动。
                </div>
                <div v-else-if="currentCol.dependsOn" class="cascader-map">
                  <div v-for="opt in cascaderParentOptions" :key="opt.value" class="cascader-node">
                    <div class="cascader-parent-row">
                      <span class="cascader-parent">{{ opt.label }}</span>
                    </div>
                    <div class="cascader-children">
                      <div v-if="getCascaderChildren(opt.value).length > 0" class="cascader-tags">
                        <el-tag
                          v-for="child in getCascaderChildren(opt.value)"
                          :key="child"
                          size="small"
                          closable
                          @close="removeCascaderChild(opt.value, child)"
                        >
                          {{ child }}
                        </el-tag>
                      </div>
                      <div class="cascader-add">
                        <el-input
                          v-model="cascaderInputMap[opt.value]"
                          placeholder="输入一个下级选项"
                          @keyup.enter="addCascaderChild(opt.value)"
                        />
                        <el-button type="primary" plain @click="addCascaderChild(opt.value)">添加</el-button>
                      </div>
                      <div v-if="getCascaderChildren(opt.value).length === 0" class="hint-text">还没有下级选项</div>
                    </div>
                  </div>
                </div>

                <el-button type="primary" style="margin-top: 10px; width: 100%;" @click="saveColumn" :disabled="!currentCol.label">
                  {{ isEditing ? '保存修改' : '添加联动列' }}
                </el-button>
                <p class="hint-text">上面改了，下面会自动清空，避免选错。</p>
              </div>
            </el-tab-pane>

            <el-tab-pane label="地图位置" name="geo">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：位置）" style="margin-bottom: 10px;" />
                <el-switch v-model="currentCol.geoAddress" active-text="同时记录地址" inactive-text="只记经纬度" />
                <el-button type="primary" style="margin-top: 10px; width: 100%;" @click="saveColumn" :disabled="!currentCol.label">
                  {{ isEditing ? '保存修改' : '添加地图列' }}
                </el-button>
                <p class="hint-text">后面可在地图上点选位置。</p>
              </div>
            </el-tab-pane>

            <el-tab-pane label="文件" name="file">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：附件）" style="margin-bottom: 10px;" />
                <div class="form-row">
                  <div class="field-block">
                    <span class="field-label">最多文件数</span>
                    <el-input-number v-model="currentCol.fileMaxCount" :min="1" :max="50" controls-position="right" />
                  </div>
                  <div class="field-block">
                    <span class="field-label">单个文件大小(兆)</span>
                    <el-input-number v-model="currentCol.fileMaxSizeMb" :min="1" :max="50" controls-position="right" />
                  </div>
                </div>
                <el-input v-model="currentCol.fileAccept" placeholder="允许格式（可不写）" style="margin-top: 10px;" />
                <el-button type="primary" style="margin-top: 10px; width: 100%;" @click="saveColumn" :disabled="!currentCol.label">
                  {{ isEditing ? '保存修改' : '添加文件列' }}
                </el-button>
                <p class="hint-text">可上传多个文件，系统自动保存。</p>
              </div>
            </el-tab-pane>

            <el-tab-pane label="自动计算" name="formula">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：含税金额）" style="margin-bottom: 10px;" />

                <div class="formula-area">
                  <div class="formula-actions">
                    <el-button size="small" type="primary" plain @click="openAiFormula">AI生成公式</el-button>
                    <span class="formula-tip">把需求告诉工作助手，自动生成复杂公式</span>
                  </div>
                  <el-input 
                    v-model="currentCol.expression" 
                    type="textarea" 
                    :rows="3"
                    placeholder="写计算方法（比如：{数量}*{单价}）"
                  />
                  
                  <div class="variable-tags">
                    <span class="tag-tip">点一下插入列名:</span>
                    <div class="tags-wrapper">
                      <el-tag 
                        v-for="col in allAvailableColumns" 
                        :key="col.prop" 
                        size="small" 
                        class="cursor-pointer"
                        @click="insertVariable(col.label)"
                      >
                        {{ col.label }}
                      </el-tag>
                    </div>
                  </div>
                </div>

                <el-button type="warning" style="margin-top: 10px; width: 100%;" @click="saveColumn" :disabled="!currentCol.label || !currentCol.expression">
                  {{ isEditing ? '保存计算修改' : '添加计算列' }}
                </el-button>
                <p class="hint-text">计算列会自动算好并保存，<b>不能手动改</b>。</p>
              </div>
            </el-tab-pane>
          </el-tabs>

        </div>
        <template #footer>
          <el-button @click="colConfigVisible = false">关闭</el-button>
        </template>
      </el-dialog>

    </el-card>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { ref, onMounted, onUnmounted, reactive, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import EisDataGrid from '@/components/eis-data-grid-v2/index.vue'
import request from '@/utils/request'
import { ElMessage } from 'element-plus'
import { navigateEnterprisePath } from '@eiscore/platform/navigation'
import { pushAiContext, pushAiCommand } from '@/utils/ai-context'
import {
  buildPurchaseAiColumns,
  buildPurchaseCascaderParentColumns,
  buildPurchaseCascaderParentOptions,
  buildPurchaseDataSample,
  buildPurchaseDataStats,
  clonePurchaseColumns,
  isPurchaseRowActive,
  normalizePurchaseCascaderMap
} from '@/domain/purchase-grid-data-policy'
import {
  assertPurchaseDemandFlowSource,
  assertPurchaseOrderFlowSource,
  assertPurchaseOrderQuantity,
  buildPurchaseActiveSourceLinkQuery as activeSourceLinkQuery,
  buildPurchaseArrivalInboundPlan,
  buildPurchaseDemandOrderCompletion,
  buildPurchaseDemandOrderDraft,
  buildPurchaseDocumentLinkPayload as createDocumentLinkPayload,
  buildPurchaseFlowAuditPayload,
  buildPurchaseFlowView,
  buildPurchaseOrderActivationUpdate,
  buildPurchaseOrderArrivalCompletion,
  buildPurchaseOrderArrivalDraft,
  calculatePurchaseOrderPendingQuantity,
  encodePurchaseFilterValue as safeEq,
  getPurchaseOrderPendingQuantityHint,
  isPurchaseArrivalPushable as isArrivalPushable,
  isPurchaseDemandPushable as isDemandPushable,
  isPurchaseOrderPushable as isOrderPushable,
  pickPurchaseRowByLinkTarget as pickFirstByLinkTarget,
  projectPurchaseInboundFromLink,
  PURCHASE_FLOW_DOC_TYPES as DOC_TYPES,
  PURCHASE_FLOW_RELATION_TYPES as RELATION_TYPES,
  selectPurchaseFlowRows
} from '@/domain/purchase-grid-flow-policy'
import { buildGridAgentContext, buildGridLoadState, enrichLoadedDataStats } from '@shared/eis-grid-agent-context'
import GridCompactFilter from '@shared/eis-grid-compact-filter.vue'
import { useEisGridAppFilters } from '@shared/use-eis-grid-app-filters'
import { findPurchaseApp, SUPPLIER_COLUMNS } from '@/utils/purchase-apps'
import { getRealtimeClient } from '@/utils/realtime'
import { hasPerm } from '@/utils/permission'
import { applyPurchaseColumnPolicies } from '@/utils/business-status'
import {
  buildPurchaseAttentionSummary,
  getPurchaseRecordAttention,
  matchesPurchaseAttentionFilter
} from '@/utils/purchase-attention'
import { tryCreateDocumentLink, tryCreateDocumentAudit } from '@/utils/business-flow'

const props = defineProps({
  appKey: { type: String, default: 'suppliers' },
  appConfig: { type: Object, default: null }
})

const router = useRouter()
const gridRef = ref(null)
const lastLoadedRows = ref([])
const lastSearchText = ref('')
const lastGridLoadState = ref(buildGridLoadState())
const attentionFilter = ref('all')
const colConfigVisible = ref(false)
const flowDialogVisible = ref(false)
const flowLoading = ref(false)
const flowActionLoading = ref(false)
const flowNextStep = ref('purchase_order')
const selectedDemandRows = ref([])
const selectedOrderRows = ref([])
const selectedArrivalRows = ref([])
const flowDocs = ref({})
const flowLinks = ref([])
const addTab = ref('text') 
let realtimeUnsub = null
let realtimeTimer = null
let fieldLabelRetryTimer = null
let fieldLabelWarned = false

const app = computed(() => props.appConfig || findPurchaseApp(props.appKey) || {
  key: 'suppliers',
  name: '供应商档案',
  desc: '供应商基础资料、等级、付款条件与交期管理',
  route: '/app/suppliers',
  apiUrl: '/purchase_suppliers',
  viewId: 'purchase_suppliers',
  configKey: 'purchase_suppliers_cols',
  staticColumns: SUPPLIER_COLUMNS,
  summaryConfig: { label: '总计', rules: {}, expressions: {} },
  defaultExtraColumns: []
})

const opPerms = computed(() => app.value?.ops || {})
const enableRealtime = computed(() => app.value?.enableRealtime === true)
const canCreate = computed(() => hasPerm(opPerms.value.create))
const canEdit = computed(() => hasPerm(opPerms.value.edit))
const canDelete = computed(() => hasPerm(opPerms.value.delete))
const canExport = computed(() => hasPerm(opPerms.value.export))
const canConfig = computed(() => hasPerm(opPerms.value.config))
const canPushDemandToOrder = computed(() => hasPerm(app.value?.businessOps?.createOrder || 'op:purchase_demand.create_order'))
const canPushOrderToArrival = computed(() => hasPerm(app.value?.businessOps?.registerArrival || 'op:purchase_order.register_arrival'))
const canPushArrivalToInbound = computed(() => hasPerm(app.value?.businessOps?.confirmInbound || 'op:purchase_arrival.confirm_inbound'))
const attentionRows = computed(() => lastLoadedRows.value)
const attentionSummary = computed(() => buildPurchaseAttentionSummary(app.value?.key, attentionRows.value))
const attentionTodoCount = computed(() => attentionRows.value.filter((row) => matchesPurchaseAttentionFilter(app.value?.key, row, 'todo')).length)
const attentionFilterOptions = computed(() => [
  { value: 'all', label: `全部 ${attentionSummary.value.total}` },
  { value: 'critical', label: `紧急 ${attentionSummary.value.counts.critical}` },
  { value: 'warning', label: `预警 ${attentionSummary.value.counts.warning}` },
  { value: 'focus', label: `重点 ${attentionSummary.value.counts.focus}` },
  { value: 'todo', label: `待处理 ${attentionTodoCount.value}` }
])
const resolveAttention = (row) => getPurchaseRecordAttention(app.value?.key, row, {
  role: 'procurement',
  page: app.value?.key,
  device: 'desktop',
  task: 'monitor'
})
const rowAttentionFilter = (row) => matchesPurchaseAttentionFilter(app.value?.key, row, attentionFilter.value)
const resolveRowActions = (row) => {
  if (!row) return []
  if (app.value.key === 'demands') {
    return canPushDemandToOrder.value && isDemandPushable(row)
      ? [{
          key: 'push-demand-order',
          label: '下单',
          type: 'success',
          icon: 'Position',
          sopAction: 'purchase-row-push-demand-order',
          sopTitle: '单行需求下单',
          sopDesc: '把当前这一条采购需求下推为采购订单。',
          sopSteps: [
            '先确认当前行是要下单的采购需求。',
            '复核供应商、物料、数量、需求日期和需求状态。',
            '点击“下单”打开业务流转确认窗。',
            '确认后跳转采购订单并搜索新生成或已关联订单。'
          ],
          sopRisk: '单行下推仍会创建采购订单，不能用错供应商或数量。'
        }]
      : []
  }
  if (app.value.key === 'orders') {
    return canPushOrderToArrival.value && isOrderPushable(row)
      ? [{
          key: 'push-order-arrival',
          label: '到货',
          type: 'success',
          icon: 'Position',
          sopAction: 'purchase-row-push-order-arrival',
          sopTitle: '单行订单到货',
          sopDesc: '把当前采购订单下推为到货跟踪记录。',
          sopSteps: [
            '先确认当前行是要跟踪到货的采购订单。',
            '复核订单号、供应商、物料、订单数量和预计到货日期。',
            '点击“到货”打开业务流转确认窗。',
            '确认后跳转到货跟踪并复核到货状态。'
          ],
          sopRisk: '错误下推会影响收货计划和后续质检。'
        }]
      : []
  }
  if (app.value.key === 'arrivals') {
    const actions = []
    if (canPushArrivalToInbound.value && isArrivalPushable(row)) {
      actions.push({
        key: 'push-arrival-inbound',
        label: '入库',
        type: 'warning',
        icon: 'Box',
        sopAction: 'purchase-row-push-arrival-inbound',
        sopTitle: '单行到货入库',
        sopDesc: '把当前到货记录下推为采购入库。',
        sopSteps: [
          '先确认当前到货记录可以入库。',
          '复核到货数量、质检状态、批次、仓库和库位。',
          '点击“入库”打开业务流转确认窗。',
          '确认后跳转仓储入库，检查库存影响。'
        ],
        sopRisk: '入库会影响库存账，异常、不合格或数量未确认记录不能直接入库。'
      })
    }
    return actions
  }
  return []
}
const primaryDemand = computed(() => selectedDemandRows.value[0] || null)
const primaryOrder = computed(() => selectedOrderRows.value[0] || null)
const primaryArrival = computed(() => selectedArrivalRows.value[0] || null)
const purchaseFlowView = computed(() => buildPurchaseFlowView({
  appKey: app.value.key,
  demand: primaryDemand.value || flowDocs.value.purchaseDemand || {},
  order: primaryOrder.value || flowDocs.value.purchaseOrder || {},
  arrival: primaryArrival.value || flowDocs.value.purchaseArrival || {},
  docs: flowDocs.value
}))
const selectedFlowCount = computed(() => {
  if (app.value.key === 'orders') return selectedOrderRows.value.length
  if (app.value.key === 'arrivals') return selectedArrivalRows.value.length
  return selectedDemandRows.value.length
})
const flowDialogTitle = computed(() => purchaseFlowView.value.dialogTitle)
const flowSelectedLabel = computed(() => purchaseFlowView.value.selectedLabel)
const nextStepOptions = computed(() => purchaseFlowView.value.nextStepOptions)
const flowConfirmButtonType = computed(() => purchaseFlowView.value.confirmButtonType)
const purchaseFlowNodes = computed(() => purchaseFlowView.value.nodes)
const primaryDocLabel = computed(() => purchaseFlowView.value.primaryLabel)
const primaryDocNo = computed(() => purchaseFlowView.value.primaryDocNo)
const primaryDocSummary = computed(() => purchaseFlowView.value.primarySummary)
const previousDocNo = computed(() => purchaseFlowView.value.previousDocNo)
const previousDocSummary = computed(() => purchaseFlowView.value.previousSummary)
const downstreamDocLabel = computed(() => purchaseFlowView.value.downstream.label)
const downstreamDocNo = computed(() => purchaseFlowView.value.downstream.docNo)
const downstreamDocStatus = computed(() => purchaseFlowView.value.downstream.status)

const staticHidden = ref([])
const staticColumnsAll = computed(() => app.value.staticColumns || SUPPLIER_COLUMNS)
const staticColumns = computed(() =>
  applyPurchaseColumnPolicies(
    app.value.key,
    staticColumnsAll.value.filter(col => !staticHidden.value.includes(col.prop))
  )
)
const {
  gridTimeModeOptions,
  gridTimeMode,
  gridDay,
  gridMonth,
  gridYear,
  gridCustomRange,
  gridTimeField,
  gridTimeFieldLabel,
  gridTimeScopeLabel,
  gridApiUrl,
  gridLocalLayoutKey,
  hasActiveGridFilters,
  gridFilterSummary,
  resetGridPeriod,
  resetGridFilters,
  shiftGridPeriod
} = useEisGridAppFilters({
  app,
  staticColumns: staticColumnsAll,
  moduleName: 'purchase',
  fallbackApiUrl: '/purchase_suppliers',
  attentionFilter,
  attentionFilterOptions
})
const summaryScope = computed(() => attentionFilter.value === 'all' && gridTimeMode.value === 'infinite' ? 'server' : 'loaded')
const summaryConfig = computed(() => app.value.summaryConfig || { label: '总计', rules: {}, expressions: {} })

const extraColumns = ref([])
const policyExtraColumns = computed(() => applyPurchaseColumnPolicies(app.value.key, extraColumns.value))
const hasSyncedFieldAcl = ref(false)

const isEditing = ref(false)
const editingIndex = ref(-1)

const currentCol = reactive({
  label: '',
  prop: '',
  expression: '',
  options: [],
  dependsOn: '',
  cascaderMap: {},
  geoAddress: true,
  fileMaxSizeMb: 20,
  fileMaxCount: 3,
  fileAccept: ''
})

const allAvailableColumns = computed(() => {
  const all = [...staticColumns.value, ...extraColumns.value]
  if (isEditing.value) {
    return all.filter((c, i) => i !== (staticColumns.value.length + editingIndex.value))
  }
  return all
})

const cascaderParentColumns = computed(() => buildPurchaseCascaderParentColumns(allAvailableColumns.value))
const cascaderParentOptions = computed(() => buildPurchaseCascaderParentOptions(
  cascaderParentColumns.value,
  currentCol.dependsOn
))

const cascaderInputMap = reactive({})

const syncCascaderMap = () => {
  const keys = cascaderParentOptions.value.map(opt => String(opt.value))
  Object.keys(currentCol.cascaderMap).forEach((key) => {
    if (!keys.includes(key)) delete currentCol.cascaderMap[key]
  })
  keys.forEach((key) => {
    if (!Array.isArray(currentCol.cascaderMap[key])) {
      currentCol.cascaderMap[key] = []
    }
    if (!(key in cascaderInputMap)) cascaderInputMap[key] = ''
  })
  Object.keys(cascaderInputMap).forEach((key) => {
    if (!keys.includes(key)) delete cascaderInputMap[key]
  })
}

watch([() => currentCol.dependsOn, cascaderParentOptions], () => {
  syncCascaderMap()
})

const getConfigKey = () => app.value.configKey || 'purchase_suppliers_cols'

const loadColumnsConfig = async () => {
  const configKey = getConfigKey()
  try {
    const res = await request({
      url: `/system_configs?key=eq.${configKey}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    if (res && res.length > 0 && Array.isArray(res[0].value)) {
      extraColumns.value = res[0].value
    } else {
      extraColumns.value = clonePurchaseColumns(app.value.defaultExtraColumns || [])
      if (extraColumns.value.length > 0) {
        await saveColumnsConfig()
      }
    }
    syncAiContext()
  } catch (e) { console.error(e) }
}

const loadStaticColumnsConfig = async () => {
  const configKey = `${getConfigKey()}_static_hidden`
  try {
    const res = await request({
      url: `/system_configs?key=eq.${configKey}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    const hidden = Array.isArray(res) && res.length ? res[0].value : []
    const props = new Set(staticColumnsAll.value.map(col => col.prop).filter(Boolean))
    staticHidden.value = Array.isArray(hidden)
      ? hidden.filter(prop => props.has(prop))
      : []
  } catch (e) {
    staticHidden.value = []
  }
}

const saveStaticColumnsConfig = async () => {
  const configKey = `${getConfigKey()}_static_hidden`
  await request({
    url: '/system_configs',
    method: 'post',
    headers: { 'Prefer': 'resolution=merge-duplicates', 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: { key: configKey, value: staticHidden.value }
  })
}

const handleDataLoaded = (payload) => {
  const rows = Array.isArray(payload?.rawRows)
    ? payload.rawRows
    : (Array.isArray(payload?.rows) ? payload.rows : [])
  const visibleRows = Array.isArray(payload?.rows) ? payload.rows : rows
  lastLoadedRows.value = rows.filter(isRowActive)
  lastSearchText.value = payload?.searchText || ''
  lastGridLoadState.value = buildGridLoadState(payload, rows, visibleRows)
  syncAiContext(visibleRows.filter(isRowActive), { searchText: lastSearchText.value })
}

const handleDataLoadError = () => {
  lastLoadedRows.value = []
  lastGridLoadState.value = buildGridLoadState()
  syncAiContext([], { searchText: lastSearchText.value })
}

const handlePurchaseCellValueChanged = (params) => {
  const row = params?.data || params?.node?.data
  if (!row?.id) return
  const index = lastLoadedRows.value.findIndex((item) => String(item?.id) === String(row.id))
  if (index < 0) return
  const next = [...lastLoadedRows.value]
  next.splice(index, 1, row)
  lastLoadedRows.value = next
}

const syncAiContext = (rows = lastLoadedRows.value, overrides = {}) => {
  const columns = buildPurchaseAiColumns([...staticColumns.value, ...extraColumns.value])
  const dataStats = enrichLoadedDataStats(buildPurchaseDataStats(rows), lastGridLoadState.value, rows)
  const dataSample = buildPurchaseDataSample(rows, columns, 40)
  const fileColumns = columns.filter(col => col.type === 'file')
  const apiUrl = app.value.writeUrl || app.value.apiUrl
  const dataScope = (overrides.searchText ?? lastSearchText.value) ? '当前搜索结果' : '当前列表数据'
  const importTarget = {
    apiUrl,
    profile: 'public',
    viewId: app.value.viewId
  }
  pushAiContext({
    app: 'purchase',
    view: app.value.key,
    viewId: app.value.viewId,
    apiUrl,
    profile: 'public',
    columns,
    staticColumns: staticColumns.value,
    extraColumns: extraColumns.value,
    summaryConfig: summaryConfig.value,
    fileColumns,
    dataStats,
    dataSample,
    dataScope,
    searchText: overrides.searchText ?? lastSearchText.value ?? '',
    gridAgent: buildGridAgentContext({
      app: 'purchase',
      view: app.value.key,
      viewId: app.value.viewId,
      apiUrl,
      writeUrl: apiUrl,
      profile: 'public',
      contentProfile: 'public',
      defaultOrder: app.value.defaultOrder || 'id.desc',
      columns,
      staticColumns: staticColumns.value,
      extraColumns: extraColumns.value,
      summaryConfig: summaryConfig.value,
      searchText: overrides.searchText ?? lastSearchText.value ?? '',
      dataScope,
      loadState: lastGridLoadState.value,
      allowImport: overrides.allowImport !== undefined ? overrides.allowImport : true,
      importTarget,
      summaryScope: summaryScope.value
    }),
    aiScene: overrides.aiScene || 'grid_chat',
    allowFormula: !!overrides.allowFormula,
    allowFormulaOnce: !!overrides.allowFormulaOnce,
    allowImport: overrides.allowImport !== undefined ? overrides.allowImport : true,
    importTarget
  })
}

const saveColumnsConfig = async () => {
  const configKey = getConfigKey()
  await request({
    url: '/system_configs',
    method: 'post',
    headers: { 'Prefer': 'resolution=merge-duplicates', 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: { key: configKey, value: extraColumns.value }
  })
}

const syncFieldAclForColumns = async (columnProps = null) => {
  const moduleName = app.value.aclModule
  if (!moduleName) return
  if (hasSyncedFieldAcl.value && !columnProps) return
  const props = Array.isArray(columnProps) && columnProps.length
    ? columnProps
    : [...staticColumnsAll.value, ...extraColumns.value].map(col => col.prop).filter(Boolean)
  if (props.length === 0) return
  const uniqueProps = Array.from(new Set(props))
  try {
    await request({
      url: '/rpc/ensure_field_acl',
      method: 'post',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
      data: { module_name: moduleName, field_codes: uniqueProps }
    })
    if (!columnProps) hasSyncedFieldAcl.value = true
  } catch (e) {
    console.warn('sync field acl failed', e)
  }
}

const syncFieldLabels = async () => {
  const moduleName = app.value.aclModule
  if (!moduleName) return
  const cols = [...staticColumnsAll.value, ...extraColumns.value]
  const payload = cols
    .filter(col => col?.prop && col?.label)
    .map(col => ({
      module: moduleName,
      field_code: col.prop,
      field_label: col.label
    }))
  if (payload.length === 0) return
  try {
    await request({
      url: '/field_label_overrides',
      method: 'post',
      headers: { 'Prefer': 'resolution=merge-duplicates', 'Accept-Profile': 'public', 'Content-Profile': 'public' },
      data: payload
    })
    fieldLabelWarned = false
  } catch (e) {
    console.warn('sync field labels failed', e)
    if (!fieldLabelWarned) {
      fieldLabelWarned = true
      ElMessage.warning('列权限名称同步失败，正在重试...')
    }
    if (!fieldLabelRetryTimer) {
      fieldLabelRetryTimer = setTimeout(() => {
        fieldLabelRetryTimer = null
        syncFieldLabels()
      }, 2000)
    }
  }
}

const insertVariable = (label) => {
  currentCol.expression += `{${label}}`
}

const buildFormulaPrompt = () => {
  const label = currentCol.label || '计算列'
  const variables = allAvailableColumns.value.map(col => col.label).join('、')
  return [
    '请帮我生成表格“自动计算”公式。',
    `目标列：${label}`,
    '要求：只输出公式，不要解释。',
    '必须放在 ```formula``` 代码块中，内容示例：{数量}*{单价}。',
    `可用字段：${variables || '无'}。`
  ].join('\n')
}

const openAiFormula = () => {
  syncAiContext(lastLoadedRows.value, { aiScene: 'column_formula', allowFormulaOnce: true })
  pushAiCommand({
    id: `formula_${Date.now()}`,
    type: 'open-worker',
    prompt: buildFormulaPrompt()
  })
}

const addSelectOption = () => {
  currentCol.options.push({ label: '' })
}

const removeSelectOption = (index) => {
  currentCol.options.splice(index, 1)
}

const handleViewDocument = (row) => {
  if (!row?.id) return
  router.push({
    name: 'PurchaseDocumentDetail',
    params: { id: row.id },
    query: { appKey: app.value.key }
  })
}

const todayText = () => new Date().toISOString().slice(0, 10)
const nextDocNo = (prefix) => `${prefix}${Date.now().toString().slice(-8)}${String(Math.floor(Math.random() * 100)).padStart(2, '0')}`
const isRowActive = isPurchaseRowActive

const getSelectedDemandRows = () => {
  const rows = gridRef.value?.getSelectedRows?.() || []
  return selectPurchaseFlowRows(rows, 'demands')
}

const getSelectedOrderRows = () => {
  const rows = gridRef.value?.getSelectedRows?.() || []
  return selectPurchaseFlowRows(rows, 'orders')
}

const getSelectedArrivalRows = () => {
  const rows = gridRef.value?.getSelectedRows?.() || []
  return selectPurchaseFlowRows(rows, 'arrivals')
}

const resetFlowDialog = () => {
  selectedDemandRows.value = []
  selectedOrderRows.value = []
  selectedArrivalRows.value = []
  flowNextStep.value = 'purchase_order'
  flowDocs.value = {}
  flowLinks.value = []
  flowLoading.value = false
  flowActionLoading.value = false
}

const loadRowsByIdsOrNos = async ({ table, idField = 'id', noField, ids = [], nos = [], select = '*' }) => {
  const clauses = []
  const cleanIds = ids.filter(Boolean).map(safeEq)
  const cleanNos = nos.filter(Boolean).map(safeEq)
  if (cleanIds.length) clauses.push(`${idField}.in.(${cleanIds.join(',')})`)
  if (noField && cleanNos.length) clauses.push(`${noField}.in.(${cleanNos.join(',')})`)
  if (!clauses.length) return []
  const rows = await request({
    url: `/${table}?or=(${clauses.join(',')})&select=${select}&limit=50`,
    method: 'get',
    headers: { 'Accept-Profile': 'public' },
    silentError: true
  })
  return Array.isArray(rows) ? rows : []
}

const findExistingOrderForDemand = async (demand) => {
  if (!demand?.id && !demand?.demand_no) return null
  const duplicateConditions = []
  if (demand.id) duplicateConditions.push(`demand_id.eq.${safeEq(demand.id)}`)
  if (demand.demand_no) duplicateConditions.push(`source_demand_no.eq.${safeEq(demand.demand_no)}`)
  if (duplicateConditions.length) {
    const directOrders = await request({
      url: `/purchase_orders?or=(${duplicateConditions.join(',')})&order_status=neq.${safeEq('已取消')}&status=neq.disabled&select=*&limit=1`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' },
      silentError: true
    }).catch(() => [])
    if (Array.isArray(directOrders) && directOrders.length) return directOrders[0]
  }
  const links = await request({
    url: `/document_links?${activeSourceLinkQuery(DOC_TYPES.PURCHASE_DEMAND, demand.id, demand.demand_no)}&select=*`,
    method: 'get',
    headers: { 'Accept-Profile': 'public' },
    silentError: true
  }).catch(() => [])
  const orderLink = Array.isArray(links)
    ? links.find((link) => link.relation_type === RELATION_TYPES.DEMAND_TO_ORDER)
    : null
  if (!orderLink) return null
  const orders = await loadRowsByIdsOrNos({
    table: 'purchase_orders',
    noField: 'order_no',
    ids: [orderLink.target_doc_id],
    nos: [orderLink.target_doc_no]
  })
  return pickFirstByLinkTarget(orders, orderLink, 'order_no')
}

const loadDemandBusinessFlow = async (demand = primaryDemand.value) => {
  if (!demand?.id && !demand?.demand_no) return
  flowLoading.value = true
  try {
    const purchaseOrder = await findExistingOrderForDemand(demand)
    let purchaseArrival = null
    let inventoryInbound = null
    const links = []
    if (purchaseOrder) {
      const orderArrivalLinks = await request({
        url: `/document_links?${activeSourceLinkQuery(DOC_TYPES.PURCHASE_ORDER, purchaseOrder.id, purchaseOrder.order_no)}&select=*`,
        method: 'get',
        headers: { 'Accept-Profile': 'public' },
        silentError: true
      }).catch(() => [])
      links.push(...(Array.isArray(orderArrivalLinks) ? orderArrivalLinks : []))
      const arrivals = await loadRowsByIdsOrNos({
        table: 'purchase_arrivals',
        noField: 'arrival_no',
        ids: (orderArrivalLinks || []).map((link) => link.target_doc_id),
        nos: (orderArrivalLinks || []).map((link) => link.target_doc_no)
      })
      purchaseArrival = pickFirstByLinkTarget(arrivals, orderArrivalLinks?.[0], 'arrival_no')
    }
    if (purchaseArrival) {
      const arrivalInboundLinks = await request({
        url: `/document_links?${activeSourceLinkQuery(DOC_TYPES.PURCHASE_ARRIVAL, purchaseArrival.id, purchaseArrival.arrival_no)}&select=*`,
        method: 'get',
        headers: { 'Accept-Profile': 'public' },
        silentError: true
      }).catch(() => [])
      links.push(...(Array.isArray(arrivalInboundLinks) ? arrivalInboundLinks : []))
      const link = arrivalInboundLinks?.[0]
      inventoryInbound = projectPurchaseInboundFromLink(link)
    }
    flowDocs.value = { purchaseOrder, purchaseArrival, inventoryInbound }
    flowLinks.value = links
  } catch (e) {
    console.warn('load demand business flow failed', e)
    ElMessage.warning('业务流程加载失败')
  } finally {
    flowLoading.value = false
  }
}

const loadDemandForOrder = async (order) => {
  if (!order?.demand_id && !order?.source_demand_no) return null
  const rows = await loadRowsByIdsOrNos({
    table: 'purchase_demands',
    noField: 'demand_no',
    ids: [order.demand_id],
    nos: [order.source_demand_no]
  })
  return rows[0] || null
}

const findFirstArrivalForOrder = async (order) => {
  if (!order?.id && !order?.order_no) return null
  const directConditions = []
  if (order.id) directConditions.push(`order_id.eq.${safeEq(order.id)}`)
  if (order.order_no) directConditions.push(`order_no.eq.${safeEq(order.order_no)}`)
  if (directConditions.length) {
    const arrivals = await request({
      url: `/purchase_arrivals?or=(${directConditions.join(',')})&status=neq.deleted&select=*&order=arrival_date.desc&limit=1`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' },
      silentError: true
    }).catch(() => [])
    if (Array.isArray(arrivals) && arrivals.length) return arrivals[0]
  }
  const links = await request({
    url: `/document_links?${activeSourceLinkQuery(DOC_TYPES.PURCHASE_ORDER, order.id, order.order_no)}&select=*`,
    method: 'get',
    headers: { 'Accept-Profile': 'public' },
    silentError: true
  }).catch(() => [])
  const arrivalLink = Array.isArray(links)
    ? links.find((link) => link.relation_type === RELATION_TYPES.ORDER_TO_ARRIVAL)
    : null
  if (!arrivalLink) return null
  const rows = await loadRowsByIdsOrNos({
    table: 'purchase_arrivals',
    noField: 'arrival_no',
    ids: [arrivalLink.target_doc_id],
    nos: [arrivalLink.target_doc_no]
  })
  return pickFirstByLinkTarget(rows, arrivalLink, 'arrival_no')
}

const loadOrderBusinessFlow = async (order = primaryOrder.value) => {
  if (!order?.id && !order?.order_no) return
  flowLoading.value = true
  try {
    const purchaseDemand = await loadDemandForOrder(order)
    const purchaseArrival = await findFirstArrivalForOrder(order)
    let inventoryInbound = null
    if (purchaseArrival) {
      const inboundLinks = await request({
        url: `/document_links?${activeSourceLinkQuery(DOC_TYPES.PURCHASE_ARRIVAL, purchaseArrival.id, purchaseArrival.arrival_no)}&select=*`,
        method: 'get',
        headers: { 'Accept-Profile': 'public' },
        silentError: true
      }).catch(() => [])
      const inboundLink = Array.isArray(inboundLinks)
        ? inboundLinks.find((link) => link.relation_type === RELATION_TYPES.ARRIVAL_TO_INBOUND)
        : null
      inventoryInbound = projectPurchaseInboundFromLink(inboundLink)
    }
    flowDocs.value = { purchaseDemand, purchaseOrder: order, purchaseArrival, inventoryInbound }
  } catch (e) {
    console.warn('load order business flow failed', e)
    ElMessage.warning('业务流程加载失败')
  } finally {
    flowLoading.value = false
  }
}

const loadOrderForArrival = async (arrival) => {
  if (!arrival?.order_id && !arrival?.order_no) return null
  const rows = await loadRowsByIdsOrNos({
    table: 'purchase_orders',
    noField: 'order_no',
    ids: [arrival.order_id],
    nos: [arrival.order_no]
  })
  return rows[0] || null
}

const loadArrivalBusinessFlow = async (arrival = primaryArrival.value) => {
  if (!arrival?.id && !arrival?.arrival_no) return
  flowLoading.value = true
  try {
    const purchaseOrder = await loadOrderForArrival(arrival)
    const purchaseDemand = purchaseOrder ? await loadDemandForOrder(purchaseOrder) : null
    const inventoryInbound = arrival.inbound_no
      ? { id: null, inbound_no: arrival.inbound_no, docNo: arrival.inbound_no, status: arrival.arrival_status === '已入库' ? '已入库' : '已生成' }
      : null
    flowDocs.value = { purchaseDemand, purchaseOrder, purchaseArrival: arrival, inventoryInbound }
  } catch (e) {
    console.warn('load arrival business flow failed', e)
    ElMessage.warning('业务流程加载失败')
  } finally {
    flowLoading.value = false
  }
}

const openDemandPushFlowDialog = async () => {
  const rows = getSelectedDemandRows()
  if (!rows.length) {
    ElMessage.warning('请先在表格中选择要下推的采购需求')
    return
  }
  const invalidRows = rows.filter((row) => !isDemandPushable(row))
  if (invalidRows.length) {
    ElMessage.warning('已下单、已关闭或已锁定的采购需求不能下推采购订单')
    return
  }
  selectedDemandRows.value = rows
  flowNextStep.value = 'purchase_order'
  flowDialogVisible.value = true
  await loadDemandBusinessFlow(rows[0])
}

const openOrderPushFlowDialog = async () => {
  const rows = getSelectedOrderRows()
  if (!rows.length) {
    ElMessage.warning('请先在表格中选择要下推的采购订单')
    return
  }
  selectedOrderRows.value = rows
  flowNextStep.value = 'purchase_arrival'
  flowDialogVisible.value = true
  await loadOrderBusinessFlow(rows[0])
}

const openArrivalPushFlowDialog = async () => {
  const rows = getSelectedArrivalRows()
  if (!rows.length) {
    ElMessage.warning('请先在表格中选择要下推入库的到货单')
    return
  }
  selectedArrivalRows.value = rows
  flowNextStep.value = 'inventory_inbound'
  flowDialogVisible.value = true
  await loadArrivalBusinessFlow(rows[0])
}

const openPurchaseFlowDialogForRow = async (row, nextStep) => {
  if (!row) return
  resetFlowDialog()
  if (nextStep === 'purchase_order') {
    if (!canPushDemandToOrder.value) {
      ElMessage.warning('当前账号没有下推采购订单权限')
      return
    }
    if (!isDemandPushable(row)) {
      ElMessage.warning('已下单、已关闭或已锁定的采购需求不能下推采购订单')
      return
    }
    selectedDemandRows.value = [row]
    flowNextStep.value = 'purchase_order'
    flowDialogVisible.value = true
    await loadDemandBusinessFlow(row)
    return
  }
  if (nextStep === 'purchase_arrival') {
    if (!canPushOrderToArrival.value) {
      ElMessage.warning('当前账号没有登记到货权限')
      return
    }
    if (!isOrderPushable(row)) {
      ElMessage.warning('该采购订单当前状态不能登记到货')
      return
    }
    selectedOrderRows.value = [row]
    flowNextStep.value = 'purchase_arrival'
    flowDialogVisible.value = true
    await loadOrderBusinessFlow(row)
    return
  }
  if (nextStep === 'inventory_inbound') {
    if (!canPushArrivalToInbound.value) {
      ElMessage.warning('当前账号没有确认采购入库权限')
      return
    }
    if (!isArrivalPushable(row)) {
      ElMessage.warning('该到货单已入库、异常或不合格，不能直接入库')
      return
    }
    selectedArrivalRows.value = [row]
    flowNextStep.value = 'inventory_inbound'
    flowDialogVisible.value = true
    await loadArrivalBusinessFlow(row)
  }
}

const handleRowAction = ({ action, row }) => {
  if (!action || action.disabled || !row) return
  if (action.key === 'push-demand-order') {
    openPurchaseFlowDialogForRow(row, 'purchase_order')
    return
  }
  if (action.key === 'push-order-arrival') {
    openPurchaseFlowDialogForRow(row, 'purchase_arrival')
    return
  }
  if (action.key === 'push-arrival-inbound') {
    openPurchaseFlowDialogForRow(row, 'inventory_inbound')
  }
}

const writeFlowAudit = async ({ actionType, source, target, reason = '', payload = {} }) => {
  await tryCreateDocumentAudit(buildPurchaseFlowAuditPayload({
    actionType,
    source,
    target,
    reason,
    payload
  }))
}

const resolveDemandSupplier = async (demand) => {
  const supplierName = demand.preferred_supplier || ''
  if (!supplierName) return null
  const supplierRows = await request({
    url: `/purchase_suppliers?name=eq.${safeEq(supplierName)}&supplier_status=eq.${safeEq('合作中')}&status=eq.active&select=id,name,buyer_name,lead_time_days&limit=1`,
    method: 'get',
    headers: { 'Accept-Profile': 'public' },
    silentError: true
  }).catch(() => [])
  if (Array.isArray(supplierRows) && supplierRows.length > 0) return supplierRows[0]
  const blockedRows = await request({
    url: `/purchase_suppliers?name=eq.${safeEq(supplierName)}&select=id,name,supplier_status,status&limit=1`,
    method: 'get',
    headers: { 'Accept-Profile': 'public' },
    silentError: true
  }).catch(() => [])
  const blocked = Array.isArray(blockedRows) && blockedRows.length > 0 ? blockedRows[0] : null
  if (blocked) {
    throw new Error(`建议供应商当前为“${blocked.supplier_status || blocked.status || '不可用'}”，请先恢复合作或更换供应商`)
  }
  return null
}

const pushSingleDemandToOrder = async (demand) => {
  assertPurchaseDemandFlowSource(demand)
  const existingOrder = await findExistingOrderForDemand(demand)
  if (existingOrder) return { skipped: true, order: existingOrder }

  const supplier = await resolveDemandSupplier(demand)
  const payload = buildPurchaseDemandOrderDraft({
    demand,
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
  const completion = buildPurchaseDemandOrderCompletion({
    demand,
    order: createdOrder,
    orderPayload: payload,
    pushedAt: new Date().toISOString()
  })
  await request({
    url: `/purchase_demands?id=eq.${safeEq(demand.id)}`,
    method: 'patch',
    headers: { 'Content-Profile': 'public', 'Accept-Profile': 'public' },
    data: completion.demandUpdate
  })
  await tryCreateDocumentLink(createDocumentLinkPayload(completion.documentLink))
  await writeFlowAudit(completion.audit)
  return { skipped: false, order: createdOrder }
}

const pushSelectedDemandsToOrders = async () => {
  if (flowNextStep.value !== 'purchase_order') {
    ElMessage.warning('请选择要下推的下一流程')
    return
  }
  const rows = selectedDemandRows.value.length ? selectedDemandRows.value : getSelectedDemandRows()
  if (!rows.length) {
    ElMessage.warning('请先在表格中选择要下推的采购需求')
    return
  }
  flowActionLoading.value = true
  let createdCount = 0
  let skippedCount = 0
  const errors = []
  try {
    for (const row of rows) {
      try {
        const result = await pushSingleDemandToOrder(row)
        if (result.skipped) skippedCount += 1
        else createdCount += 1
      } catch (error) {
        errors.push(`${row.demand_no || row.id}：${error?.message || '下推失败'}`)
      }
    }
    await gridRef.value?.loadData?.()
    if (primaryDemand.value) await loadDemandBusinessFlow(primaryDemand.value)
    if (errors.length) {
      ElMessage.warning(`下推完成 ${createdCount} 单，跳过 ${skippedCount} 单，失败 ${errors.length} 单`)
      console.warn('batch push purchase demands failed', errors)
      return
    }
    ElMessage.success(`已下推 ${createdCount} 单，跳过已下推 ${skippedCount} 单`)
    flowDialogVisible.value = false
    await router.push('/app/orders')
  } finally {
    flowActionLoading.value = false
  }
}

const ensureOrderSupplierActive = async (order) => {
  const supplierName = order.supplier_name || ''
  if (!supplierName || supplierName === '待选择供应商') return true
  const rows = await request({
    url: `/purchase_suppliers?name=eq.${safeEq(supplierName)}&select=id,name,supplier_status,status&limit=1`,
    method: 'get',
    headers: { 'Accept-Profile': 'public' },
    silentError: true
  }).catch(() => [])
  const supplier = Array.isArray(rows) && rows.length ? rows[0] : null
  if (!supplier) return true
  if (supplier.supplier_status !== '合作中' || supplier.status !== 'active') {
    throw new Error(`供应商 ${supplier.name || supplierName} 当前不可用，请先恢复合作或更换供应商`)
  }
  return true
}

const ensureOrderReadyForArrival = async (order) => {
  assertPurchaseOrderQuantity(order)
  await ensureOrderSupplierActive(order)
  if (order.order_status === '草稿' || order.status === 'draft') {
    const update = buildPurchaseOrderActivationUpdate({
      order,
      confirmedAt: new Date().toISOString()
    })
    await request({
      url: `/purchase_orders?id=eq.${safeEq(order.id)}`,
      method: 'patch',
      headers: { 'Content-Profile': 'public', 'Accept-Profile': 'public' },
      data: update
    })
    order.order_status = '已下单'
    order.status = 'active'
  }
}

const getOrderPendingQuantity = async (order) => {
  const pendingHint = getPurchaseOrderPendingQuantityHint(order)
  if (pendingHint !== null) return pendingHint
  const orderQuantity = Number(order.quantity) || 0
  const conditions = []
  if (order.id) conditions.push(`order_id.eq.${safeEq(order.id)}`)
  if (order.order_no) conditions.push(`order_no.eq.${safeEq(order.order_no)}`)
  if (!conditions.length) return orderQuantity
  const rows = await request({
    url: `/purchase_arrivals?or=(${conditions.join(',')})&status=neq.deleted&select=arrival_quantity`,
    method: 'get',
    headers: { 'Accept-Profile': 'public' },
    silentError: true
  }).catch(() => [])
  return calculatePurchaseOrderPendingQuantity(order, rows)
}

const pushSingleOrderToArrival = async (order) => {
  assertPurchaseOrderFlowSource(order)
  await ensureOrderReadyForArrival(order)
  const arrivalQuantity = await getOrderPendingQuantity(order)
  if (arrivalQuantity <= 0) return { skipped: true, arrival: await findFirstArrivalForOrder(order) }
  const arrivalPayload = buildPurchaseOrderArrivalDraft({
    order,
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
  const completion = buildPurchaseOrderArrivalCompletion({
    order,
    arrival: createdArrival,
    arrivalPayload
  })
  await tryCreateDocumentLink(createDocumentLinkPayload(completion.documentLink))
  await writeFlowAudit(completion.audit)
  return { skipped: false, arrival: createdArrival }
}

const pushSelectedOrdersToArrivals = async () => {
  if (flowNextStep.value !== 'purchase_arrival') {
    ElMessage.warning('请选择要下推的下一流程')
    return
  }
  const rows = selectedOrderRows.value.length ? selectedOrderRows.value : getSelectedOrderRows()
  if (!rows.length) {
    ElMessage.warning('请先在表格中选择要下推的采购订单')
    return
  }
  flowActionLoading.value = true
  let createdCount = 0
  let skippedCount = 0
  const errors = []
  try {
    for (const row of rows) {
      try {
        const result = await pushSingleOrderToArrival(row)
        if (result.skipped) skippedCount += 1
        else createdCount += 1
      } catch (error) {
        errors.push(`${row.order_no || row.id}：${error?.message || '下推失败'}`)
      }
    }
    await gridRef.value?.loadData?.()
    if (primaryOrder.value) await loadOrderBusinessFlow(primaryOrder.value)
    if (errors.length) {
      ElMessage.warning(`下推完成 ${createdCount} 单，跳过 ${skippedCount} 单，失败 ${errors.length} 单`)
      console.warn('batch push purchase orders failed', errors)
      return
    }
    ElMessage.success(`已下推 ${createdCount} 单，跳过已到齐 ${skippedCount} 单`)
    flowDialogVisible.value = false
    await router.push('/app/arrivals')
  } finally {
    flowActionLoading.value = false
  }
}

const pushSingleArrivalToInbound = async (arrival) => {
  const inboundNo = arrival.inbound_no || nextDocNo('IN')
  const plan = buildPurchaseArrivalInboundPlan({ arrival, inboundNo })
  await request({
    url: `/purchase_arrivals?id=eq.${safeEq(arrival.id)}`,
    method: 'patch',
    headers: { 'Content-Profile': 'public', 'Accept-Profile': 'public' },
    data: plan.arrivalUpdate
  })
  await tryCreateDocumentLink(createDocumentLinkPayload(plan.documentLink))
  await writeFlowAudit(plan.audit)
  return { skipped: false, inboundNo }
}

const pushSelectedArrivalsToInbound = async () => {
  if (flowNextStep.value !== 'inventory_inbound') {
    ElMessage.warning('请选择要下推的下一流程')
    return
  }
  const rows = selectedArrivalRows.value.length ? selectedArrivalRows.value : getSelectedArrivalRows()
  if (!rows.length) {
    ElMessage.warning('请先在表格中选择要入库的到货单')
    return
  }
  flowActionLoading.value = true
  let createdCount = 0
  const errors = []
  try {
    for (const row of rows) {
      try {
        await pushSingleArrivalToInbound(row)
        createdCount += 1
      } catch (error) {
        errors.push(`${row.arrival_no || row.id}：${error?.message || '入库失败'}`)
      }
    }
    await gridRef.value?.loadData?.()
    if (primaryArrival.value) await loadArrivalBusinessFlow(primaryArrival.value)
    if (errors.length) {
      ElMessage.warning(`入库完成 ${createdCount} 单，失败 ${errors.length} 单`)
      console.warn('batch push arrivals inbound failed', errors)
      return
    }
    ElMessage.success(`已确认入库 ${createdCount} 单`)
    flowDialogVisible.value = false
    const navigation = navigateEnterprisePath('/materials/inventory-stock-in', { tabTitle: '采购入库' })
    if (!navigation.ok) {
      ElMessage.warning(navigation.reason === 'module-disabled'
        ? '仓储模块未启用，入库单已生成但无法打开目标页面'
        : '无法打开采购入库页面，请稍后重试')
    }
  } finally {
    flowActionLoading.value = false
  }
}

const confirmCurrentPush = () => {
  if (app.value.key === 'orders') return pushSelectedOrdersToArrivals()
  if (app.value.key === 'arrivals') return pushSelectedArrivalsToInbound()
  return pushSelectedDemandsToOrders()
}

const scheduleGridReload = () => {
  if (realtimeTimer) return
  realtimeTimer = setTimeout(() => {
    realtimeTimer = null
    if (gridRef.value?.loadData) {
      gridRef.value.loadData()
    }
  }, 600)
}

const parseRealtimePayload = (event) => {
  if (!event) return null
  if (event.payload && typeof event.payload === 'string') {
    try {
      return JSON.parse(event.payload)
    } catch (e) {
      return null
    }
  }
  return event.payload && typeof event.payload === 'object' ? event.payload : null
}

const handleRealtimeEvent = (event) => {
  const payload = parseRealtimePayload(event)
  if (!payload) return
  const tableName = (app.value.apiUrl || '').replace(/^\//, '').split('?')[0]
  if (payload.schema === 'public' && payload.table === tableName) {
    scheduleGridReload()
  }
}

const editColumn = (index) => {
  const col = extraColumns.value[index]
  currentCol.label = col.label
  currentCol.prop = col.prop
  currentCol.expression = col.expression || ''
  currentCol.options = Array.isArray(col.options)
    ? col.options.map(opt => ({
        label: opt.label ?? opt.value ?? ''
      }))
    : []
  currentCol.dependsOn = col.dependsOn || ''
  currentCol.cascaderMap = normalizePurchaseCascaderMap(col.cascaderOptions)
  Object.keys(cascaderInputMap).forEach((key) => delete cascaderInputMap[key])
  currentCol.geoAddress = col.geoAddress !== false
  currentCol.fileMaxSizeMb = col.fileMaxSizeMb || 20
  currentCol.fileMaxCount = col.fileMaxCount || 3
  currentCol.fileAccept = col.fileAccept || ''
  
  isEditing.value = true
  editingIndex.value = index
  
  if (col.type === 'formula') addTab.value = 'formula'
  else if (col.type === 'select' || col.type === 'dropdown') addTab.value = 'select'
  else if (col.type === 'cascader') addTab.value = 'cascader'
  else if (col.type === 'geo') addTab.value = 'geo'
  else if (col.type === 'file') addTab.value = 'file'
  else addTab.value = 'text'

  syncCascaderMap()
}

const resetForm = () => {
  isEditing.value = false
  editingIndex.value = -1
  currentCol.label = ''
  currentCol.prop = ''
  currentCol.expression = ''
  currentCol.options = []
  currentCol.dependsOn = ''
  currentCol.cascaderMap = {}
  Object.keys(cascaderInputMap).forEach((key) => delete cascaderInputMap[key])
  currentCol.geoAddress = true
  currentCol.fileMaxSizeMb = 20
  currentCol.fileMaxCount = 3
  currentCol.fileAccept = ''
  addTab.value = 'text'
  if (!colConfigVisible.value) {
    syncAiContext(lastLoadedRows.value, { aiScene: 'grid_chat', allowFormula: false })
  }
}

const getCascaderChildren = (key) => {
  const list = currentCol.cascaderMap[String(key)] || []
  return Array.isArray(list) ? list : []
}

const addCascaderChild = (key) => {
  const mapKey = String(key)
  const raw = cascaderInputMap[mapKey]
  const text = raw === null || raw === undefined ? '' : String(raw).trim()
  if (!text) return
  const list = currentCol.cascaderMap[mapKey] || []
  if (!list.includes(text)) {
    list.push(text)
  }
  currentCol.cascaderMap[mapKey] = list
  cascaderInputMap[mapKey] = ''
}

const removeCascaderChild = (key, child) => {
  const mapKey = String(key)
  const list = currentCol.cascaderMap[mapKey] || []
  currentCol.cascaderMap[mapKey] = list.filter(item => item !== child)
}

const saveColumn = async () => {
  if (!currentCol.label) return
  
  const type = addTab.value
  
  const colConfig = {
    label: currentCol.label,
    type: type
  }

  if (isEditing.value) {
    colConfig.prop = currentCol.prop
  } else {
    colConfig.prop = 'field_' + Math.floor(Math.random() * 10000)
  }

  if (type === 'formula') {
    colConfig.expression = currentCol.expression
  } else if (type === 'select') {
    colConfig.type = 'select'
    const toText = (val) => (val === null || val === undefined) ? '' : String(val)
    const cleanOptions = currentCol.options
      .map(opt => {
        const text = toText(opt.label).trim()
        return {
          label: text,
          value: text
        }
      })
      .filter(opt => opt.label)
    if (cleanOptions.length === 0) {
      ElMessage.warning('请至少添加一个选项')
      return
    }
    colConfig.options = cleanOptions
  } else if (type === 'cascader') {
    if (!currentCol.dependsOn) {
      ElMessage.warning('请选择上一级列')
      return
    }
    const parentCol = cascaderParentColumns.value.find(col => col.prop === currentCol.dependsOn)
    if (!parentCol) {
      ElMessage.warning('上一级必须是下拉或联动列')
      return
    }
    colConfig.dependsOn = currentCol.dependsOn
    const cascaderOptions = {}
    cascaderParentOptions.value.forEach((opt) => {
      const valueKey = String(opt.value)
      const labelKey = String(opt.label)
      const list = currentCol.cascaderMap[valueKey] || currentCol.cascaderMap[labelKey] || []
      const normalizedList = list.map(item => ({ label: item, value: item }))
      cascaderOptions[valueKey] = normalizedList
      if (labelKey !== valueKey && !(labelKey in cascaderOptions)) {
        cascaderOptions[labelKey] = normalizedList
      }
    })
    const hasAny = Object.values(cascaderOptions).some(list => Array.isArray(list) && list.length > 0)
    if (!hasAny) {
      ElMessage.warning('请至少给一个上一级配置下级选项')
      return
    }
    colConfig.cascaderOptions = cascaderOptions
  } else if (type === 'geo') {
    colConfig.geoAddress = !!currentCol.geoAddress
  } else if (type === 'file') {
    colConfig.fileMaxSizeMb = Math.max(1, Number(currentCol.fileMaxSizeMb) || 20)
    colConfig.fileMaxCount = Math.max(1, Number(currentCol.fileMaxCount) || 3)
    colConfig.fileAccept = currentCol.fileAccept?.trim() || ''
  }

  if (isEditing.value) {
    extraColumns.value[editingIndex.value] = colConfig
    ElMessage.success('列配置已更新')
  } else {
    extraColumns.value.push(colConfig)
    ElMessage.success('列已添加')
  }
  
  saveColumnsConfig()
  // 配置初始化与列权限同步已移至后端/SQL 脚本
  syncAiContext()
  resetForm()
}

const removeColumn = (index) => {
  extraColumns.value.splice(index, 1)
  saveColumnsConfig()
  syncAiContext()
  if (isEditing.value && editingIndex.value === index) {
    resetForm()
  }
}

const openColumnConfig = () => {
  colConfigVisible.value = true
}

const isStaticVisible = (prop) => !staticHidden.value.includes(prop)
const toggleStaticColumn = async (prop, visible) => {
  const has = staticHidden.value.includes(prop)
  if (visible && has) {
    staticHidden.value = staticHidden.value.filter(item => item !== prop)
  }
  if (!visible && !has) {
    staticHidden.value = [...staticHidden.value, prop]
  }
  await saveStaticColumnsConfig()
  syncAiContext()
}

const handleCreate = async () => {
  try {
    const payload = typeof app.value.createPayload === 'function'
      ? app.value.createPayload()
      : { name: '新记录', properties: {} }
    await request({
      url: app.value.writeUrl || app.value.apiUrl,
      method: 'post',
      headers: { 'Content-Profile': 'public', 'Accept-Profile': 'public' },
      data: payload
    })
    if(gridRef.value) await gridRef.value.loadData()
    ElMessage.success('已创建新行')
  } catch(e) {
    console.error(e)
    ElMessage.error('创建失败')
  }
}

const goApps = () => {
  router.push('/apps')
}

onMounted(() => {
  loadStaticColumnsConfig().then(loadColumnsConfig)
  if (enableRealtime.value) {
    const realtime = getRealtimeClient()
    realtimeUnsub = realtime.subscribe(handleRealtimeEvent)
  }
})

const handleApplyFormula = (event) => {
  const formula = event?.detail?.formula
  if (!formula) return
  if (!colConfigVisible.value || addTab.value !== 'formula') return
  currentCol.expression = formula
}

const handleImportDone = (event) => {
  const viewId = event?.detail?.viewId
  if (viewId && viewId !== app.value.viewId) return
  if (gridRef.value && typeof gridRef.value.loadData === 'function') {
    gridRef.value.loadData()
  }
}

watch([attentionFilter, gridApiUrl], () => {
  gridRef.value?.loadData?.()
})

onMounted(() => {
  window.addEventListener('eis-ai-apply-formula', handleApplyFormula)
  window.addEventListener('eis-grid-imported', handleImportDone)
})

onUnmounted(() => {
  window.removeEventListener('eis-ai-apply-formula', handleApplyFormula)
  window.removeEventListener('eis-grid-imported', handleImportDone)
  if (realtimeUnsub) realtimeUnsub()
  realtimeUnsub = null
  if (realtimeTimer) {
    clearTimeout(realtimeTimer)
    realtimeTimer = null
  }
  if (fieldLabelRetryTimer) {
    clearTimeout(fieldLabelRetryTimer)
    fieldLabelRetryTimer = null
  }
})
</script>

<style scoped>
.app-container {
  padding: 20px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.header-text h2 {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 700;
  color: #303133;
}

.header-text p {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

.attention-filter {
  flex: 0 0 auto;
}

.attention-filter :deep(.el-radio-button__inner) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 32px;
  line-height: 1;
}

.grid-card {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.detail-panel {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-summary {
  padding: 12px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background-color: #f8fafc;
}

.detail-name {
  font-size: 16px;
  font-weight: 700;
  color: #303133;
  word-break: break-word;
}

.detail-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}

.detail-descriptions :deep(.el-descriptions__label) {
  width: 120px;
  color: #606266;
}

.column-manager { padding: 0 5px; }
.section-title { font-weight: bold; margin-bottom: 10px; color: #303133; font-size: 14px; }
.empty-tip { color: #909399; font-size: 12px; margin-bottom: 10px; font-style: italic; }
.form-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }

.col-list { 
  max-height: 180px; 
  overflow-y: auto; 
  margin-bottom: 20px; 
  border: 1px solid #ebeef5; 
  padding: 5px; 
  border-radius: 4px; 
  background-color: #fafafa;
}
.col-item { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  padding: 6px 10px; 
  border-bottom: 1px solid #ebeef5; 
  background-color: #fff;
}
.col-item:last-child { border-bottom: none; }
.col-info { display: flex; align-items: center; }
.col-label { font-size: 13px; font-weight: 500; }
.col-actions { display: flex; align-items: center; }

.add-tabs { margin-top: 5px; box-shadow: none; border: 1px solid #dcdfe6; }
.form-row { display: flex; gap: 10px; }
.form-col { display: flex; flex-direction: column; }

.field-block { display: flex; flex-direction: column; gap: 4px; flex: 1; }
.field-label { font-size: 12px; color: #606266; }
.field-block .el-input-number { width: 100%; }

.formula-area { 
  background-color: #f5f7fa; 
  padding: 10px; 
  border-radius: 4px; 
  border: 1px solid #dcdfe6; 
}
.formula-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.formula-tip {
  font-size: 12px;
  color: #909399;
}
.options-config {
  margin-top: 8px;
  padding: 10px;
  background-color: #f5f7fa;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
}
.option-row {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.add-opt-btn { width: 100%; }
.cascader-map {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 4px;
}
.cascader-node {
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 8px;
  background: #fff;
}
.cascader-parent-row {
  display: inline-block;
  margin-bottom: 6px;
}
.cascader-parent {
  font-size: 12px;
  color: #606266;
  background: #f5f7fa;
  padding: 6px 8px;
  border-radius: 4px;
  text-align: center;
  border: 1px solid #e4e7ed;
}
.cascader-children {
  padding-left: 12px;
  border-left: 2px dashed #e4e7ed;
}
.cascader-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}
.cascader-add {
  display: flex;
  gap: 8px;
  align-items: center;
}
.cascader-add :deep(.el-input) { flex: 1; }
.variable-tags { margin-top: 8px; }
.tag-tip { font-size: 12px; color: #909399; display: block; margin-bottom: 4px; }
.tags-wrapper { display: flex; flex-wrap: wrap; gap: 6px; }
.cursor-pointer { cursor: pointer; user-select: none; }
.cursor-pointer:hover { opacity: 0.8; transform: translateY(-1px); transition: transform 0.1s; }

.hint-text { font-size: 12px; color: #909399; margin-top: 8px; line-height: 1.4; }

.business-flow-dialog {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.flow-push-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #f8fafc;
}

.flow-push-header span {
  color: #606266;
  font-size: 13px;
  margin-right: 8px;
}

.flow-push-header strong {
  color: #303133;
  font-size: 18px;
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
  color: var(--el-color-primary);
  font-weight: 700;
}

.flow-step.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
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

@media (max-width: 760px) {
  .app-container {
    padding: 12px;
  }

  .app-header {
    align-items: stretch;
    flex-direction: column;
    gap: 10px;
  }

  .flow-chain,
  .flow-doc-panel {
    grid-template-columns: 1fr;
  }

  .form-row {
    flex-direction: column;
  }
}
</style>
