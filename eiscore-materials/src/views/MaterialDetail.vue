<template>
  <div class="detail-page" data-guide="detail-page">
    <div class="page-header" data-guide="detail-header">
      <el-button icon="ArrowLeft" data-guide="detail-back" @click="$router.back()">返回列表</el-button>
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
          data-sop-desc="管理当前仓储单据模板，可新增、预览、改名或删除模板。"
          data-sop-steps="先确认当前仓储应用类型|打开模板库|预览或选择模板|只删除确认废弃的模板|回到单据页重新选择模板并复核显示效果"
          @click="openTemplateManager"
        >模板库</el-button>
        <el-button
          type="primary"
          data-sop-action="detail-ai-form"
          data-sop-title="AI生成表单"
          data-sop-desc="用 AI 辅助生成当前仓储单据模板或字段建议，生成后必须人工复核。"
          data-sop-steps="先确认当前物料或仓储业务类型|点击 AI生成表单|检查生成字段是否符合物料、批次、仓库和库存追溯要求|删除不需要的字段并补齐关键项|保存前由仓储负责人复核"
          data-sop-risk="AI 只能辅助生成模板，不能代替物料编码、批次规则和库存数量复核。"
          @click="openAiFormAssistant"
        >AI生成表单</el-button>
        <el-button
          type="primary"
          plain
          data-sop-action="detail-print-doc"
          data-sop-title="打印单据"
          data-sop-desc="按当前模板打印或导出当前仓储单据。"
          data-sop-steps="先确认模板、物料、批次、仓库和数量|点击打印单据|检查打印预览中的页边距、字段和签字栏|打印或导出 PDF 后按制度留档"
          @click="printDoc"
        >打印单据</el-button>
        <el-button
          type="success"
          data-sop-action="detail-save-doc"
          data-sop-title="保存单据修改"
          data-sop-desc="保存当前仓储单据正文、扩展字段和附件，保存前必须复核物料、批次、仓库、数量和单位。"
          data-sop-steps="先复核物料编码、批次、仓库、数量、单位和负责人|检查必填项和风险提示|确认附件已上传且内容正确|点击保存修改|保存后回到表格搜索该记录复核状态"
          data-sop-risk="保存后请回到仓储表格搜索该记录，确认物料、批次、仓库和库存影响都正确。"
          @click="saveDoc"
        >保存修改</el-button>
      </div>
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

    <el-dialog v-model="templateManagerVisible" title="模板库" width="860px">
      <div class="template-toolbar">
        <span class="template-tip">可预览、改名或删除模板</span>
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
              <el-button size="small" type="warning" plain :disabled="scope.row.readonly" @click="openTemplateRename(scope.row)">改名</el-button>
              <el-button size="small" type="danger" :disabled="scope.row.readonly" @click="removeTemplate(scope.row)">删除</el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>

    <el-dialog v-model="templateEditVisible" :title="templateEditTitle" width="420px">
      <el-form :model="templateEditForm" label-width="90px">
        <el-form-item label="模板名称">
          <el-input v-model="templateEditForm.name" placeholder="如：物料台账表" />
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
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/utils/request'
import { pushAiContext, pushAiCommand } from '@/utils/ai-context'
import { findMaterialApp, BASE_STATIC_COLUMNS } from '@/utils/material-apps'
import {
  applyDocumentFormulaUpdates,
  buildDocumentAgentContext,
  buildDocumentFormPrompt
} from '@shared/eis-document-agent-context'

import EisDocumentEngine from '@/components/eis-document-engine/EisDocumentEngine.vue'
import { documentSchemaExample } from '@/components/eis-document-engine/documentSchemaExample'

const route = useRoute()
const props = defineProps(['id'])

const loading = ref(false)
const formData = ref(null)
const templates = ref([])
const templateLibrary = ref([])
const selectedTemplateId = ref('')
const extraValues = ref({})
const dynamicColumns = ref([])
const docContainerRef = ref(null)
const templateManagerVisible = ref(false)
const templateEditVisible = ref(false)
const templatePreviewVisible = ref(false)
const templateSaving = ref(false)
const templateEditMode = ref('create')
const templatePreview = ref(null)
const templateEditForm = ref({ id: '', name: '' })

