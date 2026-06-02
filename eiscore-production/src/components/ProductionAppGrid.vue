<template>
  <div class="app-container">
    <div class="app-header">
      <div class="header-text">
        <h2>{{ app.name }}</h2>
        <p>{{ app.desc }}</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" plain @click="goApps">返回应用列表</el-button>
      </div>
    </div>

    <el-card
      shadow="never"
      class="grid-card"
      :body-style="{ height: '100%', display: 'flex', flexDirection: 'column' }"
    >
      <eis-data-grid
        ref="gridRef"
        :view-id="app.viewId"
        :api-url="app.apiUrl"
        :write-url="app.writeUrl || ''"
        :include-properties="app.includeProperties !== false"
        :write-mode="app.writeMode || 'patch'"
        :patch-required-fields="app.patchRequiredFields || []"
        :field-defaults="app.fieldDefaults || {}"
        :default-order="app.defaultOrder || defaultOrder"
        accept-profile="scm"
        content-profile="scm"
        :static-columns="staticColumns"
        :extra-columns="extraColumns"
        :summary="summaryConfig"
        :acl-module="app.aclModule"
        :show-status-col="app.showStatusCol !== false"
        :show-action-col="app.showActionCol !== false"
        :can-create="canCreateRows"
        :can-edit="canEditRows"
        :can-delete="canDeleteRows"
        :can-export="canExport"
        :can-config="canConfig"
        @create="handleCreate"
        @config-columns="openColumnConfig"
        @data-loaded="handleDataLoaded"
        @selection-changed="handleSelectionChanged"
      >
        <template #toolbar>
          <el-button
            v-if="app.key === 'bom_list'"
            type="primary"
            plain
            icon="Connection"
            @click="openBomWorkbench"
          >
            打开配方工作台
          </el-button>
          <el-button
            v-if="app.key === 'plans' && canGenerateWorkOrder"
            type="success"
            plain
            icon="Plus"
            :loading="generatingWorkOrders"
            @click="createWorkOrdersFromPlan"
          >
            生成/更新生产工单
          </el-button>
          <el-button
            v-if="app.key === 'work_orders' && canEditRows"
            type="primary"
            plain
            icon="Edit"
            :disabled="selectedRows.length !== 1"
            @click="openWorkOrderDrawer()"
          >
            处理工单
          </el-button>
          <el-button
            v-if="app.key === 'work_order_items' && canEditRows"
            type="primary"
            plain
            icon="EditPen"
            :disabled="selectedRows.length !== 1"
            @click="openIssueDrawer()"
          >
            登记领料
          </el-button>
        </template>
      </eis-data-grid>

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
                <el-input v-model="currentCol.label" placeholder="列名（比如：班组）" @keyup.enter="saveColumn" />
                <el-button type="primary" :disabled="!currentCol.label" @click="saveColumn">
                  {{ isEditing ? '保存修改' : '添加' }}
                </el-button>
              </div>
              <p class="hint-text">用于存放普通文字、数字或日期。</p>
            </el-tab-pane>

            <el-tab-pane label="下拉选项" name="select">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：产线）" style="margin-bottom: 10px;" />
                <div class="options-config">
                  <div v-for="(opt, idx) in currentCol.options" :key="idx" class="option-row">
                    <el-input v-model="opt.label" placeholder="选项内容" style="flex: 1;" />
                    <el-button type="danger" link @click="removeSelectOption(idx)">删除</el-button>
                  </div>
                  <el-button class="add-opt-btn" type="primary" plain size="small" @click="addSelectOption">+ 添加一项</el-button>
                </div>
                <el-button type="primary" style="margin-top: 10px; width: 100%;" :disabled="!currentCol.label" @click="saveColumn">
                  {{ isEditing ? '保存修改' : '添加下拉列' }}
                </el-button>
              </div>
            </el-tab-pane>

            <el-tab-pane label="联动选择" name="cascader">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：工序）" style="margin-bottom: 10px;" />

                <el-select
                  v-model="currentCol.dependsOn"
                  placeholder="先选哪一列（下拉或联动都可以）"
                  filterable
                  style="width: 100%; margin-bottom: 10px;"
                >
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

                <el-button type="primary" style="margin-top: 10px; width: 100%;" :disabled="!currentCol.label" @click="saveColumn">
                  {{ isEditing ? '保存修改' : '添加联动列' }}
                </el-button>
                <p class="hint-text">上面改了，下面会自动清空，避免选错。</p>
              </div>
            </el-tab-pane>

            <el-tab-pane label="地图位置" name="geo">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：生产位置）" style="margin-bottom: 10px;" />
                <el-switch v-model="currentCol.geoAddress" active-text="同时记录地址" inactive-text="只记经纬度" />
                <el-button type="primary" style="margin-top: 10px; width: 100%;" :disabled="!currentCol.label" @click="saveColumn">
                  {{ isEditing ? '保存修改' : '添加地图列' }}
                </el-button>
                <p class="hint-text">后面可在地图上点选位置。</p>
              </div>
            </el-tab-pane>

            <el-tab-pane label="文件" name="file">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：工艺附件）" style="margin-bottom: 10px;" />
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
                <el-input v-model="currentCol.fileAccept" placeholder="允许格式（可不写，比如 .pdf,.xlsx,image/*）" style="margin-top: 10px;" />
                <el-button type="primary" style="margin-top: 10px; width: 100%;" :disabled="!currentCol.label" @click="saveColumn">
                  {{ isEditing ? '保存修改' : '添加文件列' }}
                </el-button>
                <p class="hint-text">可上传工艺图纸、作业指导书、质检记录等文件。</p>
              </div>
            </el-tab-pane>

            <el-tab-pane label="自动计算" name="formula">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：完成率）" style="margin-bottom: 10px;" />
                <div class="formula-area">
                  <div class="formula-actions">
                    <el-button size="small" type="primary" plain @click="openAiFormula">AI生成公式</el-button>
                    <span class="formula-tip">把需求告诉工作助手，自动生成复杂公式</span>
                  </div>
                  <el-input
                    v-model="currentCol.expression"
                    type="textarea"
                    :rows="3"
                    placeholder="写计算方法（比如：{已领数量}/{需求数量}）"
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
                <el-button type="warning" style="margin-top: 10px; width: 100%;" :disabled="!currentCol.label || !currentCol.expression" @click="saveColumn">
                  {{ isEditing ? '保存计算修改' : '添加计算列' }}
                </el-button>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
        <template #footer>
          <el-button @click="colConfigVisible = false">关闭</el-button>
        </template>
      </el-dialog>

      <el-drawer
        v-model="workOrderDrawer.visible"
        title="处理生产工单"
        size="430px"
        append-to-body
        destroy-on-close
      >
        <div v-if="activeWorkOrder" class="business-drawer">
          <div class="drawer-summary">
            <span>当前工单</span>
            <strong>{{ activeWorkOrder.work_order_no }}</strong>
            <em>{{ activeWorkOrder.product_material_name || activeWorkOrder.product_material_code }}</em>
          </div>
          <el-form :model="workOrderDrawer.form" label-width="96px" class="business-form">
            <el-form-item label="工单状态">
              <el-select v-model="workOrderDrawer.form.work_order_status" style="width: 100%">
                <el-option v-for="item in workOrderStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="优先级">
              <el-select v-model="workOrderDrawer.form.priority" style="width: 100%">
                <el-option v-for="item in priorityOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="计划数量">
              <el-input-number v-model="workOrderDrawer.form.planned_qty" :min="0" :precision="3" controls-position="right" style="width: 100%" />
            </el-form-item>
            <el-form-item label="单位">
              <el-input v-model.trim="workOrderDrawer.form.unit" placeholder="盒/箱/千克" />
            </el-form-item>
            <el-form-item label="计划开始">
              <el-date-picker v-model="workOrderDrawer.form.planned_start_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
            <el-form-item label="计划完成">
              <el-date-picker v-model="workOrderDrawer.form.planned_finish_date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="workOrderDrawer.form.remark" type="textarea" :rows="4" placeholder="写清楚排产说明、异常原因或交付要求" />
            </el-form-item>
          </el-form>
        </div>
        <template #footer>
          <el-button @click="workOrderDrawer.visible = false">取消</el-button>
          <el-button type="primary" :loading="workOrderDrawer.saving" @click="saveWorkOrder">
            保存工单
          </el-button>
        </template>
      </el-drawer>

      <el-drawer
        v-model="issueDrawer.visible"
        title="登记领料"
        size="430px"
        append-to-body
        destroy-on-close
      >
        <div v-if="activeIssueRow" class="business-drawer">
          <div class="drawer-summary">
            <span>当前用料</span>
            <strong>{{ activeIssueRow.component_material_name || activeIssueRow.component_material_code }}</strong>
            <em>{{ activeIssueRow.work_order_no }} · 需求 {{ formatQty(activeIssueRow.required_qty) }} {{ activeIssueRow.unit }}</em>
          </div>
          <el-form :model="issueDrawer.form" label-width="96px" class="business-form">
            <el-form-item label="需求数量">
              <el-input :model-value="`${formatQty(activeIssueRow.required_qty)} ${activeIssueRow.unit || ''}`" disabled />
            </el-form-item>
            <el-form-item label="已领数量">
              <el-input-number v-model="issueDrawer.form.issued_qty" :min="0" :precision="3" controls-position="right" style="width: 100%" />
            </el-form-item>
            <el-form-item label="缺料数量">
              <el-input :model-value="`${formatQty(issueShortageQty)} ${activeIssueRow.unit || ''}`" disabled />
            </el-form-item>
            <el-form-item label="领料状态">
              <el-select v-model="issueDrawer.form.issue_status" style="width: 100%">
                <el-option v-for="item in issueStatusOptions" :key="item.value" :label="item.label" :value="item.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="备注">
              <el-input v-model="issueDrawer.form.remark" type="textarea" :rows="4" placeholder="记录领料批次、缺料原因或补料说明" />
            </el-form-item>
          </el-form>
        </div>
        <template #footer>
          <el-button @click="issueDrawer.visible = false">取消</el-button>
          <el-button type="primary" :loading="issueDrawer.saving" @click="saveIssue">
            保存领料
          </el-button>
        </template>
      </el-drawer>
    </el-card>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import EisDataGrid from '@/components/eis-data-grid-v2/index.vue'
