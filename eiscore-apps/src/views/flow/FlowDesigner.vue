<template>
  <div class="flow-designer">
    <div class="designer-header">
      <div class="header-left">
        <el-button text :icon="ArrowLeft" @click="goBack">返回</el-button>
        <h2>{{ appData?.name || '流程设计器' }}</h2>
      </div>
      <div class="header-right">
        <input ref="fileInputRef" type="file" accept=".bpmn,.xml" class="file-input" @change="handleFileChange" />
        <el-button @click="triggerImport" :loading="importing">导入XML</el-button>
        <el-button @click="exportAndSave" :loading="saving">导出并保存</el-button>
        <el-button type="primary" @click="publishWorkflow" :loading="publishing">发布</el-button>
      </div>
    </div>

    <div class="designer-body">
      <BpmnDesigner
        v-model:xml="xml"
        :option="designerOption"
        class="designer-canvas"
        @command-stack-changed="handleCommandStackChanged"
      />
    </div>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, defineComponent, h, markRaw, toRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElEmpty, ElDivider, ElForm, ElFormItem, ElSelect, ElOption, ElInput, ElButton } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import axios from 'axios'
import { BpmnDesigner } from 'kthirty-bpmn-vue3'
import 'kthirty-bpmn-vue3/dist/style.css'

const route = useRoute()
const router = useRouter()

const getAppCenterHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Accept-Profile': 'app_center',
  'Content-Profile': 'app_center'
})

const appId = computed(() => route.params.appId)
const appData = ref(null)
const xml = ref('')
const saving = ref(false)
const publishing = ref(false)
const importing = ref(false)
const fileInputRef = ref(null)

const selectedElement = ref(null)
const visibleFields = ref([])
const editableFields = ref([])
const availableFields = ref([])
const availableTables = ref([])
const selectedTables = ref([])
const openApiSpec = ref(null)
const isSyncingBinding = ref(false)
const bindFormPayloadCache = ref('')
let persistTimer = null

const tableConfigMap = [
  { key: 'hr_table_cols', module: 'hr_employee', label: '人事花名册' },
  { key: 'hr_attendance_cols', module: 'hr_attendance', label: '考勤管理' },
  { key: 'hr_transfer_cols', module: 'hr_change', label: '调岗记录' },
  { key: 'hr_user_cols', module: 'hr_user', label: '用户管理' },
  { key: 'hr_org_cols', module: 'hr_org', label: '部门架构' },
  { key: 'materials_table_cols', module: 'mms_ledger', label: '物料' }
]

const moduleConfigKeyMap = tableConfigMap.reduce((acc, item) => {
  acc[item.module] = item.key
  return acc
}, {})

const tableLabelMap = tableConfigMap.reduce((acc, item) => {
  acc[item.module] = item.label
  return acc
}, {})

let modelerReadyTimer = null

const defaultBpmnXml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:eis="http://eiscore.com/schema/bpmn"
  id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1" name="开始" />
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="156" y="81" width="36" height="36" />
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

