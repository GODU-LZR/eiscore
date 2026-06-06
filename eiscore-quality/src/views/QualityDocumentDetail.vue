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
import { findQualityApp } from '@/utils/quality-apps'
import EisDocumentEngine from '@/components/eis-document-engine/EisDocumentEngine.vue'

const route = useRoute()
const props = defineProps({
  id: { type: String, required: true }
})

const loading = ref(false)
const formData = ref(null)
const dynamicColumns = ref([])
const selectedTemplateId = ref('')
const docContainerRef = ref(null)

const appKey = computed(() => String(route.query.appKey || 'inspections'))
const isDemo = computed(() => route.query.demo === '1' || String(props.id).startsWith('demo-'))
const app = computed(() => findQualityApp(appKey.value) || findQualityApp('inspections'))
const staticColumns = computed(() => app.value?.staticColumns || [])
const allColumns = computed(() => [...staticColumns.value, ...dynamicColumns.value])

const defaultTemplate = computed(() => ({
  id: `default_quality_${app.value.key}`,
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
  return columns.find((col) => ['doc_no', 'action_no', 'audit_no', 'standard_no'].includes(col.prop))?.prop || 'doc_no'
})

const splitColumns = (cols) => {
  const primaryProps = new Set([
    'doc_no',
    'action_no',
    'audit_no',
    'standard_no',
    'inspection_type',
    'source_type',
    'action_type',
    'audit_type',
    'standard_name',
    'item_name',
    'issue_desc',
    'task_desc',
    'audit_scope'
  ])
  const primary = []
  const process = []
  cols.forEach((col) => {
    if (primaryProps.has(col.prop)) primary.push(col)
    else process.push(col)
  })
  return { primary, process }
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
  const { primary, process } = splitColumns(staticColumns.value)
  return {
    docType: `quality_${app.value.key}`,
    title: `${app.value.name}表单`,
    docNo: docNoField.value,
    layout: [
      makeSection('核心信息', primary.length ? primary : staticColumns.value.slice(0, 4)),
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
    ElMessage.warning('质量数据表暂未接入，已加载演示表单')
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
  printWindow.document.write(`<!doctype html><html><head><title>质量单据</title></head><body>${paper.outerHTML}</body></html>`)
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

.form-container {
  min-height: calc(100vh - 92px);
}

:global(#app.dark) .detail-page {
  background: #0b0f14;
}
</style>