import request from '@/utils/request'
import { pushAiCommand, pushAiContext } from '@/utils/ai-context'
import {
  findProductionApp,
  ISSUE_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  WORK_ORDER_COLUMNS,
  WORK_ORDER_STATUS_OPTIONS
} from '@/utils/production-apps'
import { hasPerm } from '@/utils/permission'

const props = defineProps({
  appKey: { type: String, default: 'work_orders' },
  appConfig: { type: Object, default: null }
})

const router = useRouter()
const gridRef = ref(null)
const lastLoadedRows = ref([])
const lastSearchText = ref('')
const colConfigVisible = ref(false)
const extraColumns = ref([])
const staticHidden = ref([])
const addTab = ref('text')
const isEditing = ref(false)
const editingIndex = ref(-1)
const generatingWorkOrders = ref(false)
const selectedRows = ref([])

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

const workOrderStatusOptions = WORK_ORDER_STATUS_OPTIONS
const priorityOptions = PRIORITY_OPTIONS
const issueStatusOptions = ISSUE_STATUS_OPTIONS

const workOrderDrawer = reactive({
  visible: false,
  saving: false,
  row: null,
  form: {
    work_order_status: '待排产',
    priority: '普通',
    planned_qty: 0,
    unit: '',
    planned_start_date: '',
    planned_finish_date: '',
    remark: ''
  }
})