const BindFormPanel = defineComponent({
  name: 'BindFormPanel',
  props: {
    elementType: { type: String, default: '' },
    fieldOptions: { type: Array, default: () => [] },
    tableOptions: { type: Array, default: () => [] },
    selectedTables: { type: Array, default: () => [] },
    visibleFields: { type: Array, default: () => [] },
    editableFields: { type: Array, default: () => [] }
  },
  emits: ['update:visibleFields', 'update:editableFields', 'update:selectedTables', 'open-table-picker'],
  setup(props, { emit }) {
    const updateVisible = (value) => emit('update:visibleFields', value)
    const updateEditable = (value) => emit('update:editableFields', value)
    const updateTables = (value) => emit('update:selectedTables', value)
    const openPicker = () => emit('open-table-picker')

    return () => {
      if (props.elementType !== 'bpmn:UserTask') {
        return h('div', { class: 'bindform-panel' }, [
          h(ElEmpty, { description: '请选择用户任务节点' })
        ])
      }

      return h('div', { class: 'bindform-panel' }, [
        h(ElDivider, null, () => '表单绑定'),
        h(ElForm, { labelWidth: '100px', size: 'small' }, () => [
          h(ElFormItem, { label: '业务表' }, () => h(ElSelect, {
            modelValue: props.selectedTables,
            'onUpdate:modelValue': updateTables,
            multiple: true,
            filterable: true,
            collapseTags: true,
            placeholder: '选择业务表'
          }, () => props.tableOptions.map((item) => h(ElOption, {
            key: item.value,
            label: item.label,
            value: item.value
          })))),
          h(ElFormItem, { label: '可见字段' }, () => [
            h(ElSelect, {
              modelValue: props.visibleFields,
              'onUpdate:modelValue': updateVisible,
              multiple: true,
              filterable: true,
              collapseTags: true,
              placeholder: '选择可见字段'
            }, () => props.fieldOptions.map((item) => h(ElOption, {
              key: item.value,
              label: item.label,
              value: item.value
            })))
          ]),
          h(ElFormItem, { label: '可编辑字段' }, () => [
            h(ElSelect, {
              modelValue: props.editableFields,
              'onUpdate:modelValue': updateEditable,
              multiple: true,
              filterable: true,
              collapseTags: true,
              placeholder: '选择可编辑字段'
            }, () => props.fieldOptions.map((item) => h(ElOption, {
              key: item.value,
              label: item.label,
              value: item.value
            })))
          ])
        ])
      ])
    }
  }
})

const designerOption = computed(() => ({
  toolbar: {
    items: ['Imports', 'Exports', 'Previews', 'LintToggle', 'Aligns', 'Scales', 'Commands']
  },
  panel: {
    items: ['UserTask', 'UserTaskButtons', 'Condition', 'Listener', 'StartInitiator', 'ServiceTask'],
    extra: [() => h(BindFormPanel, {
      elementType: selectedElement.value?.type || '',
      fieldOptions: availableFields.value,
      tableOptions: availableTables.value,
      selectedTables: selectedTables.value,
      visibleFields: visibleFields.value,
      editableFields: editableFields.value,
      'onUpdate:selectedTables': (value) => (selectedTables.value = value),
      'onUpdate:visibleFields': (value) => (visibleFields.value = value),
      'onUpdate:editableFields': (value) => (editableFields.value = value)
    })]
  }
}))


const ensureModelerReady = () => {
  const modeler = window?.__kthirty?.modeler
  if (!modeler) return

  const eventBus = modeler.get('eventBus')
  if (!eventBus) return

  eventBus.on('selection.changed', (event) => {
    const element = event?.newSelection?.[0] || null
    selectedElement.value = element ? markRaw(element) : null
    syncBindFormFromElement(element)
  })

  clearInterval(modelerReadyTimer)
  modelerReadyTimer = null
}

const syncBindFormFromElement = (element) => {
  if (!element || element.type !== 'bpmn:UserTask') {
    isSyncingBinding.value = true
    visibleFields.value = []
    editableFields.value = []
    selectedTables.value = []
    isSyncingBinding.value = false
    return
  }

  const bindForm = getBindFormFromElement(element)
  isSyncingBinding.value = true
  visibleFields.value = Array.isArray(bindForm?.visibleFields) ? bindForm.visibleFields : []
  editableFields.value = Array.isArray(bindForm?.editableFields) ? bindForm.editableFields : []
  selectedTables.value = Array.isArray(bindForm?.tables)
    ? bindForm.tables
    : (bindForm?.table ? [bindForm.table] : [])
  isSyncingBinding.value = false
}

