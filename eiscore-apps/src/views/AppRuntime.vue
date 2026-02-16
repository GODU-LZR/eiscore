<template>
  <div v-if="appData?.app_type === 'data'">
    <AppCenterGrid :app-data="appData" :app-id="runtimeAppId" />
  </div>

  <div v-else class="app-container">
    <div class="app-header">
      <div class="header-text">
        <h2>{{ appData?.name || '应用' }}</h2>
        <p>{{ appData?.desc || appData?.description || '' }}</p>
      </div>
      <div class="header-actions">
        <el-button type="primary" plain @click="goBack">返回应用列表</el-button>
        <el-button v-if="appData?.app_type" @click="openBuilder">打开配置</el-button>
      </div>
    </div>

    <div class="runtime-content" v-loading="loading">
      <el-empty v-if="!appData" description="未找到应用" />

      <template v-else>
        <div
          v-if="appData.app_type === 'workflow'"
          class="workflow-runtime"
          :class="{ 'side-collapsed': workflowSideCollapsed }"
        >
          <div class="workflow-main">
            <div class="workflow-canvas-toolbar">
              <span class="canvas-tip">拖动空白区域可移动流程图，滚轮可缩放</span>
              <div class="canvas-actions">
                <el-button text size="small" @click="fitBpmnViewport">重置视图</el-button>
                <el-button
                  v-if="!workflowSideCollapsed"
                  text
                  size="small"
                  class="side-toggle-btn"
                  @click="toggleWorkflowSide"
                >
                  收起侧栏
                </el-button>
              </div>
            </div>
            <div class="bpmn-canvas" ref="bpmnCanvasRef"></div>
            <el-button
              v-if="workflowSideCollapsed"
              class="workflow-side-fab"
              type="primary"
              @click="toggleWorkflowSide"
            >
              展开侧栏
            </el-button>
          </div>
          <div
            class="workflow-side-resizer"
            :class="{ 'is-hidden': workflowSideCollapsed }"
            @mousedown="startWorkflowSideResize"
          ></div>
          <div
            class="workflow-side"
            :class="{ 'is-collapsed': workflowSideCollapsed }"
            :style="workflowSideStyle"
          >
            <div class="workflow-side-inner">
            <el-tabs v-model="workflowViewTab" class="workflow-tabs">
              <el-tab-pane
                v-for="tab in workflowTabOptions"
                :key="tab.name"
                :label="tab.label"
                :name="tab.name"
              />
            </el-tabs>

            <div v-if="workflowViewTab === 'employee'" class="workflow-panel">
              <el-alert
                title="员工页：只显示你当前可处理的任务。"
                type="info"
                :closable="false"
                class="workflow-tip"
              />
              <div class="instance-toolbar">
                <el-input
                  v-model="newBusinessKey"
                  size="small"
                  clearable
                  placeholder="业务键（可选，如单号）"
                  class="instance-key-input"
                />
                <el-button type="primary" size="small" :loading="instanceStarting" @click="startWorkflowInstance">
                  发起流程
                </el-button>
                <el-button size="small" :loading="instanceLoading" @click="refreshWorkflowData">刷新</el-button>
              </div>
              <el-table v-if="employeeInstances.length" :data="employeeInstances" size="small" border>
                <el-table-column prop="id" label="实例ID" min-width="84" />
                <el-table-column prop="business_key" label="业务键" min-width="120" />
                <el-table-column label="发起人" min-width="110">
                  <template #default="{ row }">{{ formatStarter(row?.id) }}</template>
                </el-table-column>
                <el-table-column label="当前任务" min-width="132">
                  <template #default="{ row }">{{ formatTaskName(row?.current_task_id) }}</template>
                </el-table-column>
                <el-table-column label="操作" min-width="220">
                  <template #default="{ row }">
                    <div class="instance-actions">
                      <el-select
                        v-model="nextTaskSelections[row.id]"
                        size="small"
                        clearable
                        filterable
                        placeholder="选择下一任务"
                        class="next-task-select"
                      >
                        <el-option
                          v-for="opt in getTransitionOptions(row)"
                          :key="opt.value"
                          :label="opt.label"
                          :value="opt.value"
                        />
                        <el-option label="标记完成" value="__complete__" />
                      </el-select>
                      <el-button
                        type="primary"
                        size="small"
                        :loading="instanceTransitioningId === row.id"
                        @click="transitionWorkflowInstance(row)"
                      >
                        提交
                      </el-button>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
              <el-empty v-else description="暂无可处理任务" />
            </div>

            <div v-else-if="workflowViewTab === 'admin'" class="workflow-panel">
              <el-divider content-position="left">流程实例</el-divider>
              <div class="instance-toolbar">
                <el-input
                  v-model="newBusinessKey"
                  size="small"
                  clearable
                  placeholder="业务键（可选，如单号）"
                  class="instance-key-input"
                />
                <el-button type="primary" size="small" :loading="instanceStarting" @click="startWorkflowInstance">
                  启动
                </el-button>
                <el-button size="small" :loading="instanceLoading" @click="refreshWorkflowData">刷新</el-button>
              </div>
              <el-table v-if="workflowInstances.length" :data="workflowInstances" size="small" border>
                <el-table-column prop="id" label="实例ID" min-width="84" />
                <el-table-column prop="business_key" label="业务键" min-width="120" />
                <el-table-column label="发起人" min-width="110">
                  <template #default="{ row }">{{ formatStarter(row?.id) }}</template>
                </el-table-column>
                <el-table-column label="当前任务" min-width="132">
                  <template #default="{ row }">{{ formatTaskName(row?.current_task_id) }}</template>
                </el-table-column>
                <el-table-column label="状态" min-width="90">
                  <template #default="{ row }">{{ formatInstanceStatus(row?.status) }}</template>
                </el-table-column>
                <el-table-column label="可执行" min-width="90">
                  <template #default="{ row }">
                    <el-tag :type="canExecuteTask(row?.current_task_id) ? 'success' : 'warning'" size="small">
                      {{ canExecuteTask(row?.current_task_id) ? '是' : '否' }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="操作" min-width="230">
                  <template #default="{ row }">
                    <div class="instance-actions">
                      <el-select
                        v-model="nextTaskSelections[row.id]"
                        size="small"
                        clearable
                        filterable
                        placeholder="选择下一任务"
                        class="next-task-select"
                      >
                        <el-option
                          v-for="opt in getTransitionOptions(row)"
                          :key="opt.value"
                          :label="opt.label"
                          :value="opt.value"
                        />
                        <el-option label="标记完成" value="__complete__" />
                      </el-select>
                      <el-button
                        type="primary"
                        size="small"
                        :disabled="!canExecuteTask(row?.current_task_id)"
                        :loading="instanceTransitioningId === row.id"
                        @click="transitionWorkflowInstance(row)"
                      >
                        推进
                      </el-button>
                    </div>
                  </template>
                </el-table-column>
              </el-table>
              <el-empty v-else description="暂无流程实例" />

              <el-divider content-position="left">实例审计日志</el-divider>
              <el-table v-if="workflowEvents.length" :data="workflowEvents" size="small" border>
                <el-table-column label="事件" min-width="130">
                  <template #default="{ row }">{{ formatEventType(row?.event_type) }}</template>
                </el-table-column>
                <el-table-column prop="instance_id" label="实例ID" min-width="82" />
                <el-table-column label="来源任务" min-width="110">
                  <template #default="{ row }">{{ formatTaskName(row?.from_task_id) }}</template>
                </el-table-column>
                <el-table-column label="目标任务" min-width="110">
                  <template #default="{ row }">{{ formatTaskName(row?.to_task_id) }}</template>
                </el-table-column>
                <el-table-column prop="actor_username" label="执行人" min-width="100" />
                <el-table-column prop="created_at" label="时间" min-width="160" />
              </el-table>
              <el-empty v-else description="暂无审计日志" />
            </div>

            <div v-else class="workflow-panel">
              <el-divider content-position="left">状态映射</el-divider>
              <el-table v-if="stateMappings.length" :data="stateMappings" size="small" border>
                <el-table-column label="任务" min-width="160">
                  <template #default="{ row }">{{ formatTaskName(row?.bpmn_task_id) }}</template>
                </el-table-column>
                <el-table-column prop="target_table" label="目标表" min-width="140" />
                <el-table-column prop="state_field" label="状态字段" min-width="120" />
                <el-table-column prop="state_value" label="状态值" min-width="120" />
              </el-table>
              <el-empty v-else description="暂无映射" />

              <el-divider content-position="left">任务分派规则</el-divider>
              <el-table v-if="taskAssignments.length" :data="taskAssignments" size="small" border>
                <el-table-column label="任务" min-width="140">
                  <template #default="{ row }">{{ formatTaskName(row?.task_id) }}</template>
                </el-table-column>
                <el-table-column label="候选角色" min-width="140">
                  <template #default="{ row }">{{ formatArrayCell(row?.candidate_roles) }}</template>
                </el-table-column>
                <el-table-column label="候选用户" min-width="140">
                  <template #default="{ row }">{{ formatArrayCell(row?.candidate_users) }}</template>
                </el-table-column>
              </el-table>
              <el-empty v-else description="未配置分派规则（默认不限制执行人）" />

              <el-divider content-position="left">实例审计日志</el-divider>
              <el-table v-if="workflowEvents.length" :data="workflowEvents" size="small" border>
                <el-table-column label="事件" min-width="130">
                  <template #default="{ row }">{{ formatEventType(row?.event_type) }}</template>
                </el-table-column>
                <el-table-column prop="instance_id" label="实例ID" min-width="82" />
                <el-table-column label="来源任务" min-width="110">
                  <template #default="{ row }">{{ formatTaskName(row?.from_task_id) }}</template>
                </el-table-column>
                <el-table-column label="目标任务" min-width="110">
                  <template #default="{ row }">{{ formatTaskName(row?.to_task_id) }}</template>
                </el-table-column>
                <el-table-column prop="actor_username" label="执行人" min-width="100" />
                <el-table-column prop="created_at" label="时间" min-width="160" />
              </el-table>
              <el-empty v-else description="暂无审计日志" />
            </div>
            </div>
          </div>
        </div>

        <div v-else-if="appData.app_type === 'flash'" class="flash-runtime">
          <el-alert
            title="当前展示为已发布快照（与草稿隔离）"
            type="info"
            show-icon
            class="flash-alert"
          />
          <iframe
            v-if="flashPublishedSrcdoc"
            :srcdoc="flashPublishedSrcdoc"
            class="flash-preview"
            sandbox="allow-scripts allow-same-origin allow-forms"
          ></iframe>
          <el-empty v-else description="暂无已发布快照，请在闪念构建器中完成“校验并发布”" />
        </div>

        <el-empty v-else description="暂不支持的应用类型" />
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import axios from 'axios'
import NavigatedViewer from 'bpmn-js/lib/NavigatedViewer'
import AppCenterGrid from '@/components/AppCenterGrid.vue'
import { hasPerm } from '@/utils/permission'
import { resolveAppAclModule } from '@/utils/app-permissions'

import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css'

const route = useRoute()
const router = useRouter()

const routeAppId = computed(() => (route.params.appId ? String(route.params.appId) : ''))
const resolvedAppId = ref('')
const runtimeAppId = computed(() => resolvedAppId.value || routeAppId.value || '')
const appData = ref(null)
const loading = ref(false)
const parseJsonObject = (value) => {
  if (!value) return null
  if (typeof value === 'object') return value
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}
const flashPublishedSrcdoc = computed(() => {
  const source = parseJsonObject(appData.value?.source_code)
  if (!source || typeof source !== 'object') return ''
  const flash = source.flash
  if (!flash || typeof flash !== 'object') return ''
  const html = String(flash.published_html || '').trim()
  if (!html) return ''
  if (html.toLowerCase().includes('<html')) return html
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head><body>${html}</body></html>`
})

const stateMappings = ref([])
const taskAssignments = ref([])
const workflowDefinitionId = ref(null)
const workflowInstances = ref([])
const workflowStarterMap = ref({})
const workflowEvents = ref([])
const newBusinessKey = ref('')
const instanceLoading = ref(false)
const instanceStarting = ref(false)
const instanceTransitioningId = ref(null)
const nextTaskSelections = reactive({})
const currentActor = ref({ username: '', appRole: '' })
const workflowViewTab = ref('employee')
const bpmnCanvasRef = ref(null)
const workflowSideCollapsed = ref(false)
const workflowSideWidth = ref(520)
const WORKFLOW_SIDE_ANIM_MS = 260
let bpmnViewer = null
let sideResizeMoveHandler = null
let sideResizeUpHandler = null

const canUseAdminView = computed(() => currentActor.value.appRole === 'super_admin' || hasPerm('module:app'))
const canUseDeveloperView = computed(() => currentActor.value.appRole === 'super_admin')
const workflowTabOptions = computed(() => {
  const tabs = [{ name: 'employee', label: '员工页' }]
  if (canUseAdminView.value) tabs.push({ name: 'admin', label: '管理员页' })
  if (canUseDeveloperView.value) tabs.push({ name: 'developer', label: '配置页' })
  return tabs
})
const employeeInstances = computed(() => workflowInstances.value.filter((item) => {
  const status = String(item?.status || '').toUpperCase()
  return status !== 'COMPLETED' && canExecuteTask(item?.current_task_id)
}))
const workflowSideStyle = computed(() => ({
  width: workflowSideCollapsed.value ? '0px' : `${workflowSideWidth.value}px`
}))

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

const parseDefinitionId = (value) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeBpmnXml = (raw) => {
  const text = String(raw || '')
  if (!text) return ''
  return text
    .replace(/^\uFEFF/, '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\r/g, '\r')
}

const normalizeStringList = (value) => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
}

const builtinTaskNameMap = Object.freeze({
  Task_Submit: '提交入职资料',
  Task_HRReview: 'HR初审',
  Task_ManagerReview: '部门确认',
  Task_AccountProvision: '开通账号与建档',
  StartEvent_1: '开始',
  EndEvent_1: '结束'
})

const statusLabelMap = Object.freeze({
  ACTIVE: '进行中',
  COMPLETED: '已完成',
  SUSPENDED: '已挂起',
  FAILED: '失败'
})

const eventLabelMap = Object.freeze({
  INSTANCE_STARTED: '实例已发起',
  TASK_TRANSITION: '任务已流转',
  INSTANCE_COMPLETED: '实例已完成'
})

const parseBpmnTaskNameMap = (xmlRaw) => {
  const xml = normalizeBpmnXml(xmlRaw)
  const map = { ...builtinTaskNameMap }
  if (!xml) return map

  const regex = /<bpmn:(?:startEvent|endEvent|userTask|task|serviceTask|manualTask|scriptTask|receiveTask|sendTask|callActivity|exclusiveGateway|parallelGateway|inclusiveGateway)\b[^>]*>/gi
  let match = regex.exec(xml)
  while (match) {
    const tag = String(match[0] || '')
    const idMatch = tag.match(/\bid="([^"]+)"/i)
    const nameMatch = tag.match(/\bname="([^"]+)"/i)
    const id = String(idMatch?.[1] || '').trim()
    const name = String(nameMatch?.[1] || '').trim()
    if (id && name) map[id] = name
    match = regex.exec(xml)
  }
  return map
}

const taskNameMap = computed(() => parseBpmnTaskNameMap(appData.value?.bpmn_xml || ''))

const formatTaskName = (taskId) => {
  const key = String(taskId || '').trim()
  if (!key) return '-'
  return taskNameMap.value[key] || key
}

const formatInstanceStatus = (status) => {
  const key = String(status || '').trim().toUpperCase()
  return statusLabelMap[key] || (key || '-')
}

const formatEventType = (eventType) => {
  const key = String(eventType || '').trim().toUpperCase()
  return eventLabelMap[key] || (key || '-')
}

const formatStarter = (instanceId) => {
  const key = String(instanceId || '').trim()
  if (!key) return '-'
  return workflowStarterMap.value[key] || '-'
}

const normalizeWorkflowTab = () => {
  const availableTabs = workflowTabOptions.value.map((item) => item.name)
  if (!availableTabs.includes(workflowViewTab.value)) {
    workflowViewTab.value = availableTabs[0] || 'employee'
  }
}

const setDefaultWorkflowTab = () => {
  workflowViewTab.value = canUseAdminView.value ? 'admin' : 'employee'
  normalizeWorkflowTab()
}

const readCurrentActor = () => {
  try {
    const raw = localStorage.getItem('user_info')
    const info = raw ? JSON.parse(raw) : {}
    currentActor.value = {
      username: String(info?.username || '').trim(),
      appRole: String(info?.app_role || info?.appRole || info?.role || '').trim()
    }
  } catch {
    currentActor.value = { username: '', appRole: '' }
  }
  setDefaultWorkflowTab()
}

const resolveFirstUserTaskId = (xml = '') => {
  const text = normalizeBpmnXml(xml)
  if (!text) return ''
  const userTask = text.match(/<bpmn:userTask\b[^>]*\bid="([^"]+)"/i)
  if (userTask?.[1]) return userTask[1]
  const startEvent = text.match(/<bpmn:startEvent\b[^>]*\bid="([^"]+)"/i)
  return startEvent?.[1] || ''
}

const unwrapSingleRow = (data) => {
  if (Array.isArray(data)) return data[0] || null
  return data && typeof data === 'object' ? data : null
}

const getApiError = (error) => ({
  status: error?.response?.status,
  code: error?.response?.data?.code || '',
  message: error?.response?.data?.message || error?.message || '未知错误'
})

const isRlsDenied = (error) => {
  const { status, code } = getApiError(error)
  return status === 403 && code === '42501'
}

const formatWorkflowError = (fallback, error, rlsMessage = '') => {
  const { message } = getApiError(error)
  if (isRlsDenied(error)) {
    const msg = String(message || '').trim()
    const passthroughKeywords = [
      '只有具备流程发起权限',
      '缺少流程推进权限',
      '缺少状态迁移权限',
      '任务未分配',
      'workflow start permission required',
      'workflow transition permission required',
      'status transition permission required',
      'current task is not assigned to current actor'
    ]
    if (msg && passthroughKeywords.some((keyword) => msg.includes(keyword))) {
      return msg
    }
    return rlsMessage || `${fallback}（当前账号无权限）`
  }
  return `${fallback}：${message}`
}

const formatArrayCell = (value) => {
  const list = normalizeStringList(value)
  return list.length ? list.join(', ') : '-'
}

const clampWorkflowSideWidth = (value) => {
  const min = 360
  const max = 760
  return Math.min(max, Math.max(min, value))
}

const refreshBpmnCanvas = () => {
  if (!bpmnViewer) return
  try {
    bpmnViewer.get('canvas').resized()
  } catch {
    // ignore
  }
}

const fitBpmnViewport = () => {
  if (!bpmnViewer) return
  try {
    bpmnViewer.get('canvas').zoom('fit-viewport', 'auto')
  } catch {
    // ignore
  }
}

const cleanupWorkflowSideResize = () => {
  if (typeof window === 'undefined') return
  if (sideResizeMoveHandler) {
    window.removeEventListener('mousemove', sideResizeMoveHandler)
    sideResizeMoveHandler = null
  }
  if (sideResizeUpHandler) {
    window.removeEventListener('mouseup', sideResizeUpHandler)
    sideResizeUpHandler = null
  }
}

const startWorkflowSideResize = (event) => {
  if (workflowSideCollapsed.value || typeof window === 'undefined') return
  event.preventDefault()

  const startX = event.clientX
  const startWidth = workflowSideWidth.value

  cleanupWorkflowSideResize()

  sideResizeMoveHandler = (moveEvent) => {
    const delta = startX - moveEvent.clientX
    workflowSideWidth.value = clampWorkflowSideWidth(startWidth + delta)
    refreshBpmnCanvas()
  }

  sideResizeUpHandler = () => {
    cleanupWorkflowSideResize()
    refreshBpmnCanvas()
  }

  window.addEventListener('mousemove', sideResizeMoveHandler)
  window.addEventListener('mouseup', sideResizeUpHandler)
}

const toggleWorkflowSide = () => {
  cleanupWorkflowSideResize()
  workflowSideCollapsed.value = !workflowSideCollapsed.value
  if (!workflowSideCollapsed.value) {
    workflowSideWidth.value = clampWorkflowSideWidth(workflowSideWidth.value)
  }
  refreshBpmnCanvas()
  setTimeout(() => {
    refreshBpmnCanvas()
  }, WORKFLOW_SIDE_ANIM_MS + 30)
}

async function resolveAppIdByRoutePath(token) {
  try {
    const currentPath = typeof window !== 'undefined' ? window.location.pathname : ''
    if (!currentPath) return ''
    const response = await axios.get(
      `/api/published_routes?route_path=eq.${encodeURIComponent(currentPath)}&is_active=eq.true&order=id.desc&limit=1`,
      { headers: getAppCenterHeaders(token) }
    )
    const row = Array.isArray(response.data) ? response.data[0] : null
    return row?.app_id ? String(row.app_id) : ''
  } catch {
    return ''
  }
}

onMounted(async () => {
  readCurrentActor()
  await loadAppData()
  await loadRuntimeData()
})

onUnmounted(() => {
  cleanupWorkflowSideResize()
  if (bpmnViewer) {
    bpmnViewer.destroy()
    bpmnViewer = null
  }
})

async function loadAppData() {
  loading.value = true
  try {
    const token = localStorage.getItem('auth_token')
    let targetAppId = routeAppId.value
    const routeResolvedAppId = await resolveAppIdByRoutePath(token)
    if (routeResolvedAppId) targetAppId = routeResolvedAppId
    if (!targetAppId) return
    resolvedAppId.value = targetAppId

    const response = await axios.get(`/api/apps?id=eq.${targetAppId}`, {
      headers: getAppCenterHeaders(token)
    })
    appData.value = response.data?.[0] || null
    const moduleKey = resolveAppAclModule(appData.value, appData.value?.config, targetAppId)
    if (moduleKey && !hasPerm(`app:${moduleKey}`)) {
      ElMessage.warning('暂无权限访问该应用')
      router.push('/')
      return
    }
  } catch {
    ElMessage.error('加载应用数据失败')
  } finally {
    loading.value = false
  }
}

async function loadRuntimeData() {
  if (!appData.value) return
  if (appData.value.app_type === 'workflow') {
    await initializeBpmnViewer()
    await loadStateMappings()
    await ensureWorkflowDefinitionId()
    await refreshWorkflowData()
  }
}

async function refreshWorkflowData() {
  await loadTaskAssignments()
  await loadWorkflowInstances()
  await loadWorkflowEvents()
}

async function initializeBpmnViewer() {
  if (!bpmnCanvasRef.value) return
  if (bpmnViewer) {
    bpmnViewer.destroy()
    bpmnViewer = null
  }
  bpmnViewer = new NavigatedViewer({ container: bpmnCanvasRef.value })
  const xml = normalizeBpmnXml(appData.value?.bpmn_xml)
  if (!xml) return
  try {
    await bpmnViewer.importXML(xml)
    fitBpmnViewport()
  } catch (error) {
    console.error(error)
    ElMessage.error('流程加载失败')
  }
}

async function loadStateMappings() {
  if (!runtimeAppId.value) return
  try {
    const token = localStorage.getItem('auth_token')
    const response = await axios.get(
      `/api/workflow_state_mappings?workflow_app_id=eq.${runtimeAppId.value}`,
      {
        headers: getAppCenterHeaders(token)
      }
    )
    stateMappings.value = Array.isArray(response.data) ? response.data : []
  } catch {
    ElMessage.error('加载状态映射失败')
  }
}

async function ensureWorkflowDefinitionId() {
  if (!runtimeAppId.value) return null
  const existing = parseDefinitionId(appData.value?.config?.workflowDefinitionId)
  if (existing) {
    workflowDefinitionId.value = existing
    return existing
  }

  try {
    const token = localStorage.getItem('auth_token')
    const response = await axios.get(
      `/api/definitions?app_id=eq.${runtimeAppId.value}&order=id.desc&limit=1`,
      { headers: getWorkflowHeaders(token) }
    )
    const row = Array.isArray(response.data) ? response.data[0] : null
    const resolvedId = parseDefinitionId(row?.id)
    workflowDefinitionId.value = resolvedId
    if (resolvedId) {
      if (!appData.value.config || typeof appData.value.config !== 'object') appData.value.config = {}
      appData.value.config.workflowDefinitionId = resolvedId
    }
    return resolvedId
  } catch {
    workflowDefinitionId.value = null
    return null
  }
}

async function loadTaskAssignments() {
  if (!workflowDefinitionId.value) {
    taskAssignments.value = []
    return
  }
  try {
    const token = localStorage.getItem('auth_token')
    const response = await axios.get(
      `/api/task_assignments?definition_id=eq.${workflowDefinitionId.value}&order=id.asc`,
      { headers: getWorkflowHeaders(token) }
    )
    taskAssignments.value = Array.isArray(response.data) ? response.data : []
  } catch {
    taskAssignments.value = []
  }
}

function canExecuteTask(taskId) {
  const task = String(taskId || '').trim()
  if (!task) return false

  const role = currentActor.value.appRole
  const username = currentActor.value.username
  if (role === 'super_admin') return true

  const related = taskAssignments.value.filter((item) => String(item?.task_id || '').trim() === task)
  if (!related.length) return true

  return related.some((item) => {
    const roles = normalizeStringList(item?.candidate_roles)
    const users = normalizeStringList(item?.candidate_users)
    const roleOk = !roles.length || (role && roles.includes(role))
    const userOk = !users.length || (username && users.includes(username))
    return roleOk && userOk
  })
}

function getTransitionOptions(row) {
  const currentTask = String(row?.current_task_id || '')
  const set = new Set()

  stateMappings.value
    .map((item) => item?.bpmn_task_id)
    .filter(Boolean)
    .forEach((taskId) => {
      if (String(taskId) !== currentTask) set.add(String(taskId))
    })

  taskAssignments.value
    .map((item) => item?.task_id)
    .filter(Boolean)
    .forEach((taskId) => {
      if (String(taskId) !== currentTask) set.add(String(taskId))
    })

  return Array.from(set).map((id) => ({ value: id, label: formatTaskName(id) }))
}

async function loadWorkflowInstances() {
  if (!workflowDefinitionId.value) {
    workflowInstances.value = []
    workflowStarterMap.value = {}
    return
  }
  instanceLoading.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const response = await axios.get(
      `/api/instances?definition_id=eq.${workflowDefinitionId.value}&order=started_at.desc`,
      { headers: getWorkflowHeaders(token) }
    )
    const rows = Array.isArray(response.data) ? response.data : []
    workflowInstances.value = rows

    const instanceIds = rows
      .map((item) => Number(item?.id))
      .filter((id) => Number.isFinite(id) && id > 0)
    if (!instanceIds.length) {
      workflowStarterMap.value = {}
      return
    }

    const starterResponse = await axios.get(
      `/api/instance_events?instance_id=in.(${instanceIds.join(',')})&event_type=eq.INSTANCE_STARTED&order=created_at.desc`,
      { headers: getWorkflowHeaders(token) }
    )
    const starterRows = Array.isArray(starterResponse.data) ? starterResponse.data : []
    const starterMap = {}
    starterRows.forEach((item) => {
      const key = String(item?.instance_id || '').trim()
      if (!key || starterMap[key]) return
      const actor = String(item?.actor_username || '').trim()
      starterMap[key] = actor || '-'
    })
    workflowStarterMap.value = starterMap
  } catch {
    workflowStarterMap.value = {}
    ElMessage.error('加载流程实例失败')
  } finally {
    instanceLoading.value = false
  }
}

async function loadWorkflowEvents() {
  if (!workflowDefinitionId.value) {
    workflowEvents.value = []
    return
  }
  try {
    const token = localStorage.getItem('auth_token')
    const response = await axios.get(
      `/api/instance_events?definition_id=eq.${workflowDefinitionId.value}&order=created_at.desc&limit=40`,
      { headers: getWorkflowHeaders(token) }
    )
    workflowEvents.value = Array.isArray(response.data) ? response.data : []
  } catch {
    workflowEvents.value = []
  }
}

async function startWorkflowInstance() {
  const definitionId = workflowDefinitionId.value || await ensureWorkflowDefinitionId()
  if (!definitionId) {
    ElMessage.warning('未找到流程定义，请先在设计器点击“导出并保存”')
    return
  }

  instanceStarting.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const initialTaskId = taskAssignments.value[0]?.task_id
      || stateMappings.value[0]?.bpmn_task_id
      || resolveFirstUserTaskId(appData.value?.bpmn_xml)

    const response = await axios.post(
      '/api/rpc/start_workflow_instance',
      {
        p_definition_id: definitionId,
        p_business_key: newBusinessKey.value || null,
        p_initial_task_id: initialTaskId || null,
        p_variables: {}
      },
      {
        headers: {
          ...getWorkflowHeaders(token),
          'Content-Type': 'application/json'
        }
      }
    )

    const created = unwrapSingleRow(response.data)
    if (!created?.id) {
      throw new Error('流程实例创建失败')
    }

    newBusinessKey.value = ''
    ElMessage.success('流程实例已启动')
    await refreshWorkflowData()
  } catch (error) {
    ElMessage.error(formatWorkflowError('启动流程实例失败', error, '当前账号无权限启动流程实例'))
  } finally {
    instanceStarting.value = false
  }
}

async function transitionWorkflowInstance(row) {
  if (!row?.id) return
  const next = nextTaskSelections[row.id]
  if (!next) {
    ElMessage.warning('请选择下一任务，或选择“标记完成”')
    return
  }

  instanceTransitioningId.value = row.id
  try {
    const token = localStorage.getItem('auth_token')
    const complete = next === '__complete__'

    await axios.post(
      '/api/rpc/transition_workflow_instance',
      {
        p_instance_id: Number(row.id),
        p_next_task_id: complete ? null : String(next),
        p_complete: complete,
        p_variables: null
      },
      {
        headers: {
          ...getWorkflowHeaders(token),
          'Content-Type': 'application/json'
        }
      }
    )

    delete nextTaskSelections[row.id]
    ElMessage.success(complete ? '流程实例已完成' : '流程实例已推进')
    await refreshWorkflowData()
  } catch (error) {
    ElMessage.error(formatWorkflowError('流程实例推进失败', error, '当前任务未分配给当前账号，无法执行'))
  } finally {
    instanceTransitioningId.value = null
  }
}

function openBuilder() {
  if (!appData.value) return
  const map = {
    workflow: '/workflow-designer/',
    data: '/data-app/',
    flash: '/flash-builder/',
    custom: '/flash-builder/'
  }
  const path = map[appData.value.app_type] || '/flash-builder/'
  router.push(path + appData.value.id)
}

function goBack() {
  router.push('/')
}
</script>

<style scoped>
.app-container {
  padding: 20px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
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

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.runtime-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}

.workflow-runtime {
  --side-ease: cubic-bezier(0.22, 1, 0.36, 1);
  display: flex;
  gap: 0;
  height: 100%;
  min-width: 0;
  transition: gap 0.3s var(--side-ease);
}

.workflow-main {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.workflow-canvas-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: #fff;
}

.canvas-tip {
  font-size: 12px;
  color: #909399;
}

.canvas-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.side-toggle-btn {
  border-radius: 6px;
  transition: background-color 0.25s var(--side-ease), color 0.25s var(--side-ease);
}

.side-toggle-btn:hover {
  background: var(--el-color-primary-light-9);
}

.workflow-side-fab {
  position: absolute;
  right: 14px;
  top: 50%;
  z-index: 8;
  transform: translateY(-50%);
  border-radius: 999px;
  box-shadow: 0 10px 28px rgba(16, 24, 40, 0.2);
  animation: workflow-side-fab-in 0.28s var(--side-ease);
}

.workflow-side-fab:hover {
  transform: translateY(calc(-50% - 1px));
  box-shadow: 0 14px 32px rgba(16, 24, 40, 0.24);
}

.bpmn-canvas {
  flex: 1;
  min-height: 0;
  background: #fff;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
}

.workflow-side-resizer {
  width: 8px;
  margin: 0 8px;
  border-radius: 999px;
  cursor: col-resize;
  background: transparent;
  transition:
    width 0.28s var(--side-ease),
    margin 0.28s var(--side-ease),
    opacity 0.2s ease,
    background-color 0.15s ease;
  opacity: 1;
}

.workflow-side-resizer:hover {
  background: var(--el-color-primary-light-7);
}

.workflow-side-resizer.is-hidden {
  width: 0;
  margin: 0;
  opacity: 0;
  pointer-events: none;
}

.workflow-side {
  flex: 0 0 auto;
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  border: 1px solid var(--el-border-color-light);
  overflow: hidden;
  min-width: 0;
  opacity: 1;
  transform: translateX(0);
  will-change: width, opacity, transform;
  transition:
    width 0.28s var(--side-ease),
    padding 0.28s var(--side-ease),
    border-color 0.25s ease,
    opacity 0.2s ease,
    transform 0.24s var(--side-ease);
}

.workflow-side-inner {
  height: 100%;
  overflow: auto;
  opacity: 1;
  transform: translateX(0);
  transition: opacity 0.16s ease, transform 0.24s var(--side-ease);
}

.workflow-side.is-collapsed {
  padding: 0;
  border-color: transparent;
  opacity: 0;
  transform: translateX(10px);
}

.workflow-side.is-collapsed .workflow-side-inner {
  opacity: 0;
  transform: translateX(8px);
  pointer-events: none;
}

@keyframes workflow-side-fab-in {
  from {
    opacity: 0;
    transform: translateY(-50%) translateX(10px) scale(0.94);
  }
  to {
    opacity: 1;
    transform: translateY(-50%) translateX(0) scale(1);
  }
}

.workflow-tabs {
  margin-bottom: 8px;
}

.workflow-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.workflow-tip {
  margin-bottom: 4px;
}

.instance-toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.instance-key-input {
  flex: 1;
}

.instance-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.next-task-select {
  min-width: 140px;
}

.flash-runtime {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.flash-alert {
  margin-bottom: 8px;
}

.flash-preview {
  flex: 1;
  width: 100%;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: #fff;
}

@media (max-width: 1200px) {
  .workflow-runtime {
    flex-direction: column;
    gap: 10px;
  }

  .workflow-canvas-toolbar {
    flex-wrap: wrap;
    gap: 8px;
  }

  .workflow-side-resizer {
    display: none;
  }

  .workflow-side {
    width: 100%;
    max-height: 48vh;
  }

  .workflow-side-fab {
    right: 10px;
    top: auto;
    bottom: 10px;
    transform: none;
  }

  .workflow-side-fab:hover {
    transform: translateY(-1px);
  }

  .workflow-side.is-collapsed {
    width: 0;
    max-height: 0;
    border-width: 0;
  }
}
</style>