const issueDrawer = reactive({
  visible: false,
  saving: false,
  row: null,
  form: {
    issued_qty: 0,
    shortage_qty: 0,
    issue_status: '未领料',
    remark: ''
  }
})

const app = computed(() => props.appConfig || findProductionApp(props.appKey) || findProductionApp('work_orders'))
const defaultOrder = computed(() => {
  if (app.value.key === 'plans') return 'product_material_code.asc'
  if (app.value.key === 'work_order_items') return 'work_order_no.asc,line_no.asc'
  return 'created_at.desc'
})
const opPerms = computed(() => app.value?.ops || {})
const canGenerateWorkOrder = computed(() => hasPerm('op:production_work_order.create'))
const canCreate = computed(() => hasPerm(opPerms.value.create))
const canEdit = computed(() => hasPerm(opPerms.value.edit))
const canDelete = computed(() => hasPerm(opPerms.value.delete))
const canExport = computed(() => hasPerm(opPerms.value.export))
const canConfig = computed(() => hasPerm(opPerms.value.config))
const canCreateRows = computed(() => app.value.canCreateRows !== false && canCreate.value)
const canEditRows = computed(() => app.value.canEditRows !== false && canEdit.value)
const canDeleteRows = computed(() => app.value.canDeleteRows !== false && canDelete.value)

