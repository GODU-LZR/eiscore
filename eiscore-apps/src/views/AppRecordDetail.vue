<template>
  <div class="detail-page">
    <div class="page-header">
      <el-button icon="ArrowLeft" @click="goBack">返回列表</el-button>
      <div class="header-actions">
        <el-select v-model="selectedTemplateId" size="small" placeholder="选择模板" style="width: 220px;">
          <el-option
            v-for="tpl in templates"
            :key="tpl.id"
            :label="tpl.name"
            :value="tpl.id"
          />
        </el-select>
        <el-button @click="openTemplateManager">模板库</el-button>
        <el-button type="primary" @click="openAiFormAssistant">AI生成表单</el-button>
        <el-button type="primary" plain @click="printDoc">打印单据</el-button>
        <el-button type="success" @click="saveDoc">保存修改</el-button>
      </div>
    </div>

    <div class="form-container" v-loading="loading" ref="docContainerRef">
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
          <el-input v-model="templateEditForm.name" placeholder="如：通用表单" />
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
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '@/utils/request'
import { pushAiContext, pushAiCommand } from '@/utils/ai-context'
import { evaluateFormulaExpression } from '@shared/utils/formula-eval'

import EisDocumentEngine from '@/components/eis-document-engine/EisDocumentEngine.vue'
import { documentSchemaExample } from '@/components/eis-document-engine/documentSchemaExample'

const route = useRoute()
const router = useRouter()

const appId = computed(() => (route.params.appId ? String(route.params.appId) : ''))
const rowId = computed(() => (route.params.rowId ? String(route.params.rowId) : ''))

const loading = ref(false)
const formData = ref(null)
const templates = ref([])
const selectedTemplateId = ref('')
const extraValues = ref({})
const dynamicColumns = ref([])
const staticColumns = ref([])
const includeProperties = ref(true)
const primaryKey = ref('id')
const schemaName = ref('app_data')
const apiUrl = ref('')
const appName = ref('数据应用')
const docContainerRef = ref(null)

const templateManagerVisible = ref(false)
const templateEditVisible = ref(false)
const templatePreviewVisible = ref(false)
const templateSaving = ref(false)
const templateEditMode = ref('create')
const templatePreview = ref(null)
const templateEditForm = ref({ id: '', name: '' })

const templateEditTitle = computed(() => (templateEditMode.value === 'rename' ? '修改模板名称' : '新增模板'))

const supportsProperties = computed(() => includeProperties.value !== false)