const getBindFormFromElement = (element) => {
  const values = element?.businessObject?.extensionElements?.values || []
  const bindForm = values.find((item) => item.$type === 'eis:bindForm')
  if (!bindForm) return null
  const raw = bindForm?.json || bindForm?.value || bindForm?.body || bindForm?.text || ''
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const persistBindFormToElement = async () => {
  if (isSyncingBinding.value) return
  if (!selectedElement.value || selectedElement.value.type !== 'bpmn:UserTask') return

  const modeler = window?.__kthirty?.modeler
  if (!modeler) return

  const moddle = modeler.get('moddle')
  const modeling = modeler.get('modeling')
  if (!moddle || !modeling) return

  const element = toRaw(selectedElement.value)
  const businessObject = element.businessObject
  let extensionElements = businessObject.extensionElements
  if (!extensionElements) {
    extensionElements = moddle.create('bpmn:ExtensionElements', { values: [] })
  }
  if (!Array.isArray(extensionElements.values)) {
    extensionElements.values = []
  }

  const payload = JSON.stringify({
    tables: selectedTables.value || [],
    visibleFields: visibleFields.value || [],
    editableFields: editableFields.value || []
  })
  if (payload === bindFormPayloadCache.value) return
  bindFormPayloadCache.value = payload

  const existingIndex = extensionElements.values.findIndex((item) => item.$type === 'eis:bindForm')
  const newElement = moddle.createAny
    ? moddle.createAny('eis:bindForm', 'http://eiscore.com/schema/bpmn', { json: payload })
    : moddle.create('eis:bindForm', { json: payload })

  if (existingIndex >= 0) {
    extensionElements.values.splice(existingIndex, 1, newElement)
  } else {
    extensionElements.values.push(newElement)
  }

  modeling.updateProperties(element, { extensionElements })
}

const schedulePersistBindForm = () => {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = setTimeout(() => {
    persistBindFormToElement()
  }, 150)
}

watch(visibleFields, (list) => {
  if (isSyncingBinding.value) return
  if (!Array.isArray(list)) return
  editableFields.value = editableFields.value.filter((item) => list.includes(item))
})

watch([visibleFields, editableFields, selectedTables], () => {
  if (isSyncingBinding.value) return
  schedulePersistBindForm()
})

watch(selectedTables, async () => {
  visibleFields.value = []
  editableFields.value = []
  await loadFieldOptions()
})

onMounted(async () => {
  await loadAppData()
  await loadTableOptions()
  await loadFieldOptions()
  if (!xml.value) xml.value = defaultBpmnXml
  modelerReadyTimer = setInterval(ensureModelerReady, 300)
})

onUnmounted(() => {
  if (modelerReadyTimer) {
    clearInterval(modelerReadyTimer)
    modelerReadyTimer = null
  }
  if (persistTimer) {
    clearTimeout(persistTimer)
    persistTimer = null
  }
})

const loadAppData = async () => {
  if (!appId.value) return

  try {
    const token = localStorage.getItem('auth_token')
    const response = await axios.get(`/api/apps?id=eq.${appId.value}`, {
      headers: getAppCenterHeaders(token)
    })
    appData.value = response.data[0]
    xml.value = appData.value?.bpmn_xml || defaultBpmnXml
    if (!selectedTables.value.length && appData.value?.config?.table) {
      selectedTables.value = [appData.value.config.table]
    }
  } catch (error) {
    ElMessage.error('加载应用数据失败')
  }
}

const isPermissionTable = (name = '') => {
  const lower = String(name).toLowerCase()
  if (lower.startsWith('sys_')) return true
  return ['permission', 'acl', 'role', 'auth'].some((key) => lower.includes(key))
}

const fetchOpenApi = async () => {
  if (openApiSpec.value) return openApiSpec.value
  const token = localStorage.getItem('auth_token')
  const response = await axios.get('/api/', {
    headers: getAppCenterHeaders(token)
  })
  openApiSpec.value = response.data
  return openApiSpec.value
}

const getConfigValueFromRow = (row) => {
  if (!row || typeof row !== 'object') return undefined
  if (row.value !== undefined) return row.value
  if (row.config_value !== undefined) return row.config_value
  if (row.data !== undefined) return row.data
  if (row.content !== undefined) return row.content
  return undefined
}

const loadTableOptions = async () => {
  try {
    const token = localStorage.getItem('auth_token')
    const keys = tableConfigMap.map((item) => item.key).join(',')
    let list = []
    try {
      const response = await axios.get(`/system_configs?key=in.(${keys})`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Accept-Profile': 'public',
          'Content-Profile': 'public'
        }
      })
      const rows = Array.isArray(response.data) ? response.data : []
      const existingKeys = new Set(rows.map((item) => item.key))
      const modules = tableConfigMap
        .filter((item) => existingKeys.has(item.key))
        .map((item) => ({ value: item.module, label: item.label }))
      list = modules.length
        ? modules
        : tableConfigMap.map((item) => ({ value: item.module, label: item.label }))
    } catch (error) {
      console.error('加载业务表配置失败，回退到接口扫描：', error)
      const spec = await fetchOpenApi()
      const paths = spec?.paths || {}
      const tables = new Set()
      Object.keys(paths).forEach((path) => {
        const parts = String(path).split('/').filter(Boolean)
        if (!parts.length) return
        if (parts[0] === 'rpc') return
        const name = parts[0]
        if (isPermissionTable(name)) return
        if (tableLabelMap[name]) tables.add(name)
      })
      list = Array.from(tables).sort().map((name) => ({
        value: name,
        label: tableLabelMap[name] || name
      }))
    }
    availableTables.value = list
    if (!selectedTables.value.length) {
      const initial = appData.value?.config?.table || list[0]?.value
      selectedTables.value = initial ? [initial] : []
    }
  } catch (error) {
    availableTables.value = []
    console.error('加载业务表失败：', error)
    ElMessage.error('加载业务表失败')
  }
}

