<template>
  <div class="detail-page" data-guide="detail-page">
    <div class="page-header" data-guide="detail-header">
      <el-button icon="ArrowLeft" data-guide="detail-back" @click="$router.back()">返回列表</el-button>
      <div class="header-actions" data-guide="detail-actions">
        <el-select v-model="selectedTemplateId" size="small" placeholder="选择模板" style="width: 220px" data-guide="template-select">
          <el-option v-for="tpl in templates" :key="tpl.id" :label="tpl.name" :value="tpl.id" />
        </el-select>
        <el-button
          type="primary"
          data-sop-action="detail-ai-form"
          data-sop-title="AI生成表单"
          data-sop-desc="用 AI 辅助生成当前质量单据模板或字段建议，生成后必须人工复核。"
          data-sop-steps="先确认当前应用和单据类型|点击 AI生成表单|检查生成字段是否符合质检、NCR 或整改场景|删除不需要的字段并补齐关键项|保存前由业务人员复核"
          data-sop-risk="AI 只能辅助生成模板，不能代替质检结论、责任判定和审批留痕。"
          @click="openAiFormAssistant"
        >AI生成表单</el-button>
        <el-button
          type="primary"
          plain
          data-sop-action="detail-print-doc"
          data-sop-title="打印单据"
          data-sop-desc="按当前模板打印或导出当前质量单据。"
          data-sop-steps="先确认模板、单号和正文内容|点击打印单据|检查打印预览中的页边距、字段和签字栏|打印或导出 PDF 后按制度留档"
          @click="printDoc"
        >打印单据</el-button>
        <el-button
          type="success"
          :disabled="isDemo"
          data-sop-action="detail-save-doc"
          data-sop-title="保存单据修改"
          data-sop-desc="保存当前质量单据正文、扩展字段和附件，保存前必须复核关键业务字段。"
          data-sop-steps="先复核单号、对象、数量、日期、状态和负责人|检查必填项和风险提示|确认附件已上传且内容正确|点击保存修改|保存后回到表格搜索该记录复核状态"
          data-sop-risk="保存后请回到质量表格搜索该单据，确认结果、不合格状态、NCR 关联和整改责任人都正确。"
          @click="saveDoc"
        >保存修改</el-button>
      </div>
    </div>

    <div class="form-container" v-loading="loading" ref="docContainerRef" data-guide="form-wrapper">
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

import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'
import { pushAiContext, pushAiCommand } from '@/utils/ai-context'
import { findQualityApp } from '@/utils/quality-apps'
import EisDocumentEngine from '@/components/eis-document-engine/EisDocumentEngine.vue'
import {
  applyDocumentFormulaUpdates,
  buildDocumentAgentContext,
  buildDocumentFormPrompt
} from '@shared/eis-document-agent-context'

const route = useRoute()
const props = defineProps({
  id: { type: String, required: true }
})

const loading = ref(false)
const formData = ref(null)
const dynamicColumns = ref([])
const templateLibrary = ref([])
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

const getTemplateRecordScope = (template) => template?.scope || template?.schema?.scope || {}

const isTemplateForCurrentScope = (template) => {
  if (!template?.schema || !Array.isArray(template.schema.layout)) return false
  const scope = getTemplateRecordScope(template)
  if (!scope || typeof scope !== 'object') return false
  if (scope.app && scope.app !== templateScope.value.app) return false
  if (scope.key && scope.key !== templateScope.value.key) return false
  if (scope.configKey && scope.configKey !== templateScope.value.configKey) return false
  if (scope.apiUrl && scope.apiUrl !== templateScope.value.apiUrl) return false
  return !!(scope.app || scope.key || scope.configKey || scope.apiUrl)
}

const templates = computed(() => {
  const scoped = (templateLibrary.value || [])
    .filter(isTemplateForCurrentScope)
    .filter(item => item.id !== defaultTemplate.value.id)
  return [defaultTemplate.value, ...scoped]
})
const activeSchema = computed(() => templates.value.find((tpl) => tpl.id === selectedTemplateId.value)?.schema || defaultTemplate.value.schema)

const formModel = computed(() => {
  if (!formData.value) return null
  return {
    ...formData.value,
    properties: formData.value.properties || {}
  }
})

const templateScope = computed(() => ({
  app: 'quality',
  key: app.value?.key || appKey.value || 'quality_document',
  configKey: app.value?.configKey || '',
  apiUrl: (app.value?.writeUrl || app.value?.apiUrl || '').split('?')[0]
}))

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

const loadTemplates = async () => {
  try {
    const res = await request({
      url: '/system_configs?key=eq.form_templates',
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    const list = Array.isArray(res) && res.length > 0 ? (res[0].value || []) : []
    templateLibrary.value = Array.isArray(list) ? list : []
  } catch {
    templateLibrary.value = []
  }
}

const handleTemplatesUpdated = (event) => {
  const eventKey = event?.detail?.templateLibraryKey || event?.detail?.key || 'form_templates'
  if (eventKey !== 'form_templates') return
  const list = event?.detail?.templates
  if (Array.isArray(list)) templateLibrary.value = list
  else loadTemplates()
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
  applyFormulaUpdates(formData.value)
}

const applyFormulaUpdates = (rowData) => {
  applyDocumentFormulaUpdates({
    rowData,
    staticColumns: staticColumns.value,
    dynamicColumns: dynamicColumns.value
  })
}

const syncAiContext = () => {
  pushAiContext(buildDocumentAgentContext({
    app: 'quality',
    view: app.value?.key || appKey.value || 'quality_document',
    viewName: app.value?.name || '质量单据',
    apiUrl: (app.value?.apiUrl || '').split('?')[0],
    writeUrl: (app.value?.writeUrl || app.value?.apiUrl || '').split('?')[0],
    rowId: props.id,
    rowData: formModel.value || formData.value,
    staticColumns: staticColumns.value,
    dynamicColumns: dynamicColumns.value,
    templateScope: templateScope.value,
    templateLibraryKey: 'form_templates',
    aiScene: 'form',
    allowImport: false
  }))
}

const openAiFormAssistant = () => {
  if (!formData.value) {
    ElMessage.warning('请先加载质量单据')
    return
  }
  syncAiContext()
  pushAiCommand({
    id: `quality_form_${Date.now()}`,
    type: 'open-worker',
    prompt: buildDocumentFormPrompt({
      title: app.value?.name || '质量单据',
      columns: allColumns.value,
      rowData: formModel.value || formData.value
    })
  })
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
  await loadTemplates()
  await loadData()
  window.addEventListener('eis-form-templates-updated', handleTemplatesUpdated)
})

onUnmounted(() => {
  window.removeEventListener('eis-form-templates-updated', handleTemplatesUpdated)
})

watch([() => dynamicColumns.value, () => formData.value?.id], () => {
  if (formData.value) applyFormulaUpdates(formData.value)
  syncAiContext()
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