const staticColumnsAll = computed(() => app.value.staticColumns || WORK_ORDER_COLUMNS)
const staticColumns = computed(() => staticColumnsAll.value.filter(col => !staticHidden.value.includes(col.prop)))
const summaryConfig = computed(() => app.value.summaryConfig || { label: '总计', rules: {}, expressions: {} })
const activeWorkOrder = computed(() => workOrderDrawer.row)
const activeIssueRow = computed(() => issueDrawer.row)
const issueShortageQty = computed(() => {
  const required = Number(activeIssueRow.value?.required_qty || 0)
  const issued = Number(issueDrawer.form.issued_qty || 0)
  return Math.max(required - issued, 0)
})
const allAvailableColumns = computed(() => {
  const all = [...staticColumns.value, ...extraColumns.value]
  if (isEditing.value) {
    return all.filter((c, i) => i !== (staticColumns.value.length + editingIndex.value))
  }
  return all
})

const isSelectColumnConfig = (col) => {
  if (!col) return false
  if (col.type === 'select' || col.type === 'dropdown') return true
  if (Array.isArray(col.options) && col.options.length > 0) return true
  return false
}

const isCascaderColumnConfig = (col) => {
  if (!col) return false
  if (col.type !== 'cascader') return false
  if (col.cascaderOptions && Object.keys(col.cascaderOptions).length > 0) return true
  return false
}

const cascaderParentColumns = computed(() => {
  return allAvailableColumns.value.filter(col => isSelectColumnConfig(col) || isCascaderColumnConfig(col) || col.type === 'cascader')
})

const normalizeCascaderOption = (opt) => {
  if (opt === null || opt === undefined) return null
  if (typeof opt === 'string' || typeof opt === 'number') {
    const text = String(opt)
    return { label: text, value: text }
  }
  const label = opt.label ?? opt.value ?? ''
  const value = opt.value ?? opt.label ?? ''
  const labelText = String(label || value)
  const valueText = String(value || label)
  return { label: labelText, value: valueText }
}

const cascaderParentOptions = computed(() => {
  const parentCol = cascaderParentColumns.value.find(col => col.prop === currentCol.dependsOn)
  if (!parentCol) return []
  if (Array.isArray(parentCol.options)) {
    return parentCol.options
      .map(normalizeCascaderOption)
      .filter(opt => opt && opt.label !== '')
  }
  if (parentCol.type === 'cascader' && parentCol.cascaderOptions) {
    const list = []
    const seen = new Set()
    Object.values(parentCol.cascaderOptions).forEach((items) => {
      if (!Array.isArray(items)) return
      items.forEach((item) => {
        const normalized = normalizeCascaderOption(item)
        if (!normalized || normalized.label === '') return
        const key = String(normalized.value)
        if (seen.has(key)) return
        seen.add(key)
        list.push(normalized)
      })
    })
    return list
  }
  return []
})

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

const cloneColumns = (cols) => JSON.parse(JSON.stringify(cols || []))

const getConfigKey = () => app.value.configKey || `${app.value.viewId || app.value.key}_cols`