const loadFieldOptions = async () => {
  const tables = selectedTables.value.length
    ? selectedTables.value
    : (appData.value?.config?.table ? [appData.value.config.table] : [])
  if (!tables.length) {
    availableFields.value = []
    return
  }

  try {
    const token = localStorage.getItem('auth_token')
    const collected = []
    const configKeys = tables.map((tableName) => moduleConfigKeyMap[tableName]).filter(Boolean)
    if (configKeys.length) {
      const response = await axios.get(`/system_configs?key=in.(${configKeys.join(',')})`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Accept-Profile': 'public',
          'Content-Profile': 'public'
        }
      })
      const rows = Array.isArray(response.data) ? response.data : []
      rows.forEach((row) => {
        const moduleName = Object.keys(moduleConfigKeyMap).find((mod) => moduleConfigKeyMap[mod] === row.key)
        const tableLabel = tableLabelMap[moduleName] || moduleName || ''
        if (!moduleName) return
        let value = getConfigValueFromRow(row)
        if (typeof value === 'string') {
          try {
            value = JSON.parse(value)
          } catch {
            value = []
          }
        }
        if (Array.isArray(value)) {
          value
            .filter((item) => item && item.prop)
            .forEach((item) => {
              const label = item.label || item.prop
              collected.push({
                value: `${moduleName}.${item.prop}`,
                label: `${tableLabel}.${label}`
              })
            })
        }
      })
      if (collected.length) {
        availableFields.value = collected
        return
      }
    }
    for (const tableName of tables) {
      const response = await axios.get(`/sys_field_acl?module=eq.${tableName}&order=field_code.asc`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Accept-Profile': 'public',
          'Content-Profile': 'public'
        }
      })
      const tableLabel = tableLabelMap[tableName] || tableName
      const list = (Array.isArray(response.data) ? response.data : []).map((item) => ({
        value: `${tableName}.${item.field_code}`,
        label: `${tableLabel}.${item.field_label || item.field_name || item.field_code}`
      }))
      if (list.length) {
        collected.push(...list)
        continue
      }

      const spec = await fetchOpenApi()
      const schema = spec?.components?.schemas?.[tableName]
      const properties = schema?.properties || {}
      collected.push(...Object.keys(properties).map((key) => ({
        value: `${tableName}.${key}`,
        label: `${tableLabel}.${key}`
      })))
    }

    availableFields.value = collected
  } catch (error) {
    availableFields.value = []
    ElMessage.error('加载字段配置失败')
  }
}

const triggerImport = () => {
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
    fileInputRef.value.click()
  }
}