const normalizeStaticColumns = (cols) => (
  Array.isArray(cols) ? cols.map(col => ({ ...col, type: col.type || 'text' })) : []
)

const defaultStaticColumns = [
  { label: '编号', prop: 'id', type: 'text' },
  { label: '批次号', prop: 'batch_no', type: 'text' },
  { label: '物料名称', prop: 'name', type: 'text' },
  { label: '物料分类', prop: 'category', type: 'text' },
  { label: '重量(kg)', prop: 'weight_kg', type: 'text' },
  { label: '入库日期', prop: 'entry_date', type: 'text' }
]

const appKey = computed(() => (route.query.appKey ? String(route.query.appKey) : ''))
const appConfig = computed(() => (appKey.value ? findMaterialApp(appKey.value) : null))

const detailConfig = computed(() => {
  if (appConfig.value) {
    return {
      key: appConfig.value.key,
      name: appConfig.value.name,
      apiUrl: appConfig.value.apiUrl || '/raw_materials',
      configKey: appConfig.value.configKey || 'materials_table_cols',
      supportsProperties: appConfig.value.includeProperties !== false,
      staticColumns: normalizeStaticColumns(appConfig.value.staticColumns || BASE_STATIC_COLUMNS),
      defaultExtraColumns: appConfig.value.defaultExtraColumns || []
    }
  }
  return {
    key: 'materials',
    name: '物料台账',
    apiUrl: '/raw_materials',
    configKey: 'materials_table_cols',
    supportsProperties: true,
    staticColumns: defaultStaticColumns,
    defaultExtraColumns: []
  }
})

const supportsProperties = computed(() => detailConfig.value.supportsProperties !== false)
const staticColumns = computed(() => normalizeStaticColumns(detailConfig.value.staticColumns))

const templateEditTitle = computed(() => (templateEditMode.value === 'rename' ? '修改模板名称' : '新增模板'))
const templateScope = computed(() => ({
  app: 'materials',
  key: detailConfig.value.key || 'materials',
  configKey: detailConfig.value.configKey || 'materials_table_cols',
  apiUrl: detailConfig.value.apiUrl || '/raw_materials'
}))
const defaultTemplateId = computed(() => `default_${templateScope.value.app}_${templateScope.value.key}`)
const defaultTemplateName = computed(() => `${detailConfig.value.name || '物料'}默认表单`)
const detailFormValueKey = computed(() => {
  const scope = templateScope.value
  return [
    'form_templates',
    scope.app || '',
    scope.key || '',
    scope.configKey || '',
    scope.apiUrl || '',
    selectedTemplateId.value || ''
  ].map(part => encodeURIComponent(String(part))).join(':')
})

const knownPropertyKeys = computed(() => {
  if (!supportsProperties.value) return new Set()
  const keys = new Set()
  dynamicColumns.value.forEach(col => {
    if (col?.prop) keys.add(col.prop)
  })
  return keys
})

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

