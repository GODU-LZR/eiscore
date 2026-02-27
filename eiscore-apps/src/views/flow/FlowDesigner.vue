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

    <div class="designer-link-config">
      <div class="link-config-title">
        <el-icon><Connection /></el-icon>
        <span>流程业务联动配置</span>
      </div>
      <div class="link-config-form">
        <el-switch
          v-model="workflowLinkConfig.autoAdvanceEnabled"
          active-text="开启自动检测并推进"
          inactive-text="仅手动推进"
        />
        <el-radio-group v-model="panelMode" size="small" class="config-mode-switch">
          <el-radio-button value="simple">简单模式</el-radio-button>
          <el-radio-button value="pro">专业模式</el-radio-button>
        </el-radio-group>
        <el-button :icon="Check" type="primary" plain @click="saveWorkflowLinkConfig">
          保存联动配置
        </el-button>
      </div>
      <p class="link-config-tip">
        建议流程节点状态统一使用：创建 / 生效 / 锁定。运行页会跳转到已绑定业务应用并自动检测状态推进流程。
      </p>
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
import { ref, computed, onMounted, onUnmounted, watch, defineComponent, h, markRaw } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElEmpty, ElDivider, ElForm, ElFormItem, ElSelect, ElOption, ElInput, ElButton, ElSwitch, ElIcon } from 'element-plus'
import { ArrowLeft, Connection, Check } from '@element-plus/icons-vue'
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
const stateMapping = ref({ target_table: '', state_field: '', state_value: '' })
const mappingLoading = ref(false)
const mappingSaving = ref(false)
const autoRuleSaving = ref(false)
const taskAssignment = ref({ candidate_roles: [], candidate_users: [] })
const assignmentLoading = ref(false)
const assignmentSaving = ref(false)
const roleOptions = ref([])
const userOptions = ref([])
const businessAppOptions = ref([])
const businessAppTableMap = ref({})
const workflowLinkConfig = ref({
  businessAppId: '',
  autoAdvanceEnabled: true,
  taskBusinessAppBindings: {}
})
const taskAutoRule = ref({
  enabled: true,
  trigger_state: ''
})
const panelMode = ref('simple')

const WORKFLOW_STATE_CANONICAL_MAP = Object.freeze({
  created: 'created',
  draft: 'created',
  '创建': 'created',
  '新建': 'created',
  active: 'active',
  enabled: 'active',
  '生效': 'active',
  '启用': 'active',
  locked: 'locked',
  disabled: 'locked',
  '锁定': 'locked',
  '禁用': 'locked'
})

const canonicalizeWorkflowState = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const normalized = WORKFLOW_STATE_CANONICAL_MAP[raw.toLowerCase()] || WORKFLOW_STATE_CANONICAL_MAP[raw]
  return normalized || raw
}

const WORKFLOW_STATE_OPTIONS = Object.freeze([
  { label: '创建', value: 'created' },
  { label: '生效', value: 'active' },
  { label: '锁定', value: 'locked' }
])

const LEGACY_BINDABLE_APP_OPTIONS = Object.freeze([
  { value: 'legacy:hr_employee', label: '人事花名册（HR）' },
  { value: 'legacy:hr_user', label: '用户管理（HR）' },
  { value: 'legacy:hr_attendance', label: '考勤管理（HR）' },
  { value: 'legacy:hr_change', label: '调岗记录（HR）' },
  { value: 'legacy:mms_ledger', label: '物料台账（MMS）' },
  { value: 'legacy:mms_inventory_ledger', label: '库存台账（MMS）' },
  { value: 'legacy:mms_inventory_stock_in', label: '入库（MMS）' },
  { value: 'legacy:mms_inventory_stock_out', label: '出库（MMS）' },
  { value: 'legacy:mms_inventory_current', label: '库存查询（MMS）' }
])

const LEGACY_APP_STATE_TARGET_MAP = Object.freeze({
  'legacy:hr_employee': { target_table: 'hr.archives', state_field: 'status' },
  'legacy:hr_user': { target_table: 'public.users', state_field: 'status' },
  'legacy:hr_attendance': { target_table: 'hr.attendance_records', state_field: 'status' },
  'legacy:hr_change': { target_table: 'hr.employee_changes', state_field: 'status' },
  'legacy:mms_ledger': { target_table: 'public.raw_materials', state_field: 'status' },
  'legacy:mms_inventory_stock_in': { target_table: 'scm.inventory_drafts', state_field: 'status' },
  'legacy:mms_inventory_stock_out': { target_table: 'scm.inventory_drafts', state_field: 'status' }
})