const handleFileChange = async (event) => {
  const file = event.target?.files?.[0]
  if (!file) return
  importing.value = true
  try {
    const text = await file.text()
    xml.value = text
    ElMessage.success('XML 导入成功')
  } catch (error) {
    ElMessage.error('XML 导入失败')
  } finally {
    importing.value = false
  }
}

const handleCommandStackChanged = () => {
  if (!selectedElement.value) return
  if (selectedElement.value.type !== 'bpmn:UserTask') return
  syncBindFormFromElement(selectedElement.value)
}

const getCurrentXml = async () => {
  const modeler = window?.__kthirty?.modeler
  if (modeler?.saveXML) {
    const result = await modeler.saveXML({ format: true })
    return result?.xml || xml.value
  }
  return xml.value
}

const exportAndSave = async () => {
  saving.value = true
  try {
    const bpmnXml = await getCurrentXml()
    const token = localStorage.getItem('auth_token')
    const definitionId = await upsertWorkflowDefinition(bpmnXml, token)
    await axios.patch(
      `/api/apps?id=eq.${appId.value}`,
      {
        bpmn_xml: bpmnXml,
        updated_at: new Date().toISOString(),
        config: {
          ...(appData.value?.config || {}),
          workflowDefinitionId: definitionId || appData.value?.config?.workflowDefinitionId || null,
          table: selectedTables.value[0] || appData.value?.config?.table || null
        }
      },
      {
        headers: {
          ...getAppCenterHeaders(token),
          'Content-Type': 'application/json'
        }
      }
    )
    ElMessage.success('流程已保存')
  } catch (error) {
    ElMessage.error('保存失败: ' + error.message)
  } finally {
    saving.value = false
  }
}

const upsertWorkflowDefinition = async (bpmnXml, token) => {
  const tableName = selectedTables.value[0] || appData.value?.config?.table || null
  const existingId = appData.value?.config?.workflowDefinitionId
  const payload = {
    name: appData.value?.name || '流程定义',
    bpmn_xml: bpmnXml,
    associated_table: tableName
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    'Accept-Profile': 'workflow',
    'Content-Profile': 'workflow',
    'Content-Type': 'application/json'
  }

  if (existingId) {
    await axios.patch(`/api/workflow.definitions?id=eq.${existingId}`, payload, { headers })
    return existingId
  }

  const response = await axios.post(`/api/workflow.definitions`, payload, {
    headers: {
      ...headers,
      Prefer: 'return=representation'
    }
  })
  const definitionId = response.data?.[0]?.id || null
  if (definitionId) {
    appData.value.config = {
      ...(appData.value?.config || {}),
      workflowDefinitionId: definitionId
    }
  }
  return definitionId
}

const publishWorkflow = async () => {
  publishing.value = true
  try {
    await exportAndSave()
    const token = localStorage.getItem('auth_token')
    await axios.patch(
      `/api/apps?id=eq.${appId.value}`,
      { status: 'published' },
      {
        headers: {
          ...getAppCenterHeaders(token),
          'Content-Type': 'application/json'
        }
      }
    )
    ElMessage.success('工作流已发布')
  } catch (error) {
    ElMessage.error('发布失败: ' + error.message)
  } finally {
    publishing.value = false
  }
}

const goBack = () => {
  router.push('/')
}
</script>

<style scoped>
.flow-designer {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--el-bg-color);
}

.designer-header {
  height: 60px;
  background: #fff;
  border-bottom: 1px solid var(--el-border-color-light);
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 24px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-left h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.header-right {
  display: flex;
  gap: 12px;
}

.designer-body {
  flex: 1;
  overflow: hidden;
}

.designer-canvas {
  height: 100%;
}

.file-input {
  display: none;
}

.bindform-panel {
  padding: 8px 12px;
}

.table-picker-row {
  display: flex;
  gap: 8px;
}

.table-picker {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.table-card-grid {
  margin-top: 4px;
}

.table-card {
  cursor: pointer;
  border-radius: 8px;
}

.table-card:hover {
  box-shadow: 0 8px 18px rgba(64, 158, 255, 0.15);
  transform: translateY(-2px);
}

.table-card-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.table-empty {
  padding: 16px 0;
}
</style>