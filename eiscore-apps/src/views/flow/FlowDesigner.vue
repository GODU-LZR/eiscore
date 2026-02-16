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
        :key="designerRenderKey"
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

const getWorkflowHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Accept-Profile': 'workflow',
  'Content-Profile': 'workflow'
})

const getRuntimeRoutePath = (id) => `/apps/app/${id}`

const normalizeRuntimeRoutePath = (routePath, appIdValue) => {
  const fallback = getRuntimeRoutePath(appIdValue)
  const raw = String(routePath || '').trim()
  if (!raw) return fallback
  if (!raw.startsWith('/apps/app/')) return fallback
  return raw
}

const toAppRouterPath = (routePath) => {
  const raw = String(routePath || '').trim()
  if (!raw) return ''
  if (raw === '/apps') return '/'
  if (raw.startsWith('/apps/')) return raw.slice('/apps'.length)
  return raw.startsWith('/') ? raw : `/${raw}`
}

const getErrorDetails = (error) => ({
  status: error?.response?.status,
  code: error?.response?.data?.code || '',
  message: error?.response?.data?.message || error?.message || '未知错误'
})

const isRlsDenied = (error) => {
  const { status, code } = getErrorDetails(error)
  return status === 403 && code === '42501'
}

const formatWorkflowError = (fallback, error) => {
  const { message } = getErrorDetails(error)
  if (isRlsDenied(error)) {
    return `${fallback}（当前账号无权限，请使用超级管理员）`
  }
  return `${fallback}：${message}`
}

const parseDefinitionId = (value) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeBpmnXml = (raw) => {
  let text = String(raw || '')
  if (!text) return ''

  text = text.replace(/^\uFEFF/, '')
  const trimmed = text.trim()

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    try {
      const parsed = JSON.parse(trimmed)
      if (typeof parsed === 'string') {
        text = parsed
      }
    } catch {
      // keep original text
    }
  }

  return text
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
}

const isBpmnXmlUsable = (raw) => {
  const text = normalizeBpmnXml(raw).trim()
  if (!text) return false
  if (!text.includes('<bpmn:definitions') || !text.includes('<bpmn:process')) return false
  if (!text.includes('<bpmndi:BPMNPlane')) return false

  const processMatch = text.match(/<bpmn:process\b[^>]*\bid="([^"]+)"/i)
  const planeMatch = text.match(/<bpmndi:BPMNPlane\b[^>]*\bbpmnElement="([^"]+)"/i)
  if (processMatch?.[1] && planeMatch?.[1] && processMatch[1] !== planeMatch[1]) return false

  return true
}

const loadFallbackDefinitionXml = async (token, appIdValue, definitionId = null) => {
  const headers = getWorkflowHeaders(token)
  if (definitionId) {
    const byId = await axios.get(`/api/definitions?id=eq.${definitionId}&limit=1`, { headers })
    const row = Array.isArray(byId.data) ? byId.data[0] : null
    if (row?.bpmn_xml) return normalizeBpmnXml(row.bpmn_xml)
  }
  const latest = await axios.get(`/api/definitions?app_id=eq.${appIdValue}&order=id.desc&limit=1`, { headers })
  const latestRow = Array.isArray(latest.data) ? latest.data[0] : null
  return normalizeBpmnXml(latestRow?.bpmn_xml || '')
}

const appId = computed(() => route.params.appId)
const appData = ref(null)
const xml = ref('')
const designerRenderKey = ref(0)
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
const stateMapping = ref({ target_table: '', state_field: '', state_value: '' })
const mappingLoading = ref(false)
const mappingSaving = ref(false)
const taskAssignment = ref({ candidate_roles: [], candidate_users: [] })
const assignmentLoading = ref(false)
const assignmentSaving = ref(false)
const roleOptions = ref([])
const userOptions = ref([])
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

const scheduleEnsureModelerReady = () => {
  if (modelerReadyTimer) {
    clearInterval(modelerReadyTimer)
  }
  modelerReadyTimer = setInterval(ensureModelerReady, 300)
}