const loadColumnsConfig = async () => {
  const configKey = getConfigKey()
  try {
    const res = await request({
      url: `/system_configs?key=eq.${configKey}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    if (Array.isArray(res) && res.length > 0 && Array.isArray(res[0].value)) {
      extraColumns.value = res[0].value
    } else {
      extraColumns.value = cloneColumns(app.value.defaultExtraColumns || [])
      if (extraColumns.value.length > 0) {
        await saveColumnsConfig()
      }
    }
    syncAiContext()
  } catch (e) {
    extraColumns.value = cloneColumns(app.value.defaultExtraColumns || [])
  }
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
    staticHidden.value = Array.isArray(hidden) ? hidden.filter(prop => props.has(prop)) : []
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

const saveColumnsConfig = async () => {
  await request({
    url: '/system_configs',
    method: 'post',
    headers: { 'Prefer': 'resolution=merge-duplicates', 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: { key: getConfigKey(), value: extraColumns.value }
  })
}

const buildDataStats = (rows) => {
  const stats = { totalCount: 0, statusCounts: {}, productCounts: {} }
  if (!Array.isArray(rows)) return stats
  stats.totalCount = rows.length
  rows.forEach((row) => {
    const status = row?.work_order_status || row?.plan_status || row?.issue_status || row?.status || '未设置'
    stats.statusCounts[status] = (stats.statusCounts[status] || 0) + 1
    const product = row?.product_material_code || row?.product_material_name
    if (product) stats.productCounts[product] = (stats.productCounts[product] || 0) + 1
  })
  return stats
}

const buildDataSample = (rows, columns, limit = 50) => {
  if (!Array.isArray(rows)) return []
  return rows.slice(0, limit).map((row) => {
    const item = {}
    columns.forEach((col) => {
      const prop = col.prop
      if (!prop || col.type === 'file' || col.type === 'geo') return
      const value = row?.[prop] ?? row?.properties?.[prop]
      if (value !== undefined && value !== null && value !== '') item[prop] = value
    })
    if (row?.id !== undefined) item.id = row.id
    return item
  })
}

const syncAiContext = (rows = lastLoadedRows.value, overrides = {}) => {
  const columns = [...staticColumns.value, ...extraColumns.value].map(col => ({
    label: col.label,
    prop: col.prop,
    type: col.type || 'text',
    options: col.options || [],
    dependsOn: col.dependsOn || '',
    cascaderOptions: col.cascaderOptions || null,
    expression: col.expression || ''
  }))
  const fileColumns = columns.filter(col => col.type === 'file')
  pushAiContext({
    app: 'production',
    view: app.value.key,
    viewId: app.value.viewId,
    apiUrl: app.value.apiUrl,
    profile: 'scm',
    columns,
    staticColumns: staticColumns.value,
    extraColumns: extraColumns.value,
    summaryConfig: summaryConfig.value,
    fileColumns,
    dataStats: buildDataStats(rows),
    dataSample: buildDataSample(rows, columns, 40),
    dataScope: (overrides.searchText ?? lastSearchText.value) ? '当前搜索结果' : '当前列表数据',
    searchText: overrides.searchText ?? lastSearchText.value ?? '',
    aiScene: overrides.aiScene || 'grid_chat',
    allowFormula: !!overrides.allowFormula,
    allowFormulaOnce: !!overrides.allowFormulaOnce,
    allowImport: false,
    importTarget: {
      apiUrl: app.value.writeUrl || app.value.apiUrl,
      profile: 'scm',
      viewId: app.value.viewId
    }
  })
}

const handleDataLoaded = (payload) => {
  const rows = Array.isArray(payload?.rows) ? payload.rows : []
  lastLoadedRows.value = rows
  lastSearchText.value = payload?.searchText || ''
  syncAiContext(rows, { searchText: lastSearchText.value })
}

const handleSelectionChanged = (rows) => {
  selectedRows.value = Array.isArray(rows) ? rows.filter(row => !row?.__pinned) : []
}

const addSelectOption = () => {
  currentCol.options.push({ label: '' })
}

const removeSelectOption = (index) => {
  currentCol.options.splice(index, 1)
}

const insertVariable = (label) => {
  currentCol.expression += `{${label}}`
}

const buildFormulaPrompt = () => {
  const label = currentCol.label || '计算列'
  const variables = allAvailableColumns.value.map(col => col.label).join('、')
  return [
    '请帮我生成生产模块表格“自动计算”公式。',
    `目标列：${label}`,
    '要求：只输出公式，不要解释。',
    '必须放在 ```formula``` 代码块中，内容示例：{需求数量}-{已领数量}。',
    `可用字段：${variables || '无'}。`
  ].join('\n')
}

const openAiFormula = () => {
  syncAiContext(lastLoadedRows.value, { aiScene: 'column_formula', allowFormulaOnce: true })
  pushAiCommand({
    id: `production_formula_${Date.now()}`,
    type: 'open-worker',
    prompt: buildFormulaPrompt()
  })
}

const editColumn = (index) => {
  const col = extraColumns.value[index]
  currentCol.label = col.label
  currentCol.prop = col.prop
  currentCol.expression = col.expression || ''
  currentCol.options = Array.isArray(col.options)
    ? col.options.map(opt => ({ label: opt.label ?? opt.value ?? '' }))
    : []
  currentCol.dependsOn = col.dependsOn || ''
  currentCol.cascaderMap = normalizeCascaderMap(col.cascaderOptions)
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

const normalizeCascaderMap = (map) => {
  const result = {}
  if (!map || typeof map !== 'object') return result
  Object.entries(map).forEach(([key, list]) => {
    if (!Array.isArray(list)) return
    const normalized = list
      .map((item) => {
        if (item === null || item === undefined) return ''
        if (typeof item === 'string' || typeof item === 'number') return String(item)
        const label = item.label ?? item.value ?? ''
        return String(label)
      })
      .filter(Boolean)
    result[String(key)] = normalized
  })
  return result
}

const saveColumn = async () => {
  if (!currentCol.label) return
  const type = addTab.value
  const colConfig = {
    label: currentCol.label,
    prop: isEditing.value ? currentCol.prop : `field_${Math.floor(Math.random() * 10000)}`,
    type
  }
  if (type === 'formula') {
    colConfig.expression = currentCol.expression
  } else if (type === 'select') {
    const options = currentCol.options
      .map(opt => String(opt.label || '').trim())
      .filter(Boolean)
      .map(text => ({ label: text, value: text }))
    if (!options.length) {
      ElMessage.warning('请至少添加一个选项')
      return
    }
    colConfig.options = options
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
  await saveColumnsConfig()
  syncAiContext()
  resetForm()
}

const removeColumn = async (index) => {
  extraColumns.value.splice(index, 1)
  await saveColumnsConfig()
  syncAiContext()
  if (isEditing.value && editingIndex.value === index) resetForm()
}

const openColumnConfig = () => {
  colConfigVisible.value = true
}

const isStaticVisible = (prop) => !staticHidden.value.includes(prop)
const toggleStaticColumn = async (prop, visible) => {
  const has = staticHidden.value.includes(prop)
  if (visible && has) staticHidden.value = staticHidden.value.filter(item => item !== prop)
  if (!visible && !has) staticHidden.value = [...staticHidden.value, prop]
  await saveStaticColumnsConfig()
  syncAiContext()
}

const handleCreate = async () => {
  if (app.value.createDisabledTip) {
    ElMessage.info(app.value.createDisabledTip)
    return
  }
  ElMessage.info('该生产应用不支持手工新增')
}

const formatDateValue = (value) => {
  if (!value) return ''
  return String(value).slice(0, 10)
}

const formatQty = (value) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0'
  if (Number.isInteger(num)) return String(num)
  return num.toFixed(3).replace(/\.?0+$/, '')
}

const getSingleSelectedRow = (tip) => {
  if (selectedRows.value.length !== 1) {
    ElMessage.warning(tip || '请先选中一行')
    return null
  }
  return selectedRows.value[0]
}

const openBomWorkbench = () => {
  router.push('/bom')
}

const openWorkOrderDrawer = (row = null) => {
  const target = row || getSingleSelectedRow('请先选中一张生产工单')
  if (!target?.id) return
  workOrderDrawer.row = target
  Object.assign(workOrderDrawer.form, {
    work_order_status: target.work_order_status || '待排产',
    priority: target.priority || '普通',
    planned_qty: Number(target.planned_qty || 0),
    unit: target.unit || '',
    planned_start_date: formatDateValue(target.planned_start_date),
    planned_finish_date: formatDateValue(target.planned_finish_date),
    remark: target.remark || ''
  })
  workOrderDrawer.visible = true
}

const openIssueDrawer = (row = null) => {
  const target = row || getSingleSelectedRow('请先选中一条领料明细')
  if (!target?.id) return
  issueDrawer.row = target
  Object.assign(issueDrawer.form, {
    issued_qty: Number(target.issued_qty || 0),
    shortage_qty: Number(target.shortage_qty || 0),
    issue_status: target.issue_status || '未领料',
    remark: target.remark || ''
  })
  issueDrawer.visible = true
}

const refreshCurrentGrid = async () => {
  await gridRef.value?.loadData?.()
  gridRef.value?.refreshCells?.({ force: true })
}

const saveWorkOrder = async () => {
  const row = workOrderDrawer.row
  if (!row?.id) return
  workOrderDrawer.saving = true
  try {
    const payload = {
      work_order_status: workOrderDrawer.form.work_order_status || '待排产',
      priority: workOrderDrawer.form.priority || '普通',
      planned_qty: Number(workOrderDrawer.form.planned_qty || 0),
      unit: workOrderDrawer.form.unit || '盒',
      planned_start_date: workOrderDrawer.form.planned_start_date || null,
      planned_finish_date: workOrderDrawer.form.planned_finish_date || null,
      remark: workOrderDrawer.form.remark || null
    }
    await request({
      url: `/production_work_orders?id=eq.${encodeURIComponent(row.id)}`,
      method: 'patch',
      headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm', Prefer: 'return=representation' },
      data: payload
    })
    ElMessage.success('工单已保存')
    workOrderDrawer.visible = false
    await refreshCurrentGrid()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error.message || '工单保存失败')
  } finally {
    workOrderDrawer.saving = false
  }
}

const inferIssueStatus = (issuedQty, requiredQty) => {
  const issued = Number(issuedQty || 0)
  const required = Number(requiredQty || 0)
  if (required > 0 && issued >= required) return '已齐套'
  if (issued > 0) return '部分领料'
  return '未领料'
}

watch(
  () => issueDrawer.form.issued_qty,
  () => {
    if (!issueDrawer.visible || !activeIssueRow.value) return
    issueDrawer.form.shortage_qty = issueShortageQty.value
    issueDrawer.form.issue_status = inferIssueStatus(issueDrawer.form.issued_qty, activeIssueRow.value.required_qty)
  }
)

const saveIssue = async () => {
  const row = issueDrawer.row
  if (!row?.id) return
  issueDrawer.saving = true
  try {
    const payload = {
      issued_qty: Number(issueDrawer.form.issued_qty || 0),
      shortage_qty: Number(issueShortageQty.value || 0),
      issue_status: issueDrawer.form.issue_status || inferIssueStatus(issueDrawer.form.issued_qty, row.required_qty),
      remark: issueDrawer.form.remark || null
    }
    await request({
      url: `/production_work_order_items?id=eq.${encodeURIComponent(row.id)}`,
      method: 'patch',
      headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm', Prefer: 'return=representation' },
      data: payload
    })
    ElMessage.success('领料已保存')
    issueDrawer.visible = false
    await refreshCurrentGrid()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error.message || '领料保存失败')
  } finally {
    issueDrawer.saving = false
  }
}

const createWorkOrdersFromPlan = async () => {
  generatingWorkOrders.value = true
  try {
    const rows = await request({
      url: '/rpc/create_work_orders_from_sales_bom',
      method: 'post',
      headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
      data: { p_created_by: getCurrentUserName() || 'BOM-MRP' }
    })
    ElMessage.success(`已生成/更新 ${Array.isArray(rows) ? rows.length : 0} 张生产工单`)
    await gridRef.value?.loadData?.()
  } catch (error) {
    ElMessage.error(error?.response?.data?.message || error.message || '生成生产工单失败')
  } finally {
    generatingWorkOrders.value = false
  }
}

const getCurrentUserName = () => {
  try {
    const info = JSON.parse(localStorage.getItem('user_info') || '{}')
    return info.username || info.name || info.id || 'BOM-MRP'
  } catch {
    return 'BOM-MRP'
  }
}

const goApps = () => {
  router.push('/apps')
}

const handleApplyFormula = (event) => {
  const formula = event?.detail?.formula
  if (!formula) return
  if (!colConfigVisible.value || addTab.value !== 'formula') return
  currentCol.expression = formula
}

onMounted(() => {
  loadStaticColumnsConfig().then(loadColumnsConfig)
  window.addEventListener('eis-ai-apply-formula', handleApplyFormula)
})

onUnmounted(() => {
  window.removeEventListener('eis-ai-apply-formula', handleApplyFormula)
})
</script>

<style scoped>
.app-container {
  min-height: 0;
  height: 100vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 16px;
  background: #f5f7fb;
}

.app-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.header-text {
  min-width: 0;
}

.header-text h2 {
  margin: 0 0 6px;
  color: #303133;
  font-size: 20px;
  font-weight: 700;
}

.header-text p {
  margin: 0;
  color: #909399;
  font-size: 12px;
}

.header-actions {
  flex-shrink: 0;
}

.grid-card {
  min-height: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
}

.column-manager { padding: 0 5px; }
.section-title { margin-bottom: 10px; color: #303133; font-size: 14px; font-weight: 700; }
.empty-tip { margin-bottom: 10px; color: #909399; font-size: 12px; font-style: italic; }
.form-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 5px; }

.col-list {
  max-height: 180px;
  overflow-y: auto;
  margin-bottom: 20px;
  padding: 5px;
  border: 1px solid #ebeef5;
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
.field-label { color: #606266; font-size: 12px; }
.field-block .el-input-number { width: 100%; }

.formula-area,
.options-config {
  margin-top: 8px;
  padding: 10px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background-color: #f5f7fa;
}

.formula-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.formula-tip,
.tag-tip,
.hint-text {
  color: #909399;
  font-size: 12px;
}

.option-row {
  display: flex;
  align-items: center;
  gap: 8px;
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
  padding: 8px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #fff;
}
.cascader-parent-row {
  display: inline-block;
  margin-bottom: 6px;
}
.cascader-parent {
  padding: 6px 8px;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  background: #f5f7fa;
  color: #606266;
  font-size: 12px;
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
  align-items: center;
  gap: 8px;
}
.cascader-add :deep(.el-input) { flex: 1; }
.variable-tags { margin-top: 8px; }
.tag-tip { display: block; margin-bottom: 4px; }
.tags-wrapper { display: flex; flex-wrap: wrap; gap: 6px; }
.cursor-pointer { cursor: pointer; user-select: none; }
.business-drawer {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.drawer-summary {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 12px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  background: #f8fafc;
}
.drawer-summary span {
  color: #909399;
  font-size: 12px;
}
.drawer-summary strong {
  color: #303133;
  font-size: 16px;
}
.drawer-summary em {
  color: #606266;
  font-size: 13px;
  font-style: normal;
}
.business-form :deep(.el-form-item) {
  margin-bottom: 14px;
}

:global(#app.dark) .app-container {
  background-color: #0b0f14;
}

:global(#app.dark) .grid-card,
:global(#app.dark) .col-item,
:global(#app.dark) .cascader-node,
:global(#app.dark) .drawer-summary {
  background-color: #111827;
  border-color: #1f2937;
}

:global(#app.dark) .header-text h2,
:global(#app.dark) .section-title,
:global(#app.dark) .col-label,
:global(#app.dark) .drawer-summary strong {
  color: #f3f4f6;
}

@media (max-width: 760px) {
  .app-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