const allColumns = computed(() => getAllColumns())

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
  const model = supportsProperties.value ? (formData.value.properties || {}) : (extraValues.value || {})
  return allColumns.value
    .filter(col => col.type === 'file')
    .map(col => {
      const rawFiles = Array.isArray(model[col.prop]) ? model[col.prop] : []
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

const normalizeConfig = (raw) => {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

const sanitizeFieldName = (value) => {
  if (value === null || value === undefined) return ''
  let name = String(value).trim().toLowerCase()
  if (!name) return ''
  name = name.replace(/[^a-z0-9_]+/g, '_')
  if (!name) return ''
  if (!/^[a-z]/.test(name)) {
    name = `f_${name}`
  }
  return name
}

const normalizeColumn = (col) => {
  if (!col) return { prop: '', label: '', type: 'text', isStatic: true }
  if (typeof col === 'string') {
    const sanitized = sanitizeFieldName(col)
    return { prop: sanitized || col, label: col, type: 'text', isStatic: true }
  }
  const rawField = col.field || col.prop || col.label || ''
  const sanitized = sanitizeFieldName(rawField)
  const dependsOnRaw = col.dependsOn || ''
  const dependsOn = dependsOnRaw ? sanitizeFieldName(dependsOnRaw) : ''
  return {
    prop: sanitized || rawField,
    label: col.label || sanitized || rawField || '',
    type: col.type || 'text',
    options: Array.isArray(col.options) ? col.options : [],
    expression: col.expression || '',
    dependsOn: dependsOn || '',
    cascaderOptions: col.cascaderOptions || col.cascaderMap || {},
    geoAddress: col.geoAddress,
    fileMaxCount: col.fileMaxCount,
    fileMaxSizeMb: col.fileMaxSizeMb,
    fileAccept: col.fileAccept,
    isStatic: col.isStatic !== false
  }
}

const normalizeColumns = (raw) => {
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(normalizeColumn)
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map(normalizeColumn)
    } catch {
      return []
    }
  }
  return []
}

const buildSchemaSection = (title, cols) => {
  const list = Array.isArray(cols) ? cols.filter(col => col && col.label && col.prop) : []
  if (!list.length) return null
  return {
    type: 'section',
    title,
    cols: 2,
    children: list.map(col => ({ label: col.label, field: col.prop }))
  }
}

const buildFallbackSchema = () => {
  const baseSection = buildSchemaSection('基础信息', staticColumns.value || [])
  const extraSection = buildSchemaSection('扩展信息', dynamicColumns.value || [])
  const layout = [baseSection, extraSection].filter(Boolean)
  if (!layout.length) return documentSchemaExample
  return {
    docType: `app_${appId.value || 'data'}_auto`,
    title: appName.value || '单据',
    layout
  }
}

const activeSchema = computed(() => {
  const current = templates.value.find(item => item.id === selectedTemplateId.value)
  return current?.schema || buildFallbackSchema()
})

const loadAppConfig = async () => {
  if (!appId.value) return
  try {
    const res = await request({
      url: `/apps?id=eq.${appId.value}`,
      method: 'get',
      headers: { 'Accept-Profile': 'app_center', 'Content-Profile': 'app_center' }
    })
    const app = Array.isArray(res) ? res[0] : res
    const config = normalizeConfig(app?.config)
    appName.value = app?.name || '数据应用'
    primaryKey.value = config?.primaryKey || 'id'
    includeProperties.value = config?.includeProperties !== false
    const tableFull = config?.table || ''
    if (tableFull) {
      if (tableFull.includes('.')) {
        const [schema, table] = tableFull.split('.')
        schemaName.value = schema || 'app_data'
        apiUrl.value = `/${table}`
      } else {
        schemaName.value = 'app_data'
        apiUrl.value = `/${tableFull}`
      }
    } else {
      const fallback = `data_app_${String(appId.value).replace(/-/g, '').slice(0, 8)}`
      schemaName.value = 'app_data'
      apiUrl.value = `/${fallback}`
    }

    const cols = normalizeColumns(config?.columns)
    staticColumns.value = cols.filter(col => col.isStatic !== false)
    dynamicColumns.value = cols.filter(col => col.isStatic === false)
  } catch (e) {
    ElMessage.error('加载应用配置失败')
  }
}

const loadData = async () => {
  if (!rowId.value || !apiUrl.value) return
  loading.value = true
  try {
    const res = await request({
      url: `${apiUrl.value}?${encodeURIComponent(primaryKey.value)}=eq.${rowId.value}`,
      method: 'get',
      headers: { 'Accept-Profile': schemaName.value, 'Content-Profile': schemaName.value }
    })
    if (Array.isArray(res) && res.length > 0) {
      formData.value = res[0]
      if (supportsProperties.value && !formData.value.properties) {
        formData.value.properties = {}
      }
      applyFormulaUpdates(formData.value)
    }
  } catch (e) {
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
    templates.value = Array.isArray(list)
      ? list.filter(item => item && item.schema && Array.isArray(item.schema.layout))
      : []
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
    data: { key: 'form_templates', value: list }
  })
}

const loadFormValues = async () => {
  if (!rowId.value || !selectedTemplateId.value) {
    extraValues.value = {}
    return
  }
  try {
    const res = await request({
      url: `/form_values?row_id=eq.${rowId.value}&template_id=eq.${selectedTemplateId.value}`,
      method: 'get',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }
    })
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
  sanitizeCascaderValues(nextValue)
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
  if (!rowId.value || !selectedTemplateId.value) return
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
        row_id: rowId.value,
        template_id: selectedTemplateId.value,
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

const normalizeOptionKey = (value) => {
  if (value === null || value === undefined) return ''
  return String(value)
}

const normalizeOptionList = (options) => {
  if (!Array.isArray(options)) return []
  return options.map(opt => {
    if (opt && typeof opt === 'object') {
      return {
        label: opt.label ?? opt.value ?? '',
        value: opt.value ?? opt.label ?? ''
      }
    }
    return { label: String(opt), value: opt }
  })
}

const sanitizeCascaderValues = (rowData) => {
  if (!rowData) return
  const cascaderColumns = dynamicColumns.value.filter(col => col?.type === 'cascader' && col.dependsOn && col.cascaderOptions)
  if (cascaderColumns.length === 0) return
  cascaderColumns.forEach(col => {
    const parentValue = getRowValueByProp(rowData, col.dependsOn)
    const map = col.cascaderOptions || {}
    const key = normalizeOptionKey(parentValue)
    const options = map[key] || map[parentValue] || []
    const normalized = normalizeOptionList(options)
    const allowed = new Set(normalized.map(opt => normalizeOptionKey(opt.value)))
    const current = getRowValueByProp(rowData, col.prop)
    if (current && !allowed.has(normalizeOptionKey(current))) {
      setRowValueByProp(rowData, col.prop, '')
    }
  })
}

const applyFormulaUpdates = (rowData) => {
  if (!rowData) return
  const formulaColumns = dynamicColumns.value.filter(col => col?.type === 'formula' && col.expression)
  if (formulaColumns.length === 0) return

  const rowDataMap = {}
  allColumns.value.forEach(col => {
    const val = getRowValueByProp(rowData, col.prop)
    rowDataMap[col.prop] = val
    rowDataMap[col.label] = val
  })

  formulaColumns.forEach(col => {
    try {
      const evalExpr = col.expression.replace(/\{(.+?)\}/g, (match, key) => {
        const val = rowDataMap[key]
        const num = parseFloat(val)
        return Number.isFinite(num) ? num : 0
      })
      const result = evaluateFormulaExpression(evalExpr)
      if (result !== undefined && !isNaN(result) && isFinite(result)) {
        const finalVal = Number(result.toFixed(2))
        setRowValueByProp(rowData, col.prop, finalVal)
      }
    } catch {
      // ignore
    }
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
  const columnValues = columns.map(col => ({
    label: col.label,
    prop: col.prop,
    type: col.type,
    value: getRowValueByProp(model || {}, col.prop) ?? ''
  }))
  const fileColumns = buildFileColumnPayload(columns, model || {})

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
  const fileColumns = columns.filter(col => col.type === 'file')
  pushAiContext({
    app: 'app_center',
    view: `app_${appId.value || 'data'}`,
    viewName: appName.value || '',
    apiUrl: apiUrl.value || '',
    rowId: rowId.value,
    columns,
    fileColumns,
    aiScene: 'form',
    allowFormula: false,
    allowImport: false
  })
}

const openAiFormAssistant = () => {
  if (!formData.value) {
    ElMessage.warning('请先加载数据')
    return
  }
  const columns = getAllColumns()
  if (!columns.length) {
    ElMessage.warning('未找到表格列信息')
    return
  }
  syncAiContext()
  const prompt = buildAiFormPrompt()
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
        const nextSchema = list[idx].schema ? { ...list[idx].schema } : {}
        nextSchema.title = name
        list[idx] = { ...list[idx], name, schema: nextSchema, updated_at: now }
      }
    } else {
      const schema = JSON.parse(JSON.stringify(buildFallbackSchema()))
      schema.title = name
      const templateId = `tpl_${Date.now()}`
      schema.docType = templateId
      const record = {
        id: templateId,
        name,
        schema,
        source: 'manual',
        created_at: now,
        updated_at: now
      }
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
  } catch {
    return
  }
  try {
    const list = (templates.value || []).filter(item => item.id !== template.id)
    await saveTemplateLibrary(list)
    templates.value = list
    if (selectedTemplateId.value === template.id) {
      selectedTemplateId.value = list[0]?.id || ''
    }
    ElMessage.success('模板已删除')
  } catch (e) {
    ElMessage.error('模板删除失败')
  }
}

const saveDoc = async () => {
  if (!formData.value || !apiUrl.value) return
  try {
    const { created_at, updated_at, properties, ...payload } = formData.value
    if (supportsProperties.value) {
      payload.properties = properties || {}
    }
    await request({
      url: `${apiUrl.value}?${encodeURIComponent(primaryKey.value)}=eq.${rowId.value}`,
      method: 'patch',
      headers: { 'Accept-Profile': schemaName.value, 'Content-Profile': schemaName.value },
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

const goBack = () => {
  router.back()
}

onMounted(async () => {
  await loadAppConfig()
  await loadTemplates()
  await loadData()
  window.addEventListener('eis-form-templates-updated', handleTemplatesUpdated)
})

onUnmounted(() => {
  window.removeEventListener('eis-form-templates-updated', handleTemplatesUpdated)
})

const handleTemplatesUpdated = (event) => {
  const list = event?.detail?.templates
  if (Array.isArray(list)) {
    const filtered = list.filter(item => item && item.schema && Array.isArray(item.schema.layout))
    templates.value = filtered
    if (!selectedTemplateId.value && filtered.length > 0) {
      selectedTemplateId.value = filtered[0].id
    }
  } else {
    loadTemplates()
  }
}

watch([appId, rowId], async () => {
  await loadAppConfig()
  await loadData()
})

watch([selectedTemplateId, rowId], () => {
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