const getAppConfigObject = () => (
  appData.value?.config && typeof appData.value.config === 'object'
    ? appData.value.config
    : {}
)

const normalizeTaskBusinessBindings = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const next = {}
  Object.entries(value).forEach(([taskId, binding]) => {
    const key = String(taskId || '').trim()
    const mapValue = String(binding || '').trim()
    if (key && mapValue) next[key] = mapValue
  })
  return next
}

const getSelectedTaskId = () => {
  if (!selectedElement.value || selectedElement.value.type !== 'bpmn:UserTask') return ''
  return String(selectedElement.value.id || '').trim()
}

const getCurrentBusinessBinding = () => {
  const taskId = getSelectedTaskId()
  if (taskId) {
    return String(workflowLinkConfig.value?.taskBusinessAppBindings?.[taskId] || '').trim()
  }
  return String(workflowLinkConfig.value?.businessAppId || '').trim()
}

const setCurrentBusinessBinding = (value) => {
  const normalized = String(value || '').trim()
  const taskId = getSelectedTaskId()
  if (taskId) {
    const currentMap = normalizeTaskBusinessBindings(workflowLinkConfig.value?.taskBusinessAppBindings)
    const nextMap = { ...currentMap }
    if (normalized) nextMap[taskId] = normalized
    else delete nextMap[taskId]
    workflowLinkConfig.value = {
      ...workflowLinkConfig.value,
      taskBusinessAppBindings: nextMap
    }
    return
  }
  workflowLinkConfig.value = {
    ...workflowLinkConfig.value,
    businessAppId: normalized
  }
}

const inferStateTargetByBusinessBinding = () => {
  const binding = getCurrentBusinessBinding()
  if (!binding) return { target_table: '', state_field: '' }
  if (binding.startsWith('legacy:')) {
    const legacy = LEGACY_APP_STATE_TARGET_MAP[binding]
    if (legacy) return { ...legacy }
  }
  const tableName = String(businessAppTableMap.value?.[binding] || '').trim()
  if (tableName) return { target_table: tableName, state_field: 'status' }
  return { target_table: '', state_field: '' }
}

const toConfigObject = (value) => {
  if (value && typeof value === 'object') return value
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object') return parsed
    } catch {
      // ignore
    }
  }
  return {}
}

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
    stateMapping: { type: Object, default: () => ({}) },
    mappingLoading: { type: Boolean, default: false },
    mappingSaving: { type: Boolean, default: false },
    taskAutoRule: { type: Object, default: () => ({ enabled: true, trigger_state: '' }) },
    autoRuleSaving: { type: Boolean, default: false },
    mode: { type: String, default: 'simple' },
    businessAppOptions: { type: Array, default: () => [] },
    businessAppId: { type: String, default: '' },
    taskAssignment: { type: Object, default: () => ({}) },
    assignmentLoading: { type: Boolean, default: false },
    assignmentSaving: { type: Boolean, default: false },
    roleOptions: { type: Array, default: () => [] },
    userOptions: { type: Array, default: () => [] }
  },
  emits: [
    'update:stateMapping',
    'save-state-mapping',
    'update:taskAutoRule',
    'save-task-auto-rule',
    'update:taskAssignment',
    'save-task-assignment',
    'update:businessAppId',
    'save-link-config'
  ],
  setup(props, { emit }) {
    const updateMappingField = (key, value) => {
      emit('update:stateMapping', { ...props.stateMapping, [key]: value })
    }
    const updateAutoRuleField = (key, value) => {
      emit('update:taskAutoRule', { ...props.taskAutoRule, [key]: value })
    }
    const updateAssignmentField = (key, value) => {
      emit('update:taskAssignment', { ...props.taskAssignment, [key]: value })
    }
    const saveMapping = () => emit('save-state-mapping')
    const saveAutoRule = () => emit('save-task-auto-rule')
    const saveAssignment = () => emit('save-task-assignment')
    const updateBusinessApp = (value) => emit('update:businessAppId', String(value || '').trim())
    const saveLinkConfig = () => emit('save-link-config')

    return () => {
      const linkageBlock = [
        h(ElDivider, null, () => '业务应用绑定'),
        h(ElForm, { labelWidth: '100px', size: 'small' }, () => [
          h(ElFormItem, { label: '业务应用' }, () => h(ElSelect, {
            modelValue: props.businessAppId || '',
            clearable: true,
            filterable: true,
            placeholder: '选择要联动的业务应用',
            'onUpdate:modelValue': updateBusinessApp
          }, () => props.businessAppOptions.map((item) => h(ElOption, {
            key: item.value,
            label: item.label,
            value: item.value
          }))))
        ]),
        h('div', { class: 'mapping-actions' }, [
          h(ElButton, { type: 'primary', size: 'small', plain: true, onClick: saveLinkConfig }, () => '保存联动配置')
        ])
      ]

      if (props.elementType !== 'bpmn:UserTask') {
        return h('div', { class: 'bindform-panel' }, [
          ...linkageBlock,
          h(ElEmpty, { description: '请选择用户任务节点' })
        ])
      }

      return h('div', { class: 'bindform-panel' }, [
        ...linkageBlock,
        ...(props.mode === 'pro'
          ? []
          : [
              h(ElDivider, null, () => '简单模式配置'),
              h('p', { class: 'panel-mode-tip' }, '当前仅显示常用配置；字段权限、任务分派等高级项请切换到专业模式。'),
              h(ElForm, { labelWidth: '100px', size: 'small' }, () => [
                h(ElFormItem, { label: '节点状态' }, () => h(ElSelect, {
                  modelValue: props.stateMapping?.state_value || '',
                  filterable: true,
                  allowCreate: true,
                  clearable: true,
                  defaultFirstOption: true,
                  placeholder: '建议: 创建 / 生效 / 锁定',
                  disabled: props.mappingLoading,
                  'onUpdate:modelValue': (value) => updateMappingField('state_value', value || '')
                }, () => WORKFLOW_STATE_OPTIONS.map((item) => h(ElOption, {
                  key: item.value,
                  label: item.label,
                  value: item.value
                })))),
                h(ElFormItem, { label: '自动推进' }, () => h(ElSwitch, {
                  modelValue: props.taskAutoRule?.enabled !== false,
                  'onUpdate:modelValue': (value) => updateAutoRuleField('enabled', value !== false)
                })),
                h(ElFormItem, { label: '触发状态' }, () => h(ElSelect, {
                  modelValue: props.taskAutoRule?.trigger_state || '',
                  filterable: true,
                  allowCreate: true,
                  clearable: true,
                  defaultFirstOption: true,
                  placeholder: '达到该状态时自动推进',
                  'onUpdate:modelValue': (value) => updateAutoRuleField('trigger_state', value || '')
                }, () => WORKFLOW_STATE_OPTIONS.map((item) => h(ElOption, {
                  key: item.value,
                  label: item.label,
                  value: item.value
                })))),
                h(ElDivider, null, () => '任务办理限制'),
                h(ElFormItem, { label: '指定办理角色' }, () => h(ElSelect, {
                  modelValue: props.taskAssignment?.candidate_roles?.[0] || '',
                  clearable: true,
                  filterable: true,
                  placeholder: '不指定则任意角色可办理',
                  disabled: props.assignmentLoading,
                  'onUpdate:modelValue': (value) => updateAssignmentField('candidate_roles', value ? [String(value)] : [])
                }, () => props.roleOptions.map((item) => h(ElOption, {
                  key: item.value,
                  label: item.label,
                  value: item.value
                })))),
                h(ElFormItem, { label: '指定办理人' }, () => h(ElSelect, {
                  modelValue: props.taskAssignment?.candidate_users?.[0] || '',
                  clearable: true,
                  filterable: true,
                  placeholder: '不指定则任意人员可办理',
                  disabled: props.assignmentLoading,
                  'onUpdate:modelValue': (value) => updateAssignmentField('candidate_users', value ? [String(value)] : [])
                }, () => props.userOptions.map((item) => h(ElOption, {
                  key: item.value,
                  label: item.label,
                  value: item.value
                })))),
                h('div', { class: 'mapping-actions' }, [
                  h(ElButton, { type: 'primary', size: 'small', loading: props.mappingSaving, onClick: saveMapping }, () => '保存状态'),
                  h(ElButton, { type: 'primary', size: 'small', plain: true, loading: props.autoRuleSaving, onClick: saveAutoRule }, () => '保存推进'),
                  h(ElButton, { type: 'primary', size: 'small', plain: true, loading: props.assignmentSaving, onClick: saveAssignment }, () => '保存分派')
                ])
              ])
            ]),
        ...(props.mode === 'pro'
          ? [
        h(ElDivider, null, () => '专业模式配置'),
        h(ElForm, { labelWidth: '100px', size: 'small' }, () => [
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
          h(ElFormItem, { label: '状态值' }, () => h(ElSelect, {
            modelValue: props.stateMapping?.state_value || '',
            filterable: true,
            allowCreate: true,
            clearable: true,
            defaultFirstOption: true,
            placeholder: '建议: 创建 / 生效 / 锁定',
            disabled: props.mappingLoading,
            'onUpdate:modelValue': (value) => updateMappingField('state_value', value || '')
          }, () => WORKFLOW_STATE_OPTIONS.map((item) => h(ElOption, {
            key: item.value,
            label: item.label,
            value: item.value
          })))),
          h('div', { class: 'mapping-actions' }, [
            h(ElButton, { type: 'primary', size: 'small', loading: props.mappingSaving, onClick: saveMapping }, () => '保存映射')
          ]),
          h(ElDivider, null, () => '自动推进规则'),
          h(ElFormItem, { label: '启用自动推进' }, () => h(ElSwitch, {
            modelValue: props.taskAutoRule?.enabled !== false,
            'onUpdate:modelValue': (value) => updateAutoRuleField('enabled', value !== false)
          })),
          h(ElFormItem, { label: '触发状态' }, () => h(ElSelect, {
            modelValue: props.taskAutoRule?.trigger_state || '',
            filterable: true,
            allowCreate: true,
            clearable: true,
            defaultFirstOption: true,
            placeholder: '达到该状态时自动推进',
            'onUpdate:modelValue': (value) => updateAutoRuleField('trigger_state', value || '')
          }, () => WORKFLOW_STATE_OPTIONS.map((item) => h(ElOption, {
            key: item.value,
            label: item.label,
            value: item.value
          })))),
          h('div', { class: 'mapping-actions' }, [
            h(ElButton, { type: 'primary', size: 'small', loading: props.autoRuleSaving, onClick: saveAutoRule }, () => '保存规则')
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
      ]
          : [])
      ])
    }
  }
})

const panelItemOptions = Object.freeze(['UserTask', 'UserTaskButtons', 'Condition', 'Listener', 'StartInitiator', 'ServiceTask'])

const designerOption = computed(() => ({
  toolbar: {
    items: ['Imports', 'Exports', 'Previews', 'LintToggle', 'Aligns', 'Scales', 'Commands']
  },
  panel: {
    items: panelMode.value === 'pro' ? panelItemOptions : [],
    extra: [() => h(BindFormPanel, {
      elementType: selectedElement.value?.type || '',
      stateMapping: stateMapping.value,
      mappingLoading: mappingLoading.value,
      mappingSaving: mappingSaving.value,
      taskAutoRule: taskAutoRule.value,
      autoRuleSaving: autoRuleSaving.value,
      mode: panelMode.value,
      businessAppOptions: businessAppOptions.value,
      businessAppId: getCurrentBusinessBinding(),
      taskAssignment: taskAssignment.value,
      assignmentLoading: assignmentLoading.value,
      assignmentSaving: assignmentSaving.value,
      roleOptions: roleOptions.value,
      userOptions: userOptions.value,
      'onUpdate:stateMapping': (value) => (stateMapping.value = value),
      'onUpdate:taskAutoRule': (value) => (taskAutoRule.value = value),
      'onUpdate:taskAssignment': (value) => (taskAssignment.value = value),
      'onUpdate:businessAppId': (value) => { setCurrentBusinessBinding(value) },
      'onSave-state-mapping': saveStateMapping,
      'onSave-task-auto-rule': saveTaskAutoRule,
      'onSave-task-assignment': saveTaskAssignment,
      'onSave-link-config': saveWorkflowLinkConfig
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
    syncStateMapping(element)
    syncTaskAutoRule(element)
    syncTaskAssignment(element)
  })

  clearInterval(modelerReadyTimer)
  modelerReadyTimer = null
}

const resetStateMapping = () => {
  stateMapping.value = { target_table: '', state_field: '', state_value: '' }
}

const resetTaskAutoRule = () => {
  taskAutoRule.value = { enabled: true, trigger_state: '' }
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

const syncTaskAutoRule = (element) => {
  if (!element || element.type !== 'bpmn:UserTask') {
    resetTaskAutoRule()
    return
  }
  const taskId = String(element?.id || '').trim()
  if (!taskId) {
    resetTaskAutoRule()
    return
  }
  const cfg = getAppConfigObject()
  const allRules = cfg.workflowAutoAdvanceRules && typeof cfg.workflowAutoAdvanceRules === 'object'
    ? cfg.workflowAutoAdvanceRules
    : {}
  const rule = allRules[taskId] && typeof allRules[taskId] === 'object' ? allRules[taskId] : {}
  taskAutoRule.value = {
    enabled: rule.enabled !== false,
    trigger_state: canonicalizeWorkflowState(rule.trigger_state)
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
    const inferred = inferStateTargetByBusinessBinding()
    const defaultTable = String(inferred.target_table || appData.value?.config?.table || '').trim()
    stateMapping.value = {
      target_table: row?.target_table || defaultTable,
      state_field: row?.state_field || inferred.state_field || 'status',
      state_value: canonicalizeWorkflowState(row?.state_value)
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
    const inferred = inferStateTargetByBusinessBinding()
    const resolvedTargetTable = String(stateMapping.value.target_table || inferred.target_table || appData.value?.config?.table || '').trim()
    const resolvedStateField = String(stateMapping.value.state_field || inferred.state_field || 'status').trim()
    const token = localStorage.getItem('auth_token')
    await axios.post(
      '/api/workflow_state_mappings?on_conflict=workflow_app_id,bpmn_task_id',
      {
        workflow_app_id: appId.value,
        bpmn_task_id: selectedElement.value.id,
        target_table: resolvedTargetTable || null,
        state_field: resolvedStateField || 'status',
        state_value: canonicalizeWorkflowState(stateMapping.value.state_value) || null
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

const saveTaskAutoRule = async () => {
  if (!selectedElement.value || selectedElement.value.type !== 'bpmn:UserTask' || !appId.value) return
  const taskId = String(selectedElement.value.id || '').trim()
  if (!taskId) return

  autoRuleSaving.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const cfg = getAppConfigObject()
    const currentRules = cfg.workflowAutoAdvanceRules && typeof cfg.workflowAutoAdvanceRules === 'object'
      ? cfg.workflowAutoAdvanceRules
      : {}
    const nextRules = {
      ...currentRules,
      [taskId]: {
        enabled: taskAutoRule.value.enabled !== false,
        trigger_state: canonicalizeWorkflowState(taskAutoRule.value.trigger_state) || null
      }
    }
    const nextConfig = {
      ...cfg,
      workflowAutoAdvanceRules: nextRules
    }
    await axios.patch(
      `/api/apps?id=eq.${appId.value}`,
      { config: nextConfig, updated_at: new Date().toISOString() },
      {
        headers: {
          ...getAppCenterHeaders(token),
          'Content-Type': 'application/json'
        }
      }
    )
    appData.value.config = nextConfig
    ElMessage.success('自动推进规则已保存')
  } catch (error) {
    ElMessage.error(formatWorkflowError('自动推进规则保存失败', error))
  } finally {
    autoRuleSaving.value = false
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

watch(panelMode, () => {
  remountDesigner()
})

watch(
  () => getCurrentBusinessBinding(),
  (newBinding, oldBinding) => {
    if (!selectedElement.value || selectedElement.value.type !== 'bpmn:UserTask') return
    const currentTarget = String(stateMapping.value.target_table || '').trim()
    const oldRef = (() => {
      const binding = String(oldBinding || '').trim()
      if (!binding) return { target_table: '', state_field: '' }
      if (binding.startsWith('legacy:')) {
        return LEGACY_APP_STATE_TARGET_MAP[binding] || { target_table: '', state_field: '' }
      }
      const tableName = String(businessAppTableMap.value?.[binding] || '').trim()
      return tableName ? { target_table: tableName, state_field: 'status' } : { target_table: '', state_field: '' }
    })()
    const nextRef = inferStateTargetByBusinessBinding()
    if (!nextRef.target_table) return

    // 保留手动指定；仅在“未设置”或“仍是旧绑定推断值”时自动切换
    if (!currentTarget || currentTarget === String(oldRef.target_table || '').trim()) {
      stateMapping.value = {
        ...stateMapping.value,
        target_table: nextRef.target_table,
        state_field: stateMapping.value.state_field || nextRef.state_field || 'status'
      }
    }
  }
)

onMounted(async () => {
  await loadAppData()
  await Promise.all([loadRoleOptions(), loadUserOptions()])
  await loadBusinessAppOptions()
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
})

const loadAppData = async () => {
  if (!appId.value) return

  try {
    const token = localStorage.getItem('auth_token')
    const response = await axios.get(`/api/apps?id=eq.${appId.value}`, {
      headers: getAppCenterHeaders(token)
    })
    appData.value = response.data[0]
    appData.value.config = toConfigObject(appData.value?.config)
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
    const cfg = getAppConfigObject()
    workflowLinkConfig.value = {
      businessAppId: String(cfg.workflowBusinessAppId || '').trim(),
      autoAdvanceEnabled: cfg.workflowAutoAdvanceEnabled !== false,
      taskBusinessAppBindings: normalizeTaskBusinessBindings(cfg.workflowTaskBusinessAppBindings)
    }
    panelMode.value = cfg.workflowDesignerPanelMode === 'pro' ? 'pro' : 'simple'
  } catch (error) {
    ElMessage.error('加载应用数据失败')
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
  syncStateMapping(selectedElement.value)
  syncTaskAutoRule(selectedElement.value)
  syncTaskAssignment(selectedElement.value)
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
          ...getAppConfigObject(),
          workflowDefinitionId: definitionId || getAppConfigObject()?.workflowDefinitionId || null,
          table: getAppConfigObject()?.table || null,
          workflowBusinessAppId: workflowLinkConfig.value.businessAppId || getAppConfigObject()?.workflowBusinessAppId || null,
          workflowTaskBusinessAppBindings: normalizeTaskBusinessBindings(workflowLinkConfig.value.taskBusinessAppBindings),
          workflowAutoAdvanceEnabled: workflowLinkConfig.value.autoAdvanceEnabled !== false,
          workflowDesignerPanelMode: panelMode.value === 'pro' ? 'pro' : 'simple'
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

const loadBusinessAppOptions = async () => {
  try {
    const token = localStorage.getItem('auth_token')
    const response = await axios.get('/api/apps?select=id,name,config,status,app_type&order=updated_at.desc', {
      headers: getAppCenterHeaders(token)
    })
    const rows = Array.isArray(response.data) ? response.data : []
    const tableMap = {}
    const appOptions = rows
      .filter((item) => String(item?.id || '') !== String(appId.value || ''))
      .filter((item) => String(item?.app_type || '').trim() === 'data')
      .map((item) => {
        const cfg = toConfigObject(item?.config)
        const tableName = String(cfg.table || '').trim()
        const id = String(item.id || '')
        if (id) tableMap[id] = tableName
        const status = String(item?.status || '').trim() || 'draft'
        const suffix = [tableName, status].filter(Boolean).join(' / ')
        return {
          value: id,
          label: suffix ? `${item.name || item.id}（数据应用：${suffix}）` : `${String(item.name || item.id || '')}（数据应用）`
        }
      })
      .filter((item) => item.value)

    businessAppTableMap.value = tableMap
    businessAppOptions.value = [...appOptions, ...LEGACY_BINDABLE_APP_OPTIONS]
  } catch {
    businessAppTableMap.value = {}
    businessAppOptions.value = [...LEGACY_BINDABLE_APP_OPTIONS]
  }
}

const saveWorkflowLinkConfig = async () => {
  if (!appId.value || !appData.value) return
  try {
    const token = localStorage.getItem('auth_token')
    const nextConfig = {
      ...getAppConfigObject(),
      workflowBusinessAppId: workflowLinkConfig.value.businessAppId || null,
      workflowTaskBusinessAppBindings: normalizeTaskBusinessBindings(workflowLinkConfig.value.taskBusinessAppBindings),
      workflowAutoAdvanceEnabled: workflowLinkConfig.value.autoAdvanceEnabled !== false,
      workflowDesignerPanelMode: panelMode.value === 'pro' ? 'pro' : 'simple'
    }
    await axios.patch(
      `/api/apps?id=eq.${appId.value}`,
      { config: nextConfig, updated_at: new Date().toISOString() },
      {
        headers: {
          ...getAppCenterHeaders(token),
          'Content-Type': 'application/json'
        }
      }
    )
    appData.value.config = nextConfig
    ElMessage.success('流程业务联动配置已保存')
  } catch (error) {
    ElMessage.error(formatWorkflowError('保存流程业务联动配置失败', error))
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
  const tableName = appData.value?.config?.table || null
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

.designer-link-config {
  margin: 10px 16px 8px;
  padding: 10px 14px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 10px;
  background: var(--el-color-primary-light-9);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.link-config-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-color-primary-dark-2);
}

.link-config-form {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.link-config-tip {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.config-mode-switch {
  margin-left: 4px;
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

.panel-mode-tip {
  margin: 0 0 10px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
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
  gap: 8px;
  justify-content: flex-end;
  margin-top: 4px;
}

.table-empty {
  padding: 16px 0;
}
</style>
