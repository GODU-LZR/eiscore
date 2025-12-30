<template>
  <div class="detail-page">
    <div class="page-header">
      <el-button icon="ArrowLeft" @click="$router.back()">返回列表</el-button>
      <div class="header-actions">
        <el-select v-model="selectedTemplateId" size="small" placeholder="选择模板" style="width: 220px;">
          <el-option
            v-for="tpl in templates"
            :key="tpl.id"
            :label="tpl.name"
            :value="tpl.id"
          />
        </el-select>
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
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import request from '@/utils/request'
import { pushAiContext, pushAiCommand } from '@/utils/ai-context'

// 🟢 引入渲染引擎和 Schema 示例
import EisDocumentEngine from '@/components/eis-document-engine/EisDocumentEngine.vue'
import { documentSchemaExample } from '@/components/eis-document-engine/documentSchemaExample'

const route = useRoute()
const router = useRouter()
const props = defineProps(['id'])

const loading = ref(false)
const formData = ref(null)
const templates = ref([])
const selectedTemplateId = ref('')
const extraValues = ref({})
const dynamicColumns = ref([])
const docContainerRef = ref(null)
const staticColumns = [
  { label: '编号', prop: 'id', type: 'text' },
  { label: '姓名', prop: 'name', type: 'text' },
  { label: '工号', prop: 'employee_no', type: 'text' },
  { label: '部门', prop: 'department', type: 'text' },
  { label: '状态', prop: 'status', type: 'text' }
]

const activeSchema = computed(() => {
  const current = templates.value.find(item => item.id === selectedTemplateId.value)
  return current?.schema || documentSchemaExample
})

const knownPropertyKeys = computed(() => {
  const keys = new Set()
  dynamicColumns.value.forEach(col => {
    if (col?.prop) keys.add(col.prop)
  })
  return keys
})

const formModel = computed(() => {
  if (!formData.value) return null
  return {
    ...formData.value,
    properties: {
      ...(formData.value.properties || {}),
      ...(extraValues.value || {})
    }
  }
})

const fileOptions = computed(() => {
  if (!formData.value) return []
  const props = formData.value.properties || {}
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

const loadData = async () => {
  if (!props.id) return
  loading.value = true
  try {
    const res = await request({ 
      url: `/archives?id=eq.${props.id}`, 
      method: 'get',
      headers: { 'Accept-Profile': 'hr' }
    })
    if (res && res.length > 0) {
      formData.value = res[0]
      // 模拟一些子表数据用于展示效果 (因为数据库里可能还没有 work_history)
      if (!formData.value.properties) formData.value.properties = {}
      if (!formData.value.properties.work_history) {
        formData.value.properties.work_history = [
          { company: '示例前司A', position: '初级工', start_date: '2020-01-01', end_date: '2021-01-01' },
          { company: '示例前司B', position: '组长', start_date: '2021-02-01', end_date: '2023-01-01' }
        ]
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

const loadDynamicColumns = async () => {
  try {
    const res = await request({
      url: '/system_configs?key=eq.hr_table_cols',
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    if (res && res.length > 0) {
      dynamicColumns.value = res[0].value || []
    } else {
      dynamicColumns.value = []
    }
  } catch (e) {
    dynamicColumns.value = []
  }
}

const loadFormValues = async () => {
  if (!formData.value?.id || !selectedTemplateId.value) {
    extraValues.value = {}
    return
  }
  try {
    const res = await request({
      url: `/form_values?row_id=eq.${formData.value.id}&template_id=eq.${selectedTemplateId.value}`,
      method: 'get',
      headers: {
        'Accept-Profile': 'public',
        'Content-Profile': 'public'
      }
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

  Object.keys(formData.value || {}).forEach((key) => {
    if (key === 'properties') return
    if (key in nextValue) formData.value[key] = nextValue[key]
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
      url: '/form_values',
      method: 'post',
      headers: {
        'Accept-Profile': 'public',
        'Content-Profile': 'public',
        'Prefer': 'resolution=merge-duplicates'
      },
      data: {
        row_id: formData.value.id,
        template_id: selectedTemplateId.value,
        payload: extraValues.value || {}
      }
    })
  } catch (e) {
    ElMessage.warning('扩展字段保存失败')
  }
}

const getAllColumns = () => ([
  ...staticColumns,
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
  staticColumns.forEach(col => {
    const val = getRowValueByProp(rowData, col.prop)
    rowDataMap[col.prop] = val
    rowDataMap[col.label] = val
  })
  dynamicColumns.value.forEach(col => {
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
      const result = new Function(`return (${evalExpr})`)()
      if (result !== undefined && !isNaN(result) && isFinite(result)) {
        const finalVal = Number(result.toFixed(2))
        setRowValueByProp(rowData, col.prop, finalVal)
      }
    } catch (e) {
      // ignore formula errors
    }
  })
}

const buildFileColumnPayload = (columns, rowData) => {
  if (!rowData) return []
  const props = rowData.properties || {}
  return columns
    .filter(col => col.type === 'file')
    .map(col => {
      const rawFiles = Array.isArray(props[col.prop]) ? props[col.prop] : []
      const files = rawFiles
        .map(file => ({
          name: file?.name || file?.fileName || file?.filename || '文件',
          url: file?.url || file?.file_url || ''
        }))
        .filter(file => file.name)
      return { label: col.label, prop: col.prop, files }
    })
}

const buildAiFormPrompt = () => {
  const columns = getAllColumns()
  const columnValues = columns.map(col => {
    const value = getColumnValue(col, formData.value)
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
  const fileColumns = buildFileColumnPayload(columns, formData.value)

  return [
    '请根据以下“当前表格列”生成单据模板。',
    '必须严格使用列里的 prop 作为字段，不允许新增字段。',
    '把“当前行已存在的数据”中的值填入对应字段，没有值就留空。',
    '必须只输出一个模板 JSON，并放在 ```form-template``` 代码块中。',
    '如果是图片/文件字段，请使用 widget=image，并设置 fileSource 为对应文件列 prop。',
    '如果列类型是 select/cascader，请使用 widget=select 或 widget=cascader，样式保持表单朴素风格。',
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
    app: 'hr',
    view: 'employee_detail',
    rowId: formData.value?.id,
    columns,
    fileColumns
  })
}

const openAiFormAssistant = () => {
  if (!formData.value) {
    ElMessage.warning('请先加载员工数据')
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

const saveDoc = async () => {
  if (!formData.value) return
  try {
    const { id, created_at, updated_at, ...payload } = formData.value
    await request({
      url: `/archives?id=eq.${props.id}`,
      method: 'patch',
      headers: { 'Content-Profile': 'hr' },
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
  printWindow.document.write(`<!DOCTYPE html><html><head><title>单据打印</title><style>${styleText}</style></head><body>${paper.outerHTML}</body></html>`)
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
  justify-content: center; /* 居中显示纸张 */
  padding-bottom: 40px;
}

/* 打印时的样式优化 */
@media print {
  .detail-page { background: white; padding: 0; height: auto; }
  .page-header { display: none; }
  .form-container { overflow: visible; padding: 0; }
}
</style>