const fileOptions = computed(() => {
  if (!formData.value) return []
  const props = supportsProperties.value ? (formData.value.properties || {}) : (extraValues.value || {})
  return dynamicColumns.value
    .filter(col => col.type === 'file')
    .map(col => {
      const rawFiles = Array.isArray(props[col.prop]) ? props[col.prop] : []
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

const allColumns = computed(() => getAllColumns())

const normalizeSchemaColumns = (cols) => (
  Array.isArray(cols)
    ? cols.filter(col => col && col.label && col.prop)
    : []
)

const buildSchemaSection = (title, cols) => {
  const list = normalizeSchemaColumns(cols)
  if (!list.length) return null
  return {
    type: 'section',
    title,
    cols: 2,
    children: list.map(col => ({
      label: col.label,
      field: col.prop
    }))
  }
}

const buildFallbackSchema = () => {
  const baseSection = buildSchemaSection('基础信息', staticColumns.value || [])
  const extraSection = buildSchemaSection('扩展信息', dynamicColumns.value || [])
  const layout = [baseSection, extraSection].filter(Boolean)
  if (!layout.length) return documentSchemaExample
  return {
    docType: defaultTemplateId.value,
    title: defaultTemplateName.value,
    layout
  }
}

const buildDefaultTemplate = () => ({
  id: defaultTemplateId.value,
  name: defaultTemplateName.value,
  schema: buildFallbackSchema(),
  source: 'system',
  readonly: true,
  scope: templateScope.value
})

const activeSchema = computed(() => {
  const current = templates.value.find(item => item.id === selectedTemplateId.value)
  return current?.schema || buildFallbackSchema()
})

const loadData = async () => {
  if (!props.id) return
  loading.value = true
  try {
    const apiUrl = detailConfig.value.apiUrl || '/raw_materials'
    const res = await request({ 
      url: `${apiUrl}?id=eq.${props.id}`, 
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    if (res && res.length > 0) {
      formData.value = res[0]
      if (supportsProperties.value) {
        if (!formData.value.properties) formData.value.properties = {}
      }
      applyFormulaUpdates(formData.value)
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
      url: '/system_configs?key=eq.form_templates',
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    const list = res && res.length > 0 ? (res[0].value || []) : []
    templateLibrary.value = Array.isArray(list) ? list : []
    applyTemplateList(list)
  } catch (e) {
    templateLibrary.value = []
    templates.value = [buildDefaultTemplate()]
    selectedTemplateId.value = defaultTemplateId.value
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
    data: { key: 'form_templates', value: list }
  })
}

const persistCurrentTemplates = async (scopedList, preferredTemplateId = '') => {
  const remaining = (templateLibrary.value || []).filter((item) => {
    if (!item?.id) return true
    if (item.id === defaultTemplateId.value) return false
    return !isTemplateForCurrentScope(item)
  })
  const current = (scopedList || [])
    .filter(item => item?.id && item.id !== defaultTemplateId.value && !item.readonly)
    .map(withCurrentScope)
  const next = [...current, ...remaining]
  await saveTemplateLibrary(next)
  templateLibrary.value = next
  applyTemplateList(next)
  if (preferredTemplateId && templates.value.some(item => item.id === preferredTemplateId)) {
    selectedTemplateId.value = preferredTemplateId
  }
}

const isLegacyMaterialTemplate = (template) => {
  const docType = String(template?.schema?.docType || template?.docType || '').toLowerCase()
  const key = String(templateScope.value.key || '').toLowerCase()
  return [
    `${key}_auto`,
    'materials_auto',
    'material_auto',
    'mms_material',
    'material_detail'
  ].includes(docType)
}

const isTemplateForCurrentScope = (template) => {
  if (!template?.schema || !Array.isArray(template.schema.layout)) return false
  if (template.id === defaultTemplateId.value) return true
  const scope = template.scope || template.schema.scope || {}
  if (scope && typeof scope === 'object') {
    if (scope.app && scope.app !== templateScope.value.app) return false
    if (scope.key && scope.key !== templateScope.value.key) return false
    if (scope.configKey && scope.configKey !== templateScope.value.configKey) return false
    if (scope.apiUrl && scope.apiUrl !== templateScope.value.apiUrl) return false
    if (scope.app || scope.key || scope.configKey || scope.apiUrl) return true
  }
  return isLegacyMaterialTemplate(template)
}

const withCurrentScope = (template) => ({
  ...template,
  scope: {
    ...(template.scope || {}),
    ...templateScope.value
  },
  schema: {
    ...(template.schema || {}),
    scope: {
      ...((template.schema || {}).scope || {}),
      ...templateScope.value
    }
  }
})

const applyTemplateList = (rawList) => {
  const scoped = Array.isArray(rawList)
    ? rawList
      .filter(isTemplateForCurrentScope)
      .map(item => (item.id === defaultTemplateId.value ? item : withCurrentScope(item)))
    : []
  const defaultTemplate = buildDefaultTemplate()
  const merged = scoped.some(item => item.id === defaultTemplate.id)
    ? scoped
    : [defaultTemplate, ...scoped]
  templates.value = merged
  if (!merged.some(item => item.id === selectedTemplateId.value)) {
    selectedTemplateId.value = defaultTemplate.id
  }
}

const handleTemplatesUpdated = (event) => {
  const eventKey = event?.detail?.templateLibraryKey || event?.detail?.key || 'form_templates'
  if (eventKey !== 'form_templates') return
  const list = event?.detail?.templates
  if (Array.isArray(list)) {
    templateLibrary.value = list
    applyTemplateList(list)
  } else {
    loadTemplates()
  }
}

const loadDynamicColumns = async () => {
  try {
    const configKey = detailConfig.value.configKey || 'materials_table_cols'
    const res = await request({
      url: `/system_configs?key=eq.${configKey}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    if (res && res.length > 0) {
      dynamicColumns.value = res[0].value || []
    } else {
      dynamicColumns.value = detailConfig.value.defaultExtraColumns || []
    }
  } catch (e) {
    dynamicColumns.value = detailConfig.value.defaultExtraColumns || []
  }
}

const fetchFormValues = (rowId, templateId) => request({
  url: `/form_values?row_id=eq.${encodeURIComponent(String(rowId))}&template_id=eq.${encodeURIComponent(String(templateId))}`,
  method: 'get',
  headers: {
    'Accept-Profile': 'public',
    'Content-Profile': 'public'
  }
})

const loadFormValues = async () => {
  if (!formData.value?.id || !selectedTemplateId.value) {
    extraValues.value = {}
    return
  }
  try {
    let res = await fetchFormValues(formData.value.id, detailFormValueKey.value)
    if ((!Array.isArray(res) || res.length === 0) && detailFormValueKey.value !== selectedTemplateId.value) {
      res = await fetchFormValues(formData.value.id, selectedTemplateId.value)
    }
    if (res && res.length > 0) {
      extraValues.value = res[0].payload || {}
    } else {
      extraValues.value = {}
    }
  } catch (e) {
    extraValues.value = {}
  }
}

const handleFormUpdate = (nextValue) => {
  if (!nextValue || !formData.value) return
  const nextProps = nextValue.properties || {}
  Object.keys(formData.value || {}).forEach((key) => {
    if (key === 'properties') return
    if (key in nextValue) formData.value[key] = nextValue[key]
  })

  if (!supportsProperties.value) {
    extraValues.value = { ...nextProps }
    applyFormulaUpdates(formData.value)
    return
  }

  const knownKeys = knownPropertyKeys.value
  const updatedProps = {}
  const updatedExtra = {}

  Object.entries(nextProps).forEach(([key, val]) => {
    if (knownKeys.has(key)) {
      updatedProps[key] = val
    } else {
      updatedExtra[key] = val
    }
  })

  const cleanedProps = {}
  knownKeys.forEach((key) => {
    if (key in updatedProps) cleanedProps[key] = updatedProps[key]
    else if (formData.value.properties && key in formData.value.properties) cleanedProps[key] = formData.value.properties[key]
  })
  formData.value.properties = cleanedProps
  extraValues.value = updatedExtra
  applyFormulaUpdates(formData.value)
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

const getAllColumns = () => ([
  ...(staticColumns.value || []),
  ...dynamicColumns.value.map(col => ({
    ...col,
    label: col.label,
    prop: col.prop,
    type: col.type || 'text'
  }))
])

const getColumnValue = (col, rowData) => {
  if (!rowData || !col?.prop) return ''
  if (Object.prototype.hasOwnProperty.call(rowData, col.prop)) {
    return rowData[col.prop]
  }
  return rowData.properties?.[col.prop] ?? ''
}

const getRowValueByProp = (rowData, prop) => {
  if (!rowData || !prop) return ''
  if (Object.prototype.hasOwnProperty.call(rowData, prop)) {
    return rowData[prop]
  }
  return rowData.properties?.[prop] ?? ''
}

const setRowValueByProp = (rowData, prop, value) => {
  if (!rowData || !prop) return
  if (Object.prototype.hasOwnProperty.call(rowData, prop)) {
    rowData[prop] = value
    return
  }
  if (!rowData.properties) rowData.properties = {}
  rowData.properties[prop] = value
}

const applyFormulaUpdates = (rowData) => {
  applyDocumentFormulaUpdates({
    rowData,
    staticColumns: staticColumns.value,
    dynamicColumns: dynamicColumns.value
  })
}

const buildFileColumnPayload = (columns, rowData) => {
  if (!rowData) return []
  return columns
    .filter(col => col.type === 'file')
    .map(col => {
      const rawValue = getRowValueByProp(rowData, col.prop)
      const rawFiles = Array.isArray(rawValue) ? rawValue : []
      const files = rawFiles
        .map(file => ({
          name: file?.name || file?.fileName || file?.filename || '文件',
          url: file?.url || file?.file_url || file?.dataUrl || ''
        }))
        .filter(file => file.name)
      return { label: col.label, prop: col.prop, files }
    })
}

const buildAiFormPrompt = () => {
  const columns = getAllColumns()
  const model = formModel.value || formData.value
  const columnValues = columns.map(col => {
    const value = getColumnValue(col, model)
    if (col.type === 'file') {
      const files = Array.isArray(value)
        ? value.map(file => ({
          name: file?.name || file?.fileName || file?.filename || '文件'
        }))
        : []
      return { label: col.label, prop: col.prop, type: col.type, value: files }
    }
    return { label: col.label, prop: col.prop, type: col.type, value: value ?? '' }
  })
  const fileColumns = buildFileColumnPayload(columns, model)

  return [
    '请根据以下“当前表格列”生成单据模板。',
    '优先使用列里的 prop 作为字段。',
    '如果用户表单需要但系统列里没有，可以新增扩展字段，field 建议用 ext_ 开头（如 ext_note）。',
    '把“当前行已存在的数据”中的值填入对应字段，没有值就留空。',
    '必须只输出一个模板 JSON，并放在 ```form-template``` 代码块中。',
    '如果是图片/文件字段，请使用 widget=image，并设置 fileSource 为对应文件列 prop。',
    '如果字段是 select/cascader，请使用 widget=select 或 widget=cascader，并给出 options/cascaderOptions。',
    '当前表格列：',
    JSON.stringify(columns, null, 2),
    '当前行已存在的数据：',
    JSON.stringify(columnValues, null, 2),
    '可用文件列素材：',
    JSON.stringify(fileColumns, null, 2)
  ].join('\n')
}

const syncAiContext = () => {
  const columns = getAllColumns()
  pushAiContext(buildDocumentAgentContext({
    app: 'materials',
    view: detailConfig.value.key || 'materials_detail',
    viewName: detailConfig.value.name || '',
    apiUrl: detailConfig.value.apiUrl || '/raw_materials',
    writeUrl: detailConfig.value.writeUrl || detailConfig.value.apiUrl || '/raw_materials',
    rowId: formData.value?.id,
    rowData: formModel.value || formData.value,
    columns,
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
    ElMessage.warning('请先加载物料数据')
    return
  }
  const columns = getAllColumns()
  if (!columns.length) {
    ElMessage.warning('未找到表格列信息')
    return
  }
  syncAiContext()
  const prompt = buildDocumentFormPrompt({
    title: detailConfig.value.name || '物料单据',
    columns,
    rowData: formModel.value || formData.value
  })
  pushAiCommand({
    id: `form_${Date.now()}`,
    type: 'open-worker',
    prompt
  })
}

const formatTemplateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
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
    name: activeSchema.value?.title || '新表单模板'
  }
  templateEditVisible.value = true
}

const openTemplateRename = (template) => {
  if (template?.readonly) {
    ElMessage.info('默认模板不能改名，可以新增一个自己的模板')
    return
  }
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
      const idx = list.findIndex(item => item.id === templateEditForm.value.id)
      if (idx >= 0) {
        if (list[idx].readonly) {
          ElMessage.info('默认模板不能改名，可以新增一个自己的模板')
          return
        }
        const nextSchema = list[idx].schema ? { ...list[idx].schema } : {}
        nextSchema.title = name
        list[idx] = withCurrentScope({ ...list[idx], name, schema: nextSchema, updated_at: now })
      }
    } else {
      const schema = JSON.parse(JSON.stringify(buildFallbackSchema()))
      schema.title = name
      const templateId = `tpl_${Date.now()}`
      schema.docType = templateId
      const record = withCurrentScope({
        id: templateId,
        name,
        schema,
        source: 'manual',
        created_at: now,
        updated_at: now
      })
      list.unshift(record)
      selectedTemplateId.value = record.id
    }
    const preferredTemplateId = templateEditMode.value === 'create'
      ? selectedTemplateId.value
      : templateEditForm.value.id
    await persistCurrentTemplates(list, preferredTemplateId)
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
  if (template.readonly || template.id === defaultTemplateId.value) {
    ElMessage.info('默认模板不能删除')
    return
  }
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
    const list = (templates.value || []).filter(item => item.id !== template.id)
    await persistCurrentTemplates(list)
    if (selectedTemplateId.value === template.id) {
      selectedTemplateId.value = defaultTemplateId.value
    }
    ElMessage.success('模板已删除')
  } catch (e) {
    ElMessage.error('模板删除失败')
  }
}

const saveDoc = async () => {
  if (!formData.value) return
  try {
    const { id, created_at, updated_at, properties, ...payload } = formData.value
    if (supportsProperties.value) {
      payload.properties = properties || {}
    }
    const apiUrl = detailConfig.value.apiUrl || '/raw_materials'
    await request({
      url: `${apiUrl}?id=eq.${props.id}`,
      method: 'patch',
      headers: { 'Content-Profile': 'public' },
      data: payload
    })
    await saveFormValues()
    ElMessage.success('保存成功')
  } catch (e) {
    ElMessage.error('保存失败')
  }
}

const printDoc = () => {
  const container = docContainerRef.value
  const paper = container ? container.querySelector('.eis-document-paper') : null
  if (!paper) return
  const printWindow = window.open('', '_blank')
  if (!printWindow) return
  const sanitizePrintContent = (element) => {
    const clone = element.cloneNode(true)
    if (typeof document === 'undefined' || !document.createTreeWalker) return clone.outerHTML
    const walker = document.createTreeWalker(clone, NodeFilter.SHOW_ELEMENT)
    while (walker.nextNode()) {
      const node = walker.currentNode
      if (node.tagName === 'SCRIPT') {
        node.remove()
        continue
      }
      Array.from(node.attributes || []).forEach((attr) => {
        if (attr.name.toLowerCase().startsWith('on')) {
          node.removeAttribute(attr.name)
        }
      })
    }
    return clone.outerHTML
  }
  const safePaper = sanitizePrintContent(paper)
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
  printWindow.document.write(`<!DOCTYPE html><html><head><title>单据打印</title><style>${styleText}</style></head><body>${safePaper}</body></html>`)
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
  if (formData.value) {
    applyFormulaUpdates(formData.value)
  }
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
  margin-bottom: 20px; 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  background: #fff;
  padding: 15px 20px;
  border-radius: 4px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.05);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
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

:deep(.template-actions .el-button) {
  margin-left: 0;
}

@media print {
  .detail-page { background: white; padding: 0; height: auto; }
  .page-header { display: none; }
  .form-container { overflow: visible; padding: 0; }
}
</style>
