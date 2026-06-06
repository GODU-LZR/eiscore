<template>
  <div class="app-container">
    <div class="app-header">
      <div class="header-text">
        <h2>{{ app.name }}</h2>
        <p>{{ app.desc }}</p>
      </div>
      <el-button type="primary" plain @click="goApps">返回应用列表</el-button>
    </div>

    <section class="attention-strip" :class="`attention-${attentionSummary.level}`">
      <div class="attention-main">
        <span>当前关注</span>
        <strong>{{ attentionSummary.primary.title || app.name }}</strong>
        <small>{{ attentionSummary.primary.reason }}</small>
      </div>
      <div class="attention-counts">
        <div
          v-for="item in attentionCountItems"
          :key="item.key"
          class="attention-count"
          :class="`count-${item.key}`"
        >
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
      <div class="attention-next">
        <el-tag :type="attentionSummary.primary.tagType" effect="plain">{{ attentionSummary.primary.label }}</el-tag>
        <span>{{ attentionSummary.primary.action }}</span>
      </div>
    </section>

    <el-card
      shadow="never"
      class="grid-card"
      :body-style="{ height: '100%', display: 'flex', flexDirection: 'column' }"
    >
      <eis-data-grid
        v-if="!fallbackMode"
        ref="gridRef"
        :view-id="app.viewId"
        :api-url="app.apiUrl"
        :write-url="app.writeUrl"
        :write-mode="app.writeMode || 'patch'"
        :include-properties="app.includeProperties !== false"
        :field-defaults="fieldDefaults"
        :patch-required-fields="requiredFields"
        :static-columns="staticColumns"
        :extra-columns="extraColumns"
        :summary="summaryConfig"
        :acl-module="app.aclModule"
        :accept-profile="app.acceptProfile || 'public'"
        :content-profile="app.contentProfile || 'public'"
        :can-create="canCreate"
        :can-edit="canEdit"
        :can-delete="canDelete"
        :can-export="canExport"
        :can-config="canConfig"
        :attention-resolver="resolveAttention"
        :row-filter="rowAttentionFilter"
        @create="handleCreate"
        @config-columns="openColumnConfig"
        @view-document="handleViewDocument"
        @data-loaded="handleDataLoaded"
        @data-load-error="handleDataLoadError"
        @cell-value-changed="handleGridCellValueChanged"
      >
        <template #toolbar>
          <el-radio-group v-model="attentionFilter" size="small" class="attention-filter">
            <el-radio-button
              v-for="option in attentionFilterOptions"
              :key="option.value"
              :label="option.value"
            >
              {{ option.label }}
            </el-radio-button>
          </el-radio-group>
        </template>
      </eis-data-grid>

      <div v-else class="fallback-grid">
        <div class="fallback-toolbar">
          <el-input v-model="fallbackSearch" clearable placeholder="搜索演示数据" style="width: 260px" />
          <el-radio-group v-model="attentionFilter" size="small" class="attention-filter">
            <el-radio-button
              v-for="option in attentionFilterOptions"
              :key="option.value"
              :label="option.value"
            >
              {{ option.label }}
            </el-radio-button>
          </el-radio-group>
          <el-button type="primary" plain @click="fallbackMode = false">重试连接数据表</el-button>
        </div>
        <el-table :data="filteredFallbackRows" :row-class-name="fallbackRowClassName" border height="100%">
          <el-table-column label="关注" width="88" fixed="left" align="center">
            <template #default="{ row }">
              <el-tag :type="resolveAttention(row).tagType" effect="plain" size="small">
                {{ resolveAttention(row).label }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column
            v-for="col in staticColumns"
            :key="col.prop"
            :prop="col.prop"
            :label="col.label"
            :width="col.width"
            :min-width="col.minWidth"
          />
          <el-table-column label="操作" width="110" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="handleViewDocument(row)">表单</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <el-dialog v-model="colConfigVisible" title="列管理" width="600px" append-to-body destroy-on-close @closed="resetColumnForm">
        <div class="column-manager">
          <p class="section-title">已添加的列：</p>
          <div v-if="extraColumns.length === 0" class="empty-tip">还没有新增列</div>
          <div class="col-list">
            <div v-for="(col, index) in extraColumns" :key="col.prop || index" class="col-item">
              <div class="col-info">
                <span class="col-label">{{ col.label }}</span>
                <el-tag v-if="col.type === 'formula'" size="small" type="warning" effect="plain">计算</el-tag>
              </div>
              <div class="col-actions">
                <el-button type="danger" link icon="Delete" @click="removeColumn(index)">删除</el-button>
              </div>
            </div>
          </div>

          <el-divider />

          <p class="section-title">新增列：</p>
          <el-tabs v-model="addTab" type="border-card" class="add-tabs">
            <el-tab-pane label="普通文字" name="text">
              <div class="form-row">
                <el-input v-model="currentCol.label" placeholder="列名（比如：检验标准）" @keyup.enter="saveColumn" />
                <el-button type="primary" :disabled="!currentCol.label" @click="saveColumn">添加</el-button>
              </div>
            </el-tab-pane>
            <el-tab-pane label="下拉选项" name="select">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：处置建议）" />
                <div class="option-row" v-for="(opt, idx) in currentCol.options" :key="idx">
                  <el-input v-model="opt.label" placeholder="选项内容" />
                  <el-button type="danger" link @click="currentCol.options.splice(idx, 1)">删除</el-button>
                </div>
                <el-button type="primary" plain size="small" @click="currentCol.options.push({ label: '' })">添加选项</el-button>
                <el-button type="primary" :disabled="!currentCol.label" @click="saveColumn">添加下拉列</el-button>
              </div>
            </el-tab-pane>
            <el-tab-pane label="联动选择" name="cascader">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：缺陷原因）" />
                <el-select v-model="currentCol.dependsOn" placeholder="选择上级列" filterable>
                  <el-option v-for="col in cascaderParentColumns" :key="col.prop" :label="col.label" :value="col.prop" />
                </el-select>
                <div v-if="currentCol.dependsOn" class="cascader-map">
                  <div v-for="opt in cascaderParentOptions" :key="opt.value" class="cascader-node">
                    <span class="cascader-parent">{{ opt.label }}</span>
                    <div class="cascader-children">
                      <el-tag
                        v-for="child in getCascaderChildren(opt.value)"
                        :key="child"
                        closable
                        size="small"
                        @close="removeCascaderChild(opt.value, child)"
                      >
                        {{ child }}
                      </el-tag>
                      <div class="cascader-add">
                        <el-input
                          v-model="cascaderInputMap[opt.value]"
                          placeholder="输入下级选项"
                          @keyup.enter="addCascaderChild(opt.value)"
                        />
                        <el-button type="primary" plain @click="addCascaderChild(opt.value)">添加</el-button>
                      </div>
                    </div>
                  </div>
                  <div v-if="cascaderParentOptions.length === 0" class="empty-tip">上级列需要先配置选项</div>
                </div>
                <el-button type="primary" :disabled="!currentCol.label || !currentCol.dependsOn" @click="saveColumn">添加联动列</el-button>
              </div>
            </el-tab-pane>
            <el-tab-pane label="地图位置" name="geo">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：异常位置）" />
                <el-switch v-model="currentCol.geoAddress" active-text="记录地址" inactive-text="只记经纬度" />
                <el-button type="primary" :disabled="!currentCol.label" @click="saveColumn">添加地图列</el-button>
              </div>
            </el-tab-pane>
            <el-tab-pane label="文件附件" name="file">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：整改证据）" />
                <div class="form-row">
                  <el-input-number v-model="currentCol.fileMaxCount" :min="1" :max="20" controls-position="right" />
                  <el-input-number v-model="currentCol.fileMaxSizeMb" :min="1" :max="100" controls-position="right" />
                </div>
                <el-input v-model="currentCol.fileAccept" placeholder="允许格式（可选，比如 .jpg,.pdf）" />
                <el-button type="primary" :disabled="!currentCol.label" @click="saveColumn">添加文件列</el-button>
              </div>
            </el-tab-pane>
            <el-tab-pane label="自动计算" name="formula">
              <div class="form-col">
                <el-input v-model="currentCol.label" placeholder="列名（比如：不良率）" />
                <el-input v-model="currentCol.expression" type="textarea" :rows="3" placeholder="比如：{不良数}/{抽检数}*100" />
                <el-button type="warning" :disabled="!currentCol.label || !currentCol.expression" @click="saveColumn">添加计算列</el-button>
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

import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import EisDataGrid from '@/components/eis-data-grid-v2/index.vue'
import request from '@/utils/request'
import { pushAiContext } from '@/utils/ai-context'
import { findQualityApp } from '@/utils/quality-apps'
import { hasPerm } from '@/utils/permission'
import {
  buildQualityAttentionSummary,
  getQualityRecordAttention
} from '@/utils/quality-attention'

const props = defineProps({
  appKey: { type: String, default: 'inspections' },
  appConfig: { type: Object, default: null }
})

const router = useRouter()
const gridRef = ref(null)
const colConfigVisible = ref(false)
const addTab = ref('text')
const extraColumns = ref([])
const fallbackMode = ref(false)
const fallbackSearch = ref('')
const loadedRows = ref([])
const attentionFilter = ref('all')

const currentCol = reactive({
  label: '',
  expression: '',
  options: [{ label: '合格' }, { label: '不合格' }],
  dependsOn: '',
  cascaderOptionsMap: {},
  geoAddress: true,
  fileMaxCount: 5,
  fileMaxSizeMb: 20,
  fileAccept: ''
})

const cascaderInputMap = reactive({})

const app = computed(() => props.appConfig || findQualityApp(props.appKey) || findQualityApp('inspections'))
const staticColumns = computed(() => app.value?.staticColumns || [])
const summaryConfig = computed(() => app.value?.summaryConfig || { label: '总计', rules: {}, expressions: {}, cellLabels: {} })
const requiredFields = computed(() => (app.value?.staticColumns || []).filter((col) => col.editable === false).map((col) => col.prop).filter(Boolean))
const fieldDefaults = computed(() => {
  const payload = app.value?.createPayload?.() || {}
  const defaults = {}
  Object.keys(payload).forEach((key) => {
    if (key !== 'id') defaults[key] = payload[key]
  })
  return defaults
})

const opPerms = computed(() => app.value?.ops || {})
const canCreate = computed(() => hasPerm(opPerms.value.create))
const canEdit = computed(() => hasPerm(opPerms.value.edit))
const canDelete = computed(() => hasPerm(opPerms.value.delete))
const canExport = computed(() => hasPerm(opPerms.value.export))
const canConfig = computed(() => hasPerm(opPerms.value.config))

const attentionRows = computed(() => loadedRows.value.length ? loadedRows.value : (app.value?.fallbackRows || []))
const attentionSummary = computed(() => buildQualityAttentionSummary(app.value?.key, attentionRows.value))
const attentionCountItems = computed(() => [
  { key: 'critical', label: '紧急', value: attentionSummary.value.counts.critical },
  { key: 'warning', label: '预警', value: attentionSummary.value.counts.warning },
  { key: 'focus', label: '重点', value: attentionSummary.value.counts.focus }
])
const attentionFilterOptions = computed(() => [
  { value: 'all', label: `全部 ${attentionSummary.value.total}` },
  { value: 'critical', label: `紧急 ${attentionSummary.value.counts.critical}` },
  { value: 'warning', label: `预警 ${attentionSummary.value.counts.warning}` },
  { value: 'focus', label: `重点 ${attentionSummary.value.counts.focus}` },
  { value: 'todo', label: `待处理 ${attentionTodoCount.value}` }
])
const resolveAttention = (row) => getQualityRecordAttention(app.value?.key, row, {
  role: 'quality_inspector',
  page: app.value?.key,
  device: 'desktop',
  task: 'monitor'
})
const matchesAttentionFilter = (row, filter) => {
  if (filter === 'all') return true
  const attention = resolveAttention(row)
  if (filter === 'critical') return attention.level === 'critical'
  if (filter === 'warning') return attention.level === 'warning'
  if (filter === 'focus') return attention.level === 'focus'
  if (filter !== 'todo') return true
  if (app.value?.key === 'inspections') return row.result !== '合格'
  if (app.value?.key === 'ncr') return row.ncr_status !== '已关闭'
  if (app.value?.key === 'actions') return row.action_status !== '已完成'
  if (app.value?.key === 'audits') return row.audit_status !== '已关闭'
  if (app.value?.key === 'standards') return row.standard_status !== '生效'
  return ['critical', 'warning', 'focus'].includes(attention.level)
}
const rowAttentionFilter = (row) => matchesAttentionFilter(row, attentionFilter.value)
const attentionTodoCount = computed(() => attentionRows.value.filter((row) => matchesAttentionFilter(row, 'todo')).length)

const filteredFallbackRows = computed(() => {
  const text = fallbackSearch.value.trim().toLowerCase()
  const rows = (app.value?.fallbackRows || []).filter(rowAttentionFilter)
  if (!text) return rows
  return rows.filter((row) => Object.values(row).some((value) => String(value || '').toLowerCase().includes(text)))
})

const allAvailableColumns = computed(() => [...staticColumns.value, ...extraColumns.value])
const cascaderParentColumns = computed(() => allAvailableColumns.value.filter((col) => {
  return col?.prop && (Array.isArray(col.options) || col.type === 'select' || col.type === 'cascader')
}))
const cascaderParentOptions = computed(() => {
  const parent = cascaderParentColumns.value.find((col) => col.prop === currentCol.dependsOn)
  if (!parent) return []
  if (Array.isArray(parent.options)) return parent.options
  if (parent.cascaderOptions && typeof parent.cascaderOptions === 'object') {
    return Object.keys(parent.cascaderOptions).map((value) => ({ label: value, value }))
  }
  return []
})

const getCascaderChildren = (parentValue) => {
  const children = currentCol.cascaderOptionsMap?.[parentValue] || []
  return Array.isArray(children) ? children : []
}

const addCascaderChild = (parentValue) => {
  const value = String(cascaderInputMap[parentValue] || '').trim()
  if (!value) return
  const next = new Set(getCascaderChildren(parentValue))
  next.add(value)
  currentCol.cascaderOptionsMap[parentValue] = Array.from(next)
  cascaderInputMap[parentValue] = ''
}

const removeCascaderChild = (parentValue, child) => {
  currentCol.cascaderOptionsMap[parentValue] = getCascaderChildren(parentValue).filter((item) => item !== child)
}

const loadColumnsConfig = async () => {
  const configKey = app.value?.configKey
  if (!configKey) return
  try {
    const res = await request({
      url: `/system_configs?key=eq.${configKey}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    if (Array.isArray(res) && res.length > 0 && Array.isArray(res[0].value)) {
      extraColumns.value = res[0].value
    } else {
      extraColumns.value = JSON.parse(JSON.stringify(app.value?.defaultExtraColumns || []))
      if (extraColumns.value.length) await saveColumnsConfig()
    }
    syncAiContext()
  } catch {
    extraColumns.value = JSON.parse(JSON.stringify(app.value?.defaultExtraColumns || []))
  }
}

const saveColumnsConfig = async () => {
  if (!app.value?.configKey) return
  await request({
    url: '/system_configs',
    method: 'post',
    headers: {
      'Accept-Profile': 'public',
      'Content-Profile': 'public',
      'Prefer': 'resolution=merge-duplicates'
    },
    data: { key: app.value.configKey, value: extraColumns.value }
  })
}

const handleDataLoaded = (payload) => {
  loadedRows.value = payload?.rawRows || payload?.rows || []
  syncAiContext(payload?.rows || [])
}

const handleDataLoadError = () => {
  if (!fallbackMode.value) {
    fallbackMode.value = true
    ElMessage.warning('质量数据表暂未接入，已切换演示数据')
  }
  loadedRows.value = app.value?.fallbackRows || []
  syncAiContext(app.value?.fallbackRows || [])
}

const handleGridCellValueChanged = (params) => {
  const row = params?.node?.data
  if (!row?.id) return
  const index = loadedRows.value.findIndex((item) => item?.id === row.id)
  if (index >= 0) {
    const next = [...loadedRows.value]
    next.splice(index, 1, row)
    loadedRows.value = next
  }
  syncAiContext(loadedRows.value)
}

const fallbackRowClassName = ({ row }) => {
  const level = resolveAttention(row)?.level
  return ['critical', 'warning', 'focus'].includes(level) ? `fallback-attention-row attention-row-${level}` : ''
}

const syncAiContext = (rows = []) => {
  const columns = [...staticColumns.value, ...extraColumns.value].map((col) => ({
    label: col.label,
    prop: col.prop,
    type: col.type || 'text',
    options: col.options || [],
    expression: col.expression || ''
  }))
  pushAiContext({
    app: 'quality',
    view: app.value?.key,
    viewId: app.value?.viewId,
    apiUrl: app.value?.apiUrl,
    profile: app.value?.acceptProfile || 'public',
    columns,
    staticColumns: staticColumns.value,
    extraColumns: extraColumns.value,
    summaryConfig: summaryConfig.value,
    dataSample: rows.slice(0, 30),
    aiScene: 'grid_chat',
    allowImport: true,
    importTarget: {
      apiUrl: app.value?.writeUrl || app.value?.apiUrl,
      profile: app.value?.contentProfile || 'public',
      viewId: app.value?.viewId
    }
  })
}

const handleCreate = async () => {
  if (!app.value?.writeUrl || !app.value?.createPayload) return
  try {
    await request({
      url: app.value.writeUrl,
      method: 'post',
      headers: {
        'Accept-Profile': app.value.acceptProfile || 'public',
        'Content-Profile': app.value.contentProfile || 'public'
      },
      data: app.value.createPayload()
    })
    await gridRef.value?.loadData?.()
    ElMessage.success('已创建新行')
  } catch (error) {
    fallbackMode.value = true
    ElMessage.warning('质量数据表暂未接入，已切换演示数据')
  }
}

const handleViewDocument = (row) => {
  if (!row?.id) return
  router.push({
    name: 'QualityDocumentDetail',
    params: { id: row.id },
    query: { appKey: app.value.key, demo: String(row.id).startsWith('demo-') ? '1' : undefined }
  })
}

const openColumnConfig = () => {
  colConfigVisible.value = true
}

const saveColumn = async () => {
  const label = currentCol.label.trim()
  if (!label) return
  const prop = `field_${Date.now().toString().slice(-6)}`
  const col = { label, prop, type: addTab.value }
  if (addTab.value === 'select') {
    const options = currentCol.options
      .map((opt) => String(opt.label || '').trim())
      .filter(Boolean)
      .map((text) => ({ label: text, value: text }))
    if (!options.length) {
      ElMessage.warning('请至少添加一个选项')
      return
    }
    col.options = options
  }
  if (addTab.value === 'cascader') {
    if (!currentCol.dependsOn) {
      ElMessage.warning('请先选择上级列')
      return
    }
    col.dependsOn = currentCol.dependsOn
    col.cascaderOptions = JSON.parse(JSON.stringify(currentCol.cascaderOptionsMap || {}))
  }
  if (addTab.value === 'geo') {
    col.geoAddress = currentCol.geoAddress !== false
  }
  if (addTab.value === 'file') {
    col.fileMaxCount = currentCol.fileMaxCount || 5
    col.fileMaxSizeMb = currentCol.fileMaxSizeMb || 20
    col.fileAccept = currentCol.fileAccept || ''
  }
  if (addTab.value === 'formula') col.expression = currentCol.expression
  extraColumns.value.push(col)
  await saveColumnsConfig()
  resetColumnForm()
  syncAiContext()
  ElMessage.success('列已添加')
}

const removeColumn = async (index) => {
  extraColumns.value.splice(index, 1)
  await saveColumnsConfig()
  syncAiContext()
}

const resetColumnForm = () => {
  currentCol.label = ''
  currentCol.expression = ''
  currentCol.options = [{ label: '合格' }, { label: '不合格' }]
  currentCol.dependsOn = ''
  currentCol.cascaderOptionsMap = {}
  currentCol.geoAddress = true
  currentCol.fileMaxCount = 5
  currentCol.fileMaxSizeMb = 20
  currentCol.fileAccept = ''
  Object.keys(cascaderInputMap).forEach((key) => delete cascaderInputMap[key])
  addTab.value = 'text'
}

const goApps = () => {
  router.push('/')
}

onMounted(() => {
  loadedRows.value = app.value?.fallbackRows || []
  loadColumnsConfig()
})

watch(attentionFilter, () => {
  if (!fallbackMode.value) gridRef.value?.loadData?.()
})
</script>

<style scoped>
.app-container {
  height: 100vh;
  padding: 20px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: #f5f7fb;
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

.attention-strip {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(260px, 0.9fr) minmax(190px, 0.55fr);
  align-items: stretch;
  gap: 12px;
  margin-bottom: 12px;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-left: 4px solid #2563eb;
  border-radius: 8px;
  background: #fff;
}

.attention-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.attention-main span,
.attention-next span,
.attention-count span {
  font-size: 12px;
  color: #64748b;
}

.attention-main strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 17px;
  color: #111827;
}

.attention-main small {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #475569;
}

.attention-counts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.attention-count {
  min-width: 0;
  height: 58px;
  padding: 8px 10px;
  box-sizing: border-box;
  border-radius: 8px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.attention-count strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 20px;
  color: #111827;
}

.count-critical strong {
  color: #dc2626;
}

.count-warning strong {
  color: #d97706;
}

.count-focus strong {
  color: #2563eb;
}

.attention-next {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 8px;
}

.attention-next span {
  min-width: 0;
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.attention-critical {
  border-left-color: #dc2626;
}

.attention-warning {
  border-left-color: #f59e0b;
}

.attention-focus {
  border-left-color: #2563eb;
}

.attention-normal,
.attention-silent {
  border-left-color: #94a3b8;
}

.grid-card {
  flex: 1;
  min-height: 0;
}

.fallback-grid {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fallback-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.attention-filter {
  flex: 0 0 auto;
}

.fallback-grid :deep(.fallback-attention-row.attention-row-critical) {
  background: #fff5f5;
}

.fallback-grid :deep(.fallback-attention-row.attention-row-warning) {
  background: #fffbeb;
}

.fallback-grid :deep(.fallback-attention-row.attention-row-focus) {
  background: #eff6ff;
}

.column-manager {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  margin: 0;
  font-weight: 600;
  color: #303133;
}

.empty-tip {
  color: #909399;
  font-size: 13px;
}

.col-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.col-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
}

.col-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-row,
.form-col,
.option-row {
  display: flex;
  gap: 10px;
}

.form-col {
  flex-direction: column;
}

.option-row {
  align-items: center;
}

:global(#app.dark) .app-container {
  background: #0b0f14;
}

:global(#app.dark) .header-text h2,
:global(#app.dark) .header-text p,
:global(#app.dark) .section-title {
  color: #f3f4f6;
}

:global(#app.dark) .grid-card,
:global(#app.dark) .col-item,
:global(#app.dark) .attention-strip {
  background: #111827;
  border-color: #1f2937;
}

:global(#app.dark) .attention-main strong,
:global(#app.dark) .attention-count strong {
  color: #f3f4f6;
}

:global(#app.dark) .attention-main span,
:global(#app.dark) .attention-main small,
:global(#app.dark) .attention-next span,
:global(#app.dark) .attention-count span {
  color: #9ca3af;
}

:global(#app.dark) .attention-count {
  background: #0f172a;
}

@media (max-width: 900px) {
  .attention-strip {
    grid-template-columns: 1fr;
  }

  .attention-next {
    align-items: stretch;
  }

  .fallback-toolbar {
    flex-wrap: wrap;
  }
}
</style>
