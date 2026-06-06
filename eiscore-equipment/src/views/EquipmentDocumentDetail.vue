<template>
  <div class="detail-page">
    <div class="page-header">
      <el-button icon="ArrowLeft" @click="$router.back()">返回列表</el-button>
      <div class="header-actions">
        <el-select v-model="selectedTemplateId" size="small" placeholder="选择模板" style="width: 220px">
          <el-option v-for="tpl in templates" :key="tpl.id" :label="tpl.name" :value="tpl.id" />
        </el-select>
        <el-button type="primary" plain @click="printDoc">打印单据</el-button>
        <el-button type="success" :disabled="isDemo" @click="saveDoc">保存修改</el-button>
      </div>
    </div>

    <section
      v-if="formModel"
      class="document-attention"
      :class="`attention-${documentAttention.level}`"
    >
      <div class="attention-main">
        <span>当前单据</span>
        <strong>{{ documentAttention.title || docNo }}</strong>
        <small>{{ documentAttention.reason }}</small>
      </div>
      <div class="attention-meta">
        <div v-for="item in documentMetaItems" :key="item.label" class="meta-item">
          <span>{{ item.label }}</span>
          <strong>{{ item.value }}</strong>
        </div>
      </div>
      <div class="attention-action">
        <el-tag :type="documentAttention.tagType" effect="plain">{{ documentAttention.label }}</el-tag>
        <span>{{ documentAttention.action }}</span>
      </div>
    </section>

    <div class="form-container" v-loading="loading" ref="docContainerRef">
      <EisDocumentEngine
        v-if="formModel && activeSchema"
        :model-value="formModel"
        :schema="activeSchema"
        :columns="allColumns"
        @update:modelValue="handleFormUpdate"
      />
      <el-empty v-else description="正在加载数据或配置..." />
    </div>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'
import { findEquipmentApp } from '@/utils/equipment-apps'
import EisDocumentEngine from '@/components/eis-document-engine/EisDocumentEngine.vue'
import { formatShortDate, getEquipmentRecordAttention } from '@/utils/equipment-attention'

const route = useRoute()
const props = defineProps({
  id: { type: String, required: true }
})

const loading = ref(false)
const formData = ref(null)
const dynamicColumns = ref([])
const selectedTemplateId = ref('')
const docContainerRef = ref(null)

const appKey = computed(() => String(route.query.appKey || 'assets'))
const isDemo = computed(() => route.query.demo === '1' || String(props.id).startsWith('demo-'))
const app = computed(() => findEquipmentApp(appKey.value) || findEquipmentApp('assets'))
const staticColumns = computed(() => app.value?.staticColumns || [])
const allColumns = computed(() => [...staticColumns.value, ...dynamicColumns.value])
const documentAttention = computed(() => getEquipmentRecordAttention(appKey.value, formModel.value || {}, {
  role: 'equipment_manager',
  page: appKey.value,
  device: 'desktop',
  task: 'input'
}))

const defaultTemplate = computed(() => ({
  id: `default_equipment_${app.value.key}`,
  name: `${app.value.name}默认表单`,
  schema: buildDefaultSchema()
}))

const templates = computed(() => [defaultTemplate.value])
const activeSchema = computed(() => templates.value.find((tpl) => tpl.id === selectedTemplateId.value)?.schema || defaultTemplate.value.schema)

const formModel = computed(() => {
  if (!formData.value) return null
  return {
    ...formData.value,
    properties: formData.value.properties || {}
  }
})

const docNoField = computed(() => {
  const columns = staticColumns.value
  return columns.find((col) => [
    'asset_no',
    'check_no',
    'issue_no',
    'work_order_no',
    'plan_no',
    'standard_no'
  ].includes(col.prop))?.prop || 'asset_no'
})

const docNo = computed(() => formModel.value?.[docNoField.value] || props.id)

const getValue = (field) => {
  if (!field || !formModel.value) return ''
  if (field in formModel.value) return formModel.value[field]
  if (formModel.value.properties && field in formModel.value.properties) return formModel.value.properties[field]
  return ''
}