const remountDesigner = () => {
  designerRenderKey.value += 1
  selectedElement.value = null
  scheduleEnsureModelerReady()
}

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
    editableFields: { type: Array, default: () => [] },
    stateMapping: { type: Object, default: () => ({}) },
    mappingLoading: { type: Boolean, default: false },
    mappingSaving: { type: Boolean, default: false },
    taskAssignment: { type: Object, default: () => ({}) },
    assignmentLoading: { type: Boolean, default: false },
    assignmentSaving: { type: Boolean, default: false },
    roleOptions: { type: Array, default: () => [] },
    userOptions: { type: Array, default: () => [] }
  },
  emits: [
    'update:visibleFields',
    'update:editableFields',
    'update:selectedTables',
    'update:stateMapping',
    'save-state-mapping',
    'update:taskAssignment',
    'save-task-assignment',
    'open-table-picker'
  ],
  setup(props, { emit }) {
    const updateVisible = (value) => emit('update:visibleFields', value)
    const updateEditable = (value) => emit('update:editableFields', value)
    const updateTables = (value) => emit('update:selectedTables', value)
    const updateMappingField = (key, value) => {
      emit('update:stateMapping', { ...props.stateMapping, [key]: value })
    }
    const updateAssignmentField = (key, value) => {
      emit('update:taskAssignment', { ...props.taskAssignment, [key]: value })
    }
    const saveMapping = () => emit('save-state-mapping')
    const saveAssignment = () => emit('save-task-assignment')
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
          ]),
          h(ElDivider, null, () => '状态映射'),
          h(ElFormItem, { label: '目标表' }, () => h(ElInput, {
            modelValue: props.stateMapping?.target_table || '',
            placeholder: '如: hr.leave_requests',
            disabled: props.mappingLoading,
            'onUpdate:modelValue': (value) => updateMappingField('target_table', value)
          })),
          h(ElFormItem, { label: '状态字段' }, () => h(ElInput, {
            modelValue: props.stateMapping?.state_field || '',
            placeholder: '如: approval_status',
            disabled: props.mappingLoading,
            'onUpdate:modelValue': (value) => updateMappingField('state_field', value)
          })),
          h(ElFormItem, { label: '状态值' }, () => h(ElInput, {
            modelValue: props.stateMapping?.state_value || '',
            placeholder: '如: PENDING_REVIEW',
            disabled: props.mappingLoading,
            'onUpdate:modelValue': (value) => updateMappingField('state_value', value)
          })),
          h('div', { class: 'mapping-actions' }, [
            h(ElButton, { type: 'primary', size: 'small', loading: props.mappingSaving, onClick: saveMapping }, () => '保存映射')
          ]),
          h(ElDivider, null, () => '任务分派'),
          h(ElFormItem, { label: '候选角色' }, () => h(ElSelect, {
            modelValue: props.taskAssignment?.candidate_roles || [],
            'onUpdate:modelValue': (value) => updateAssignmentField('candidate_roles', value),
            multiple: true,
            filterable: true,
            clearable: true,
            collapseTags: true,
            disabled: props.assignmentLoading,
            placeholder: '选择可执行角色'
          }, () => props.roleOptions.map((item) => h(ElOption, {
            key: item.value,
            label: item.label,
            value: item.value
          })))),
          h(ElFormItem, { label: '候选用户' }, () => h(ElSelect, {
            modelValue: props.taskAssignment?.candidate_users || [],
            'onUpdate:modelValue': (value) => updateAssignmentField('candidate_users', value),
            multiple: true,
            filterable: true,
            clearable: true,
            collapseTags: true,
            disabled: props.assignmentLoading,
            placeholder: '选择可执行用户'
          }, () => props.userOptions.map((item) => h(ElOption, {
            key: item.value,
            label: item.label,
            value: item.value
          })))),
          h('div', { class: 'mapping-actions' }, [
            h(ElButton, { type: 'primary', size: 'small', loading: props.assignmentSaving, onClick: saveAssignment }, () => '保存分派')
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
      stateMapping: stateMapping.value,
      mappingLoading: mappingLoading.value,
      mappingSaving: mappingSaving.value,
      taskAssignment: taskAssignment.value,
      assignmentLoading: assignmentLoading.value,
      assignmentSaving: assignmentSaving.value,
      roleOptions: roleOptions.value,
      userOptions: userOptions.value,
      'onUpdate:selectedTables': (value) => (selectedTables.value = value),
      'onUpdate:visibleFields': (value) => (visibleFields.value = value),
      'onUpdate:editableFields': (value) => (editableFields.value = value),
      'onUpdate:stateMapping': (value) => (stateMapping.value = value),
      'onUpdate:taskAssignment': (value) => (taskAssignment.value = value),
      'onSave-state-mapping': saveStateMapping,
      'onSave-task-assignment': saveTaskAssignment
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
    syncStateMapping(element)
    syncTaskAssignment(element)
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
    resetTaskAssignment()
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

const resetStateMapping = () => {
  stateMapping.value = { target_table: '', state_field: '', state_value: '' }
}

const normalizeStringList = (value) => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

const resetTaskAssignment = () => {
  taskAssignment.value = { candidate_roles: [], candidate_users: [] }
}

const ensureWorkflowDefinitionId = async (token) => {
  const existing = parseDefinitionId(appData.value?.config?.workflowDefinitionId)
  if (existing) return existing

  const response = await axios.get(
    `/api/definitions?app_id=eq.${appId.value}&order=id.desc&limit=1`,
    { headers: getWorkflowHeaders(token) }
  )
  const row = Array.isArray(response.data) ? response.data[0] : null
  const resolved = parseDefinitionId(row?.id)
  if (resolved) {
    appData.value.config = {
      ...(appData.value?.config || {}),
      workflowDefinitionId: resolved
    }
    return resolved
  }

  const bpmnXml = await getCurrentXml()
  const created = await upsertWorkflowDefinition(bpmnXml, token)
  return parseDefinitionId(created)
}

const syncTaskAssignment = async (element) => {
  if (!element || element.type !== 'bpmn:UserTask' || !appId.value) {
    resetTaskAssignment()
    return
  }
  assignmentLoading.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const definitionId = await ensureWorkflowDefinitionId(token)
    if (!definitionId) {
      resetTaskAssignment()
      return
    }
    const response = await axios.get(
      `/api/task_assignments?definition_id=eq.${definitionId}&task_id=eq.${element.id}&limit=1`,
      { headers: getWorkflowHeaders(token) }
    )
    const row = Array.isArray(response.data) ? response.data[0] : null
    taskAssignment.value = {
      candidate_roles: normalizeStringList(row?.candidate_roles),
      candidate_users: normalizeStringList(row?.candidate_users)
    }
  } catch (error) {
    resetTaskAssignment()
  } finally {
    assignmentLoading.value = false
  }
}

const syncStateMapping = async (element) => {
  if (!element || element.type !== 'bpmn:UserTask' || !appId.value) {
    resetStateMapping()
    return
  }
  mappingLoading.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const response = await axios.get(
      `/api/workflow_state_mappings?workflow_app_id=eq.${appId.value}&bpmn_task_id=eq.${element.id}&limit=1`,
      { headers: getAppCenterHeaders(token) }
    )
    const row = Array.isArray(response.data) ? response.data[0] : null
    stateMapping.value = {
      target_table: row?.target_table || '',
      state_field: row?.state_field || '',
      state_value: row?.state_value || ''
    }
  } catch (error) {
    resetStateMapping()
  } finally {
    mappingLoading.value = false
  }
}