const documentMetaFields = computed(() => {
  const map = {
    assets: [
      ['运行状态', 'run_status'],
      ['责任人', 'owner_name'],
      ['下次保养', 'next_maint_date']
    ],
    checks: [
      ['点检结果', 'check_result'],
      ['异常项', 'abnormal_count'],
      ['点检日期', 'check_date']
    ],
    issues: [
      ['紧急程度', 'issue_level'],
      ['状态', 'issue_status'],
      ['处理期限', 'deadline']
    ],
    work_orders: [
      ['工单状态', 'work_status'],
      ['维修人员', 'maintainer'],
      ['计划日期', 'plan_date']
    ],
    plans: [
      ['计划状态', 'plan_status'],
      ['负责人', 'owner_name'],
      ['下次执行', 'next_execute_date']
    ],
    standards: [
      ['状态', 'standard_status'],
      ['负责人', 'owner_name'],
      ['生效日期', 'effective_date']
    ]
  }
  return map[appKey.value] || []
})

const documentMetaItems = computed(() => documentMetaFields.value.map(([label, field]) => {
  const value = getValue(field)
  const display = String(field).includes('date') || field === 'deadline'
    ? formatShortDate(value)
    : (value || '--')
  return { label, value: display }
}))

const groupFieldSets = {
  primary: new Set([
    'asset_no',
    'check_no',
    'issue_no',
    'work_order_no',
    'plan_no',
    'standard_no',
    'asset_name',
    'asset_type',
    'location_name',
    'check_type',
    'source_type',
    'issue_desc',
    'work_type',
    'task_desc',
    'plan_name',
    'plan_type',
    'standard_name',
    'asset_scope'
  ]),
  task: new Set([
    'run_status',
    'owner_dept',
    'owner_name',
    'checker',
    'check_date',
    'check_result',
    'maintainer',
    'plan_date',
    'finish_date',
    'work_status',
    'repair_action',
    'plan_status',
    'completion_rate',
    'standard_status',
    'key_items'
  ]),
  risk: new Set([
    'asset_level',
    'last_maint_date',
    'next_maint_date',
    'health_score',
    'check_item_count',
    'abnormal_count',
    'issue_level',
    'occurred_date',
    'deadline',
    'downtime_hours',
    'acceptance_result',
    'next_execute_date',
    'effective_date',
    'remark'
  ])
}

const splitColumns = (cols) => {
  const primary = []
  const task = []
  const risk = []
  const process = []
  cols.forEach((col) => {
    if (groupFieldSets.primary.has(col.prop)) primary.push(col)
    else if (groupFieldSets.task.has(col.prop)) task.push(col)
    else if (groupFieldSets.risk.has(col.prop)) risk.push(col)
    else process.push(col)
  })
  return { primary, task, risk, process }
}

const makeSection = (title, cols) => {
  if (!cols.length) return null
  return {
    type: 'section',
    title,
    cols: 2,
    children: cols.map((col) => ({
      label: col.label,
      field: col.prop
    }))
  }
}

const buildDefaultSchema = () => {
  const { primary, task, risk, process } = splitColumns(staticColumns.value)
  return {
    docType: `equipment_${app.value.key}`,
    title: `${app.value.name}表单`,
    docNo: docNoField.value,
    layout: [
      makeSection('核心信息', primary.length ? primary : staticColumns.value.slice(0, 4)),
      makeSection('当前处理', task),
      makeSection('风险与验证', risk),
      makeSection('过程信息', primary.length ? process : staticColumns.value.slice(4)),
      makeSection('扩展信息', dynamicColumns.value)
    ].filter(Boolean)
  }
}

const loadDynamicColumns = async () => {
  try {
    const res = await request({
      url: `/system_configs?key=eq.${app.value.configKey}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    dynamicColumns.value = Array.isArray(res) && res.length > 0 && Array.isArray(res[0].value)
      ? res[0].value
      : JSON.parse(JSON.stringify(app.value.defaultExtraColumns || []))
  } catch {
    dynamicColumns.value = JSON.parse(JSON.stringify(app.value.defaultExtraColumns || []))
  }
}

const loadData = async () => {
  loading.value = true
  try {
    if (isDemo.value) {
      formData.value = (app.value.fallbackRows || []).find((row) => String(row.id) === String(props.id)) || app.value.fallbackRows?.[0] || null
      return
    }
    const apiUrl = (app.value.writeUrl || app.value.apiUrl || '').split('?')[0]
    const res = await request({
      url: `${apiUrl}?id=eq.${encodeURIComponent(props.id)}`,
      method: 'get',
      headers: { 'Accept-Profile': app.value.acceptProfile || 'public' }
    })
    formData.value = Array.isArray(res) && res.length > 0 ? res[0] : null
  } catch {
    formData.value = (app.value.fallbackRows || [])[0] || null
    ElMessage.warning('设备数据表暂未接入，已加载演示表单')
  } finally {
    loading.value = false
  }
}

const handleFormUpdate = (nextValue) => {
  if (!nextValue || !formData.value) return
  const nextProps = nextValue.properties || {}
  Object.keys(formData.value).forEach((key) => {
    if (key === 'properties') return
    if (key in nextValue) formData.value[key] = nextValue[key]
  })
  formData.value.properties = {
    ...(formData.value.properties || {}),
    ...nextProps
  }
}

const saveDoc = async () => {
  if (!formData.value || isDemo.value) return
  try {
    const { id, created_at, updated_at, ...payload } = formData.value
    const apiUrl = (app.value.writeUrl || app.value.apiUrl || '').split('?')[0]
    await request({
      url: `${apiUrl}?id=eq.${encodeURIComponent(props.id)}`,
      method: 'patch',
      headers: {
        'Accept-Profile': app.value.acceptProfile || 'public',
        'Content-Profile': app.value.contentProfile || 'public'
      },
      data: payload
    })
    ElMessage.success('保存成功')
  } catch {
    ElMessage.error('保存失败')
  }
}

const printDoc = () => {
  const paper = docContainerRef.value?.querySelector('.eis-document-paper')
  if (!paper) return
  const printWindow = window.open('', '_blank')
  if (!printWindow) return
  printWindow.document.write(`<!doctype html><html><head><title>设备单据</title></head><body>${paper.outerHTML}</body></html>`)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 200)
}

watch(defaultTemplate, (tpl) => {
  if (!selectedTemplateId.value) selectedTemplateId.value = tpl.id
}, { immediate: true })

onMounted(async () => {
  await loadDynamicColumns()
  await loadData()
})
</script>

<style scoped>
.detail-page {
  min-height: 100vh;
  padding: 20px;
  box-sizing: border-box;
  background: #f5f7fb;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.header-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.document-attention {
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.9fr) minmax(180px, 0.45fr);
  align-items: stretch;
  gap: 12px;
  margin-bottom: 14px;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-left: 4px solid #2563eb;
  border-radius: 8px;
  background: #fff;
}

.attention-main,
.attention-action {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.attention-main span,
.attention-action span,
.meta-item span {
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

.attention-main small,
.attention-action span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: #475569;
}

.attention-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.meta-item {
  min-width: 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f8fafc;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.meta-item strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  color: #111827;
}

.attention-action {
  align-items: flex-end;
}

.attention-critical {
  border-left-color: #dc2626;
}

.attention-warning {
  border-left-color: #d97706;
}

.attention-focus {
  border-left-color: #2563eb;
}

.attention-normal,
.attention-silent {
  border-left-color: #16a34a;
}

.form-container {
  min-height: calc(100vh - 166px);
}

:global(#app.dark) .detail-page {
  background: #0b0f14;
}

:global(#app.dark) .document-attention {
  background: #111827;
  border-color: #1f2937;
}

:global(#app.dark) .attention-main strong,
:global(#app.dark) .meta-item strong {
  color: #f9fafb;
}

:global(#app.dark) .attention-main span,
:global(#app.dark) .attention-main small,
:global(#app.dark) .attention-action span,
:global(#app.dark) .meta-item span {
  color: #cbd5e1;
}

:global(#app.dark) .meta-item {
  background: #0f172a;
}

@media (max-width: 1080px) {
  .document-attention {
    grid-template-columns: 1fr;
  }

  .attention-action {
    align-items: flex-start;
  }
}

@media (max-width: 720px) {
  .detail-page {
    padding: 14px;
  }

  .page-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }

  .header-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .attention-meta {
    grid-template-columns: 1fr;
  }
}
</style>