const saveStateMapping = async () => {
  if (!selectedElement.value || selectedElement.value.type !== 'bpmn:UserTask' || !appId.value) return
  mappingSaving.value = true
  try {
    const token = localStorage.getItem('auth_token')
    await axios.post(
      '/api/workflow_state_mappings?on_conflict=workflow_app_id,bpmn_task_id',
      {
        workflow_app_id: appId.value,
        bpmn_task_id: selectedElement.value.id,
        target_table: stateMapping.value.target_table || null,
        state_field: stateMapping.value.state_field || null,
        state_value: stateMapping.value.state_value || null
      },
      {
        headers: {
          ...getAppCenterHeaders(token),
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation'
        }
      }
    )
    ElMessage.success('状态映射已保存')
  } catch (error) {
    ElMessage.error(formatWorkflowError('状态映射保存失败', error))
  } finally {
    mappingSaving.value = false
  }
}

const saveTaskAssignment = async () => {
  if (!selectedElement.value || selectedElement.value.type !== 'bpmn:UserTask' || !appId.value) return
  assignmentSaving.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const definitionId = await ensureWorkflowDefinitionId(token)
    if (!definitionId) {
      ElMessage.warning('未找到流程定义，请先导出并保存流程')
      return
    }
    const payload = {
      definition_id: definitionId,
      task_id: selectedElement.value.id,
      candidate_roles: normalizeStringList(taskAssignment.value.candidate_roles),
      candidate_users: normalizeStringList(taskAssignment.value.candidate_users)
    }
    const headers = {
      ...getWorkflowHeaders(token),
      'Content-Type': 'application/json'
    }

    const existingResponse = await axios.get(
      `/api/task_assignments?definition_id=eq.${definitionId}&task_id=eq.${selectedElement.value.id}&order=id.desc&limit=1`,
      { headers: getWorkflowHeaders(token) }
    )
    const existing = Array.isArray(existingResponse.data) ? existingResponse.data[0] : null
    if (existing?.id) {
      await axios.patch(
        `/api/task_assignments?id=eq.${existing.id}`,
        payload,
        { headers }
      )
    } else {
      await axios.post(
        '/api/task_assignments',
        payload,
        {
          headers: {
            ...headers,
            Prefer: 'return=representation'
          }
        }
      )
    }
    ElMessage.success('任务分派已保存')
  } catch (error) {
    ElMessage.error(formatWorkflowError('任务分派保存失败', error))
  } finally {
    assignmentSaving.value = false
  }
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
  await Promise.all([loadRoleOptions(), loadUserOptions()])
  await loadTableOptions()
  await loadFieldOptions()
  if (!xml.value) {
    xml.value = defaultBpmnXml
    remountDesigner()
  } else {
    scheduleEnsureModelerReady()
  }
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
    const appXml = normalizeBpmnXml(appData.value?.bpmn_xml || '')
    let resolvedXml = appXml

    if (!isBpmnXmlUsable(appXml)) {
      const configuredDefinitionId = parseDefinitionId(appData.value?.config?.workflowDefinitionId)
      const fallbackXml = await loadFallbackDefinitionXml(token, appId.value, configuredDefinitionId)
      if (isBpmnXmlUsable(fallbackXml)) {
        resolvedXml = fallbackXml
        ElMessage.warning('检测到应用流程图异常，已自动回退到流程定义版本')
      } else {
        resolvedXml = defaultBpmnXml
        ElMessage.warning('流程定义异常，已回退默认模板，请导入或重新绘制后保存')
      }
    }

    xml.value = resolvedXml || defaultBpmnXml
    remountDesigner()
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
      const response = await axios.get(`/api/system_configs?key=in.(${keys})`, {
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
      const response = await axios.get(`/api/system_configs?key=in.(${configKeys.join(',')})`, {
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
      const response = await axios.get(`/api/sys_field_acl?module=eq.${tableName}&order=field_code.asc`, {
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
    xml.value = normalizeBpmnXml(text)
    remountDesigner()
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
    ElMessage.error(formatWorkflowError('流程保存失败', error))
  } finally {
    saving.value = false
  }
}

const loadRoleOptions = async () => {
  try {
    const token = localStorage.getItem('auth_token')
    const response = await axios.get('/api/roles?select=code,name&order=sort.asc,name.asc', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept-Profile': 'public',
        'Content-Profile': 'public'
      }
    })
    roleOptions.value = (Array.isArray(response.data) ? response.data : [])
      .map((item) => ({
        value: String(item.code || '').trim(),
        label: item.name ? `${item.name} (${item.code})` : String(item.code || '').trim()
      }))
      .filter((item) => item.value)
  } catch (error) {
    roleOptions.value = []
  }
}

const loadUserOptions = async () => {
  try {
    const token = localStorage.getItem('auth_token')
    const response = await axios.get('/api/users?select=username,full_name&order=username.asc', {
      headers: {
        Authorization: `Bearer ${token}`,
        'Accept-Profile': 'public',
        'Content-Profile': 'public'
      }
    })
    userOptions.value = (Array.isArray(response.data) ? response.data : [])
      .map((item) => ({
        value: String(item.username || '').trim(),
        label: item.full_name ? `${item.full_name} (${item.username})` : String(item.username || '').trim()
      }))
      .filter((item) => item.value)
  } catch (error) {
    userOptions.value = []
  }
}

const upsertWorkflowDefinition = async (bpmnXml, token) => {
  const tableName = selectedTables.value[0] || appData.value?.config?.table || null
  const existingId = appData.value?.config?.workflowDefinitionId
  const payload = {
    name: appData.value?.name || '流程定义',
    bpmn_xml: bpmnXml,
    app_id: appId.value,
    associated_table: tableName
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    'Accept-Profile': 'workflow',
    'Content-Profile': 'workflow',
    'Content-Type': 'application/json'
  }

  if (existingId) {
    await axios.patch(`/api/definitions?id=eq.${existingId}`, payload, { headers })
    return existingId
  }

  const response = await axios.post(`/api/definitions`, payload, {
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

const upsertPublishedRoute = async (token) => {
  const headers = {
    ...getAppCenterHeaders(token),
    'Content-Type': 'application/json'
  }
  const defaultRoutePath = getRuntimeRoutePath(appId.value)
  const listResponse = await axios.get(
    `/api/published_routes?app_id=eq.${appId.value}&order=id.desc&limit=1`,
    { headers }
  )
  const current = Array.isArray(listResponse.data) ? listResponse.data[0] : null
  const normalizedRoutePath = normalizeRuntimeRoutePath(current?.route_path, appId.value)
  const payload = {
    app_id: appId.value,
    route_path: normalizedRoutePath || defaultRoutePath,
    mount_point: current?.mount_point || '/apps',
    is_active: true
  }
  if (current?.id) {
    await axios.patch(`/api/published_routes?id=eq.${current.id}`, payload, { headers })
    return payload.route_path
  }
  const createResponse = await axios.post('/api/published_routes', payload, {
    headers: {
      ...headers,
      Prefer: 'return=representation'
    }
  })
  return createResponse.data?.[0]?.route_path || payload.route_path
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
    const routePath = await upsertPublishedRoute(token)
    ElMessage.success('工作流已发布')
    router.push(toAppRouterPath(routePath || getRuntimeRoutePath(appId.value)))
  } catch (error) {
    ElMessage.error(formatWorkflowError('发布失败', error))
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

.mapping-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 4px;
}

.table-empty {
  padding: 16px 0;
}
</style>
