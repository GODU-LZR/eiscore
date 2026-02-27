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
            <div class="workflow-side-overview">
              <div
                v-for="item in workflowSideOverview"
                :key="item.key"
                class="workflow-side-overview-item"
              >
                <el-icon class="overview-icon">
                  <component :is="item.icon" />
                </el-icon>
                <div class="overview-meta">
                  <strong>{{ item.value }}</strong>
                  <span>{{ item.label }}</span>
                </div>
              </div>
            </div>
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
                title="这里是你的待办区：发起流程、处理任务、提交下一步。"
                type="info"
                :closable="false"
                class="workflow-tip"
              />
              <div class="workflow-auto-hint">
                <el-tag size="small" type="success" v-if="workflowAutoAdvanceEnabled">自动推进已开启</el-tag>
                <el-tag size="small" v-else>自动推进未开启</el-tag>
                <span class="workflow-auto-text">{{ workflowBusinessAppName || '未绑定业务应用' }}</span>
              </div>
              <div class="instance-toolbar">
                <el-button type="primary" size="small" :loading="instanceStarting" @click="startWorkflowInstance">
                  <el-icon><CirclePlusFilled /></el-icon>
                  <span>发起流程</span>
                </el-button>
                <el-button size="small" :loading="instanceLoading" @click="refreshWorkflowData">
                  <el-icon><Refresh /></el-icon>
                  <span>刷新</span>
                </el-button>
              </div>
              <div v-if="employeeInstances.length" class="workflow-card-list">
                <article v-for="row in employeeInstances" :key="row.id" class="workflow-task-card">
                  <header class="task-card-head">
                    <strong class="task-card-title">流程单号：{{ row.id }}</strong>
                    <el-tag size="small" :type="canExecuteTask(row?.current_task_id) ? 'success' : 'warning'">
                      {{ canExecuteTask(row?.current_task_id) ? '可处理' : '待分配' }}
                    </el-tag>
                  </header>
                  <div class="task-card-meta">
                    <span class="task-card-meta-item">
                      <el-icon><User /></el-icon>
                      <em>发起人</em>
                      <strong>{{ formatStarter(row?.id) }}</strong>
                    </span>
                    <span class="task-card-meta-item">
                      <el-icon><List /></el-icon>
                      <em>当前步骤</em>
                      <strong>{{ formatTaskName(row?.current_task_id) }}</strong>
                    </span>
                    <span class="task-card-meta-item">
                      <el-icon><Document /></el-icon>
                      <em>业务单据号</em>
                      <el-tooltip
                        effect="dark"
                        placement="top"
                        :content="getBusinessDocNoRaw(row)"
                        :disabled="!getBusinessDocNoRaw(row)"
                      >
                        <strong
                          :class="{ 'doc-no-link': canOpenBoundBusinessRecord(row) }"
                          @click="canOpenBoundBusinessRecord(row) && openBoundBusinessRecord(row)"
                        >{{ getBusinessDocNoLabel(row) }}</strong>
                      </el-tooltip>
                    </span>
                  </div>
                  <div class="task-card-progress">
                    <span class="task-progress-item">
                      <em>业务状态</em>
                      <el-tag size="small" :type="getBusinessObservedTagType(row)" effect="plain">
                        {{ getBusinessObservedLabel(row) }}
                      </el-tag>
                    </span>
                    <span class="task-progress-item">
                      <em>目标状态</em>
                      <el-tag size="small" :type="getBusinessExpectedTagType(row)" effect="plain">
                        {{ getBusinessExpectedLabel(row) }}
                      </el-tag>
                    </span>
                    <span class="task-progress-item">
                      <em>完成判定</em>
                      <el-tag size="small" :type="getBusinessProgressTagType(row)">
                        {{ getBusinessProgressText(row) }}
                      </el-tag>
                    </span>
                    <span class="task-progress-time">{{ getBusinessProgressTime(row) }}</span>
                  </div>
                  <div class="instance-actions">
                    <el-button class="instance-open-btn" size="small" plain @click="openBusinessPageForInstance(row)">
                      <el-icon><Pointer /></el-icon>
                      <span>去业务处理</span>
                    </el-button>
                    <el-button class="instance-choose-btn" size="small" @click="openNextTaskPicker(row)">
                      <el-icon><List /></el-icon>
                      <span>{{ getSelectedNextTaskText(row) || '选择下一步' }}</span>
                    </el-button>
                    <el-button
                      class="instance-submit-btn"
                      type="primary"
                      size="small"
                      :loading="instanceTransitioningId === row.id"
                      @click="transitionWorkflowInstance(row)"
                    >
                      <el-icon><Promotion /></el-icon>
                      <span>提交</span>
                    </el-button>
                  </div>
                </article>
              </div>
              <el-empty v-else description="暂无可处理任务" />
            </div>

            <div v-else-if="workflowViewTab === 'admin'" class="workflow-panel">
              <el-divider content-position="left">流程单总览</el-divider>
              <div class="instance-toolbar">
                <el-button type="primary" size="small" :loading="instanceStarting" @click="startWorkflowInstance">
                  <el-icon><CirclePlusFilled /></el-icon>
                  <span>发起</span>
                </el-button>
                <el-button size="small" :loading="instanceLoading" @click="refreshWorkflowData">
                  <el-icon><Refresh /></el-icon>
                  <span>刷新</span>
                </el-button>
              </div>
              <div v-if="workflowInstances.length" class="workflow-card-list workflow-card-list-scroll">
                <article v-for="row in workflowInstances" :key="row.id" class="workflow-task-card admin">
                  <header class="task-card-head">
                    <strong class="task-card-title">流程单号：{{ row.id }}</strong>
                    <div class="task-card-head-tags">
                      <el-tag size="small" type="info">{{ formatInstanceStatus(row?.status) }}</el-tag>
                      <el-tag size="small" :type="canExecuteTask(row?.current_task_id) ? 'success' : 'warning'">
                        {{ canExecuteTask(row?.current_task_id) ? '可处理' : '不可处理' }}
                      </el-tag>
                    </div>
                  </header>
                  <div class="task-card-meta">
                    <span class="task-card-meta-item">
                      <el-icon><User /></el-icon>
                      <em>发起人</em>
                      <strong>{{ formatStarter(row?.id) }}</strong>
                    </span>
                    <span class="task-card-meta-item">
                      <el-icon><List /></el-icon>
                      <em>当前步骤</em>
                      <strong>{{ formatTaskName(row?.current_task_id) }}</strong>
                    </span>
                    <span class="task-card-meta-item">
                      <el-icon><Document /></el-icon>
                      <em>业务单据号</em>
                      <el-tooltip
                        effect="dark"
                        placement="top"
                        :content="getBusinessDocNoRaw(row)"
                        :disabled="!getBusinessDocNoRaw(row)"
                      >
                        <strong
                          :class="{ 'doc-no-link': canOpenBoundBusinessRecord(row) }"
                          @click="canOpenBoundBusinessRecord(row) && openBoundBusinessRecord(row)"
                        >{{ getBusinessDocNoLabel(row) }}</strong>
                      </el-tooltip>
                    </span>
                  </div>
                  <div class="task-card-progress">
                    <span class="task-progress-item">
                      <em>业务状态</em>
                      <el-tag size="small" :type="getBusinessObservedTagType(row)" effect="plain">
                        {{ getBusinessObservedLabel(row) }}
                      </el-tag>
                    </span>
                    <span class="task-progress-item">
                      <em>目标状态</em>
                      <el-tag size="small" :type="getBusinessExpectedTagType(row)" effect="plain">
                        {{ getBusinessExpectedLabel(row) }}
                      </el-tag>
                    </span>
                    <span class="task-progress-item">
                      <em>完成判定</em>
                      <el-tag size="small" :type="getBusinessProgressTagType(row)">
                        {{ getBusinessProgressText(row) }}
                      </el-tag>
                    </span>
                    <span class="task-progress-time">{{ getBusinessProgressTime(row) }}</span>
                  </div>
                  <div class="instance-actions">
                    <el-button class="instance-open-btn" size="small" plain @click="openBusinessPageForInstance(row)">
                      <el-icon><Pointer /></el-icon>
                      <span>去业务处理</span>
                    </el-button>
                    <el-button class="instance-choose-btn" size="small" @click="openNextTaskPicker(row)">
                      <el-icon><List /></el-icon>
                      <span>{{ getSelectedNextTaskText(row) || '选择下一步' }}</span>
                    </el-button>
                    <el-button
                      class="instance-submit-btn"
                      type="primary"
                      size="small"
                      :disabled="!canExecuteTask(row?.current_task_id)"
                      :loading="instanceTransitioningId === row.id"
                      @click="transitionWorkflowInstance(row)"
                    >
                      <el-icon><Promotion /></el-icon>
                      <span>推进</span>
                    </el-button>
                  </div>
                </article>
              </div>
              <el-empty v-else description="暂无流程单" />

              <el-divider content-position="left">操作记录</el-divider>
              <el-table v-if="workflowEvents.length" :data="workflowEvents" size="small" border>
                <el-table-column label="事件" min-width="130">
                  <template #default="{ row }">{{ formatEventType(row?.event_type) }}</template>
                </el-table-column>
                <el-table-column prop="instance_id" label="流程单号" min-width="82" />
                <el-table-column label="来源任务" min-width="110">
                  <template #default="{ row }">{{ formatTaskName(row?.from_task_id) }}</template>
                </el-table-column>
                <el-table-column label="目标任务" min-width="110">
                  <template #default="{ row }">{{ formatTaskName(row?.to_task_id) }}</template>
                </el-table-column>
                <el-table-column prop="actor_username" label="执行人" min-width="100" />
                <el-table-column label="时间" min-width="170">
                  <template #default="{ row }">{{ formatDateTime(row?.created_at) }}</template>
                </el-table-column>
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

              <el-divider content-position="left">操作记录</el-divider>
              <el-table v-if="workflowEvents.length" :data="workflowEvents" size="small" border>
                <el-table-column label="事件" min-width="130">
                  <template #default="{ row }">{{ formatEventType(row?.event_type) }}</template>
                </el-table-column>
                <el-table-column prop="instance_id" label="流程单号" min-width="82" />
                <el-table-column label="来源任务" min-width="110">
                  <template #default="{ row }">{{ formatTaskName(row?.from_task_id) }}</template>
                </el-table-column>
                <el-table-column label="目标任务" min-width="110">
                  <template #default="{ row }">{{ formatTaskName(row?.to_task_id) }}</template>
                </el-table-column>
                <el-table-column prop="actor_username" label="执行人" min-width="100" />
                <el-table-column label="时间" min-width="170">
                  <template #default="{ row }">{{ formatDateTime(row?.created_at) }}</template>
                </el-table-column>
              </el-table>
              <el-empty v-else description="暂无审计日志" />
            </div>
            </div>
          </div>
        </div>

        <el-dialog
          v-if="appData.app_type === 'workflow'"
          v-model="nextTaskPickerVisible"
          title="选择下一步"
          width="620px"
          append-to-body
          destroy-on-close
          class="next-task-picker-dialog"
        >
          <div class="next-task-picker-header">
            <div class="picker-title-row">
              <span class="picker-title-label">当前任务</span>
              <strong>{{ formatTaskName(nextTaskPickerRow?.current_task_id) }}</strong>
            </div>
            <div class="picker-title-row">
              <span class="picker-title-label">流程单号</span>
              <strong>{{ nextTaskPickerRow?.id || '-' }}</strong>
            </div>
          </div>
          <el-scrollbar max-height="360px">
            <div class="next-task-picker-list">
              <button
                v-for="opt in nextTaskPickerOptions"
                :key="opt.value"
                type="button"
                class="next-task-picker-item"
                :class="{ 'is-active': nextTaskPickerSelected === opt.value, 'is-disabled': opt.disabled === true }"
                :disabled="opt.disabled === true"
                @click="nextTaskPickerSelected = opt.value"
              >
                <div class="picker-item-main">
                  <el-icon class="picker-item-icon" :style="{ color: getWorkflowStateColor(opt.stateValue) }">
                    <component :is="getWorkflowStateIcon(opt.stateValue)" />
                  </el-icon>
                  <div class="picker-item-content">
                    <div class="picker-item-title">{{ opt.taskName }}</div>
                    <div class="picker-item-meta">
                      <el-tag size="small" effect="plain" :type="getWorkflowStateTagType(opt.stateValue)">
                        状态：{{ getWorkflowStateLabel(opt.stateValue) }}
                      </el-tag>
                      <el-tag size="small" effect="plain" type="info">
                        {{ opt.assignmentText }}
                      </el-tag>
                      <el-tag v-if="opt.disabled === true" size="small" effect="plain" type="warning">
                        你无权执行
                      </el-tag>
                    </div>
                  </div>
                </div>
              </button>
              <button
                type="button"
                class="next-task-picker-item complete-item"
                :class="{ 'is-active': nextTaskPickerSelected === '__complete__' }"
                @click="nextTaskPickerSelected = '__complete__'"
              >
                <div class="picker-item-main">
                  <el-icon class="picker-item-icon complete-icon">
                    <Lock />
                  </el-icon>
                  <div class="picker-item-content">
                    <div class="picker-item-title">结束当前流程单</div>
                    <div class="picker-item-meta">
                      <el-tag size="small" effect="plain" type="warning">直接结束，不再继续流转</el-tag>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </el-scrollbar>
          <template #footer>
            <el-button @click="closeNextTaskPicker">取消</el-button>
            <el-button type="primary" :disabled="!nextTaskPickerSelected" @click="applyNextTaskPicker">
              确认选择
            </el-button>
          </template>
        </el-dialog>

        <div v-else-if="appData.app_type === 'flash'" class="flash-runtime">
          <iframe
            v-if="flashRuntimeUrl"
            :src="flashRuntimeUrl"
            class="flash-preview"
            sandbox="allow-scripts allow-same-origin allow-forms"
          ></iframe>
          <iframe
            v-else-if="flashPublishedSrcdoc"
            :srcdoc="flashPublishedSrcdoc"
            class="flash-preview"
            sandbox="allow-scripts allow-same-origin allow-forms"
          ></iframe>
          <el-empty v-else description="暂无已发布快照，请在闪念构建器中完成“校验并发布”" />
          <el-alert
            v-if="flashRuntimeError"
            class="flash-runtime-alert"
            type="warning"
            :closable="false"
            :title="flashRuntimeError"
          />
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
import {
  CirclePlusFilled,
  CircleCheckFilled,
  Lock,
  User,
  List,
  Document,
  Refresh,
  Pointer,
  Promotion
} from '@element-plus/icons-vue'
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
const flashRuntimeReady = ref(false)
const flashRuntimeError = ref('')
const flashRuntimeNonce = ref(Date.now())
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

const sanitizeFlashPublishedHtml = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''

  const stripSourceMapMarkers = (text) => String(text || '')
    .replace(/\/\/#\s*sourceMappingURL=.*$/gim, '')
    .replace(/\/\*#\s*sourceMappingURL=[\s\S]*?\*\//gim, '')
    .trim()

  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(raw, 'text/html')
      const removableSelectors = [
        'script',
        'noscript',
        'link[rel="modulepreload"]',
        'link[rel="preload"][as="script"]'
      ]
      removableSelectors.forEach((selector) => {
        doc.querySelectorAll(selector).forEach((node) => node.remove())
      })
      const html = stripSourceMapMarkers(String(doc.documentElement?.outerHTML || ''))
      if (html) return `<!doctype html>\n${html}`
    } catch {
      // fallback to regexp cleanup
    }
  }

  return stripSourceMapMarkers(raw)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '')
    .replace(/<link\b[^>]*rel=["']modulepreload["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["']preload["'][^>]*as=["']script["'][^>]*>/gi, '')
    .trim()
}

const flashPublishedSrcdoc = computed(() => {
  const source = parseJsonObject(appData.value?.source_code)
  if (!source || typeof source !== 'object') return ''
  const flash = source.flash
  if (!flash || typeof flash !== 'object') return ''
  const html = sanitizeFlashPublishedHtml(flash.published_html || '')
  if (!html) return ''
  if (html.toLowerCase().includes('<html')) return html
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1.0" /></head><body>${html}</body></html>`
})

const flashRuntimeUrl = computed(() => {
  if (!flashRuntimeReady.value || !runtimeAppId.value) return ''
  return `/flash-preview/apps/preview/flash-draft?appId=${encodeURIComponent(runtimeAppId.value)}&_t=${flashRuntimeNonce.value}`
})

const extractFlashRuntimeDraftSource = (row) => {
  const source = parseJsonObject(row?.source_code)
  if (!source || typeof source !== 'object') return ''
  const flash = source.flash
  if (!flash || typeof flash !== 'object') return ''
  return normalizeDraftSourceText(flash.published_draft_source || flash.draft_source || '')
}

const prepareFlashRuntimeSource = async (row) => {
  flashRuntimeReady.value = false
  flashRuntimeError.value = ''
  if (!row || row.app_type !== 'flash') return

  const runtimeDraft = extractFlashRuntimeDraftSource(row)
  if (!runtimeDraft) return

  const token = getAuthToken()
  if (!token) {
    flashRuntimeError.value = '缺少登录态，已回退到发布快照'
    return
  }

  try {
    const response = await axios.post('/agent/flash/draft', {
      content: runtimeDraft,
      reason: `runtime_open:${row.id || runtimeAppId.value || 'unknown'}`
    }, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    if (response?.data?.ok !== true) {
      throw new Error(response?.data?.message || '草稿注入失败')
    }
    flashRuntimeNonce.value = Date.now()
    flashRuntimeReady.value = true
  } catch (error) {
    const message = String(error?.response?.data?.message || error?.message || '草稿注入失败')
    flashRuntimeError.value = `实时运行模式不可用，已回退到发布快照：${message}`
  }
}

const stateMappings = ref([])
const taskAssignments = ref([])
const workflowDefinitionId = ref(null)
const workflowInstances = ref([])
const workflowStarterMap = ref({})
const workflowEvents = ref([])
const workflowBusinessApps = ref([])
const instanceLoading = ref(false)
const instanceStarting = ref(false)
const instanceTransitioningId = ref(null)
const nextTaskSelections = reactive({})
const nextTaskPickerVisible = ref(false)
const nextTaskPickerRow = ref(null)
const nextTaskPickerOptions = ref([])
const nextTaskPickerSelected = ref('')
const workflowBusinessProgressMap = reactive({})
const currentActor = ref({ username: '', appRole: '' })
const workflowViewTab = ref('employee')
const bpmnCanvasRef = ref(null)
const workflowSideCollapsed = ref(false)
const workflowSideWidth = ref(620)
const WORKFLOW_SIDE_ANIM_MS = 260
let bpmnViewer = null
let sideResizeMoveHandler = null
let sideResizeUpHandler = null
let autoAdvanceTimer = null
const autoAdvancingInstanceIds = reactive({})

const WORKFLOW_STATUS_ORDER = Object.freeze(['created', 'active', 'locked'])
const WORKFLOW_STATE_LABEL_MAP = Object.freeze({
  created: '创建',
  active: '生效',
  locked: '锁定'
})
const WORKFLOW_STATE_UI_MAP = Object.freeze({
  created: { tagType: 'info', icon: CirclePlusFilled, color: '#909399' },
  active: { tagType: 'success', icon: CircleCheckFilled, color: '#67c23a' },
  locked: { tagType: 'danger', icon: Lock, color: '#f56c6c' }
})
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
const LEGACY_BINDING_LABEL_MAP = Object.freeze({
  'legacy:hr_employee': '人事花名册（HR）',
  'legacy:hr_user': '用户管理（HR）',
  'legacy:hr_attendance': '考勤管理（HR）',
  'legacy:hr_change': '调岗记录（HR）',
  'legacy:mms_ledger': '物料台账（MMS）',
  'legacy:mms_inventory_ledger': '库存台账（MMS）',
  'legacy:mms_inventory_stock_in': '入库（MMS）',
  'legacy:mms_inventory_stock_out': '出库（MMS）',
  'legacy:mms_inventory_current': '库存查询（MMS）'
})
const LEGACY_TABLE_BINDING_MAP = Object.freeze({
  'hr.archives': 'legacy:hr_employee',
  'hr.attendance_records': 'legacy:hr_attendance',
  'public.users': 'legacy:hr_user',
  'public.raw_materials': 'legacy:mms_ledger',
  'scm.inventory_transactions': 'legacy:mms_inventory_ledger',
  'scm.v_inventory_current': 'legacy:mms_inventory_current'
})
const LEGACY_BINDING_STATE_TARGET_MAP = Object.freeze({
  'legacy:hr_employee': { target_table: 'hr.archives', state_field: 'status' },
  'legacy:hr_user': { target_table: 'public.users', state_field: 'status' },
  'legacy:hr_attendance': { target_table: 'hr.attendance_records', state_field: 'status' },
  'legacy:hr_change': { target_table: 'hr.employee_changes', state_field: 'status' },
  'legacy:mms_ledger': { target_table: 'public.raw_materials', state_field: 'status' },
  'legacy:mms_inventory_stock_in': { target_table: 'scm.inventory_drafts', state_field: 'status' },
  'legacy:mms_inventory_stock_out': { target_table: 'scm.inventory_drafts', state_field: 'status' }
})

const canUseAdminView = computed(() => currentActor.value.appRole === 'super_admin' || hasPerm('module:app'))
const canUseDeveloperView = computed(() => currentActor.value.appRole === 'super_admin')
const workflowTabOptions = computed(() => {
  const tabs = [{ name: 'employee', label: '我的任务' }]
  if (canUseAdminView.value) tabs.push({ name: 'admin', label: '流程总览' })
  if (canUseDeveloperView.value) tabs.push({ name: 'developer', label: '流程配置' })
  return tabs
})
const employeeInstances = computed(() => workflowInstances.value.filter((item) => {
  const status = String(item?.status || '').toUpperCase()
  return status !== 'COMPLETED' && canExecuteTask(item?.current_task_id)
}))
const workflowSideOverview = computed(() => ([
  { key: 'todo', label: '我的待办', value: employeeInstances.value.length, icon: User },
  { key: 'instance', label: '流程单', value: workflowInstances.value.length, icon: List },
  { key: 'event', label: '操作记录', value: workflowEvents.value.length, icon: Document }
]))
const workflowSideStyle = computed(() => ({
  width: workflowSideCollapsed.value ? '0px' : `${workflowSideWidth.value}px`
}))
const workflowBusinessAppId = computed(() => {
  const cfg = appData.value?.config
  if (!cfg || typeof cfg !== 'object') return ''
  return String(cfg.workflowBusinessAppId || '').trim()
})
const workflowTaskBusinessAppBindings = computed(() => {
  const cfg = appData.value?.config
  if (!cfg || typeof cfg !== 'object') return {}
  const raw = cfg.workflowTaskBusinessAppBindings
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const next = {}
  Object.entries(raw).forEach(([taskId, binding]) => {
    const key = String(taskId || '').trim()
    const value = String(binding || '').trim()
    if (key && value) next[key] = value
  })
  return next
})
const workflowBusinessTableBinding = computed(() => {
  const raw = workflowBusinessAppId.value
  if (!raw.startsWith('table:')) return ''
  return String(raw.slice('table:'.length) || '').trim()
})
const workflowBusinessLegacyBinding = computed(() => {
  const raw = workflowBusinessAppId.value
  if (!raw.startsWith('legacy:')) return ''
  return raw
})
const workflowAutoAdvanceEnabled = computed(() => {
  const cfg = appData.value?.config
  if (!cfg || typeof cfg !== 'object') return false
  return cfg.workflowAutoAdvanceEnabled === true
})
const workflowAutoAdvanceRules = computed(() => {
  const cfg = appData.value?.config
  if (!cfg || typeof cfg !== 'object') return {}
  const rules = cfg.workflowAutoAdvanceRules
  return rules && typeof rules === 'object' ? rules : {}
})
const workflowBusinessAppName = computed(() => {
  const taskBindingCount = Object.keys(workflowTaskBusinessAppBindings.value || {}).length
  if (taskBindingCount > 0) {
    return `按任务绑定（${taskBindingCount} 个节点）`
  }
  if (workflowBusinessLegacyBinding.value) {
    return LEGACY_BINDING_LABEL_MAP[workflowBusinessLegacyBinding.value] || `业务应用：${workflowBusinessLegacyBinding.value}`
  }
  if (workflowBusinessTableBinding.value) {
    return `旧按表绑定：${workflowBusinessTableBinding.value}`
  }
  const targetId = workflowBusinessAppId.value
  if (!targetId) return ''
  const matched = workflowBusinessApps.value.find((item) => String(item?.id || '') === targetId)
  if (!matched) return '已绑定业务应用'
  const cfg = parseJsonObject(matched?.config) || {}
  const tableName = String(cfg.table || '').trim()
  return tableName ? `业务应用：${matched.name}（${tableName}）` : `业务应用：${matched.name}`
})

const resolveTaskBusinessBinding = (taskId) => {
  const key = String(taskId || '').trim()
  if (key && workflowTaskBusinessAppBindings.value[key]) {
    return String(workflowTaskBusinessAppBindings.value[key] || '').trim()
  }
  const globalBinding = workflowBusinessAppId.value
  if (
    globalBinding === 'legacy:mms_inventory_stock_in'
    || globalBinding === 'legacy:mms_inventory_stock_out'
  ) {
    const taskText = `${key} ${formatTaskName(key)}`.toLowerCase()
    if (/出库|outbound|stock[_-]?out/.test(taskText)) return 'legacy:mms_inventory_stock_out'
    if (/入库|inbound|stock[_-]?in/.test(taskText)) return 'legacy:mms_inventory_stock_in'
  }
  return globalBinding
}

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
  INSTANCE_STARTED: '流程单已发起',
  TASK_TRANSITION: '任务已流转',
  INSTANCE_COMPLETED: '流程单已完成'
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
    const name = decodeHtmlEntitiesDeep(String(nameMatch?.[1] || '').trim())
    if (id && name) map[id] = name
    match = regex.exec(xml)
  }
  return map
}

const decodeHtmlEntitiesOnce = (value) => {
  const text = String(value || '')
  if (!text) return ''
  const namedMap = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
  return text.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (full, token) => {
    if (!token) return full
    if (token[0] === '#') {
      const isHex = token[1] === 'x' || token[1] === 'X'
      const numText = isHex ? token.slice(2) : token.slice(1)
      const codePoint = parseInt(numText, isHex ? 16 : 10)
      if (!Number.isFinite(codePoint) || codePoint <= 0 || codePoint > 0x10ffff) return full
      try {
        return String.fromCodePoint(codePoint)
      } catch {
        return full
      }
    }
    return Object.prototype.hasOwnProperty.call(namedMap, token) ? namedMap[token] : full
  })
}

const decodeHtmlEntitiesDeep = (value) => {
  let text = String(value || '')
  if (!text) return ''
  for (let i = 0; i < 4; i += 1) {
    const next = decodeHtmlEntitiesOnce(text)
    if (next === text) break
    text = next
  }
  return text
}

const TASK_NODE_TYPE_SET = new Set([
  'bpmn:userTask',
  'bpmn:task',
  'bpmn:serviceTask',
  'bpmn:manualTask',
  'bpmn:scriptTask',
  'bpmn:receiveTask',
  'bpmn:sendTask',
  'bpmn:callActivity'
])

const PASSTHROUGH_NODE_TYPE_SET = new Set([
  'bpmn:startEvent',
  'bpmn:exclusiveGateway',
  'bpmn:parallelGateway',
  'bpmn:inclusiveGateway',
  'bpmn:intermediateThrowEvent',
  'bpmn:intermediateCatchEvent'
])

const parseBpmnGraph = (xmlRaw) => {
  const xml = normalizeBpmnXml(xmlRaw)
  const nodeTypeMap = {}
  const outgoingMap = {}
  if (!xml) return { nodeTypeMap, outgoingMap }

  const nodeRegex = /<bpmn:([a-zA-Z0-9]+)\b[^>]*\bid="([^"]+)"/g
  let nodeMatch = nodeRegex.exec(xml)
  while (nodeMatch) {
    const type = String(nodeMatch[1] || '').trim()
    const id = String(nodeMatch[2] || '').trim()
    if (type && id) {
      nodeTypeMap[id] = `bpmn:${type}`
    }
    nodeMatch = nodeRegex.exec(xml)
  }

  const flowTagRegex = /<bpmn:sequenceFlow\b[^>]*>/g
  let flowTagMatch = flowTagRegex.exec(xml)
  while (flowTagMatch) {
    const tag = String(flowTagMatch[0] || '')
    const sourceRef = String(tag.match(/\bsourceRef="([^"]+)"/i)?.[1] || '').trim()
    const targetRef = String(tag.match(/\btargetRef="([^"]+)"/i)?.[1] || '').trim()
    if (sourceRef && targetRef) {
      if (!Array.isArray(outgoingMap[sourceRef])) outgoingMap[sourceRef] = []
      outgoingMap[sourceRef].push(targetRef)
    }
    flowTagMatch = flowTagRegex.exec(xml)
  }

  return { nodeTypeMap, outgoingMap }
}

const taskNameMap = computed(() => parseBpmnTaskNameMap(appData.value?.bpmn_xml || ''))
const workflowGraph = computed(() => parseBpmnGraph(appData.value?.bpmn_xml || ''))

const formatTaskName = (taskId) => {
  const key = String(taskId || '').trim()
  if (!key) return '-'
  const mapped = taskNameMap.value[key] || key
  return decodeHtmlEntitiesDeep(mapped)
}

const pad2 = (value) => String(value).padStart(2, '0')
const formatDateTime = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return '-'
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return decodeHtmlEntitiesDeep(raw)
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
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

const parseSchemaTable = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return { schema: '', table: '' }
  if (raw.includes('.')) {
    const [schema, table] = raw.split('.', 2)
    return { schema: String(schema || '').trim(), table: String(table || '').trim() }
  }
  return { schema: 'public', table: raw }
}

const normalizeStateValue = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return ''
  const normalized = WORKFLOW_STATE_CANONICAL_MAP[raw.toLowerCase()] || WORKFLOW_STATE_CANONICAL_MAP[raw]
  return normalized || raw
}
const getWorkflowStateLevel = (value) => WORKFLOW_STATUS_ORDER.indexOf(normalizeStateValue(value))
const getWorkflowStateLabel = (value) => {
  const normalized = normalizeStateValue(value)
  if (!normalized) return '未配置'
  return WORKFLOW_STATE_LABEL_MAP[normalized] || normalized
}
const getWorkflowStateTagType = (value) => {
  const normalized = normalizeStateValue(value)
  return WORKFLOW_STATE_UI_MAP[normalized]?.tagType || 'info'
}
const getWorkflowStateIcon = (value) => {
  const normalized = normalizeStateValue(value)
  return WORKFLOW_STATE_UI_MAP[normalized]?.icon || CirclePlusFilled
}
const getWorkflowStateColor = (value) => {
  const normalized = normalizeStateValue(value)
  return WORKFLOW_STATE_UI_MAP[normalized]?.color || '#909399'
}
const isStateReached = (observed, expected) => {
  const observedValue = normalizeStateValue(observed)
  const expectedValue = normalizeStateValue(expected)
  if (!observedValue || !expectedValue) return false
  if (observedValue === expectedValue) return true
  const observedLevel = getWorkflowStateLevel(observedValue)
  const expectedLevel = getWorkflowStateLevel(expectedValue)
  if (observedLevel < 0 || expectedLevel < 0) return false
  return observedLevel >= expectedLevel
}

const getTaskAutoRule = (taskId) => {
  const key = String(taskId || '').trim()
  if (!key) return { enabled: true, triggerState: '' }
  const ruleRaw = workflowAutoAdvanceRules.value?.[key]
  if (!ruleRaw || typeof ruleRaw !== 'object') {
    return { enabled: true, triggerState: '' }
  }
  return {
    enabled: ruleRaw.enabled !== false,
    triggerState: normalizeStateValue(ruleRaw.trigger_state)
  }
}

const getBusinessProgressKey = (row) => String(row?.id || '').trim()

const setBusinessProgress = (instanceId, payload = {}) => {
  const key = String(instanceId || '').trim()
  if (!key) return
  const prev = workflowBusinessProgressMap[key] || {}
  workflowBusinessProgressMap[key] = {
    loading: false,
    observedState: '',
    expectedState: '',
    done: false,
    boundDocNo: '',
    boundRecordId: '',
    boundDraftType: '',
    noMapping: false,
    noBinding: false,
    error: '',
    checkedAt: '',
    ...prev,
    ...payload
  }
}

const removeBusinessProgressByRows = (rows = []) => {
  const keep = new Set(rows.map((item) => String(item?.id || '').trim()).filter(Boolean))
  Object.keys(workflowBusinessProgressMap).forEach((key) => {
    if (!keep.has(key)) delete workflowBusinessProgressMap[key]
  })
}

const resolveExpectedStateForRow = (row, mapping) => {
  const taskId = String(row?.current_task_id || '').trim()
  const rule = getTaskAutoRule(taskId)
  const fromRule = normalizeStateValue(rule?.triggerState)
  if (fromRule) return fromRule
  return normalizeStateValue(mapping?.state_value)
}

const extractBusinessDocNo = (rowData) => {
  if (!rowData || typeof rowData !== 'object') return ''
  const candidates = [
    rowData.business_doc_no,
    rowData.doc_no,
    rowData.bill_no,
    rowData.order_no,
    rowData.transaction_no,
    rowData.business_key,
    rowData.code,
    rowData.id
  ]
  for (const item of candidates) {
    const text = String(item || '').trim()
    if (text) return text
  }
  const props = rowData.properties && typeof rowData.properties === 'object' ? rowData.properties : {}
  const fromProps = String(props.workflow_business_key || '').trim()
  if (fromProps) return fromProps
  return ''
}

const fetchBusinessRecordFromRow = async (row, mapping) => {
  const businessKey = String(row?.business_key || '').trim()
  const instanceId = String(row?.id || '').trim()
  const tableRef = String(mapping?.target_table || '').trim()
  if (!tableRef) return null
  if (!businessKey && !instanceId) return null
  const { schema, table } = parseSchemaTable(tableRef)
  if (!schema || !table) return null

  const token = getAuthToken()
  const headers = {
    Authorization: `Bearer ${token}`,
    'Accept-Profile': schema,
    'Content-Profile': schema
  }
  const selectPart = encodeURIComponent('*')
  const isInventoryDrafts = schema === 'scm' && table === 'inventory_drafts'
  const taskBinding = resolveTaskBusinessBinding(String(row?.current_task_id || '').trim())
  const draftType = taskBinding === 'legacy:mms_inventory_stock_in'
    ? 'in'
    : (taskBinding === 'legacy:mms_inventory_stock_out' ? 'out' : '')

  const tryQuery = async (query) => {
    const conditions = [query]
    if (isInventoryDrafts && draftType) {
      conditions.push(`draft_type=eq.${encodeURIComponent(draftType)}`)
    }
    const where = conditions.filter(Boolean).join('&')
    try {
      const res = await axios.get(`/api/${table}?select=${selectPart}&${where}&order=updated_at.desc,id.desc&limit=1`, { headers })
      const rowData = Array.isArray(res.data) ? res.data[0] : null
      if (rowData) return rowData
    } catch {
      // ignore
    }
    return null
  }

  if (businessKey) {
    const byId = await tryQuery(`id=eq.${encodeURIComponent(businessKey)}`)
    if (byId) return byId
    const byBusinessKey = await tryQuery(`business_key=eq.${encodeURIComponent(businessKey)}`)
    if (byBusinessKey) return byBusinessKey
    const propKey = `${encodeURIComponent('properties->>workflow_business_key')}=eq.${encodeURIComponent(businessKey)}`
    const byPropKey = await tryQuery(propKey)
    if (byPropKey) return byPropKey
  }

  if (instanceId) {
    const propInstance = `${encodeURIComponent('properties->>workflow_instance_id')}=eq.${encodeURIComponent(instanceId)}`
    const byPropInstance = await tryQuery(propInstance)
    if (byPropInstance) return byPropInstance
    const byWorkflowInstance = await tryQuery(`workflow_instance_id=eq.${encodeURIComponent(instanceId)}`)
    if (byWorkflowInstance) return byWorkflowInstance
  }

  return null
}

const parseIsoTime = (value) => {
  const text = String(value || '').trim()
  if (!text) return 0
  const ts = Date.parse(text)
  return Number.isFinite(ts) ? ts : 0
}

const isAutoAdvanceSatisfied = ({
  row,
  mapping,
  taskRule,
  observedState,
  businessRow
}) => {
  const explicitTrigger = normalizeStateValue(taskRule?.triggerState)
  const mappedExpected = normalizeStateValue(mapping?.state_value)
  const expectedState = explicitTrigger || mappedExpected
  if (!expectedState) return false
  if (!isStateReached(observedState, expectedState)) return false
  // 显式规则优先：达标即推进
  if (explicitTrigger) return true

  // 兼容“生效即冻结”：
  // 当节点映射与上一节点状态可能相同（例如 active -> active）时，
  // 仅在业务单据更新时间不早于流程进入当前节点时间时，判定为完成。
  const businessUpdatedAt = parseIsoTime(businessRow?.updated_at || businessRow?.created_at)
  const instanceEnteredAt = parseIsoTime(row?.updated_at || row?.created_at)
  if (businessUpdatedAt > 0 && instanceEnteredAt > 0 && businessUpdatedAt < instanceEnteredAt) {
    return false
  }
  return true
}

const refreshBusinessProgressForInstance = async (row) => {
  const instanceId = getBusinessProgressKey(row)
  if (!instanceId) return
  const mapping = getCurrentTaskMapping(row?.current_task_id)
  const expectedState = resolveExpectedStateForRow(row, mapping)
  const businessKey = String(row?.business_key || '').trim()

  if (!mapping?.target_table || !mapping?.state_field) {
    setBusinessProgress(instanceId, {
      loading: false,
      noMapping: true,
      noBinding: false,
      observedState: '',
      expectedState,
      done: false,
      boundDocNo: '',
      boundRecordId: '',
      boundDraftType: '',
      error: '',
      checkedAt: new Date().toISOString()
    })
    return
  }
  if (!businessKey) {
    setBusinessProgress(instanceId, {
      loading: false,
      noMapping: false,
      noBinding: true,
      observedState: '',
      expectedState,
      done: false,
      boundDocNo: '',
      boundRecordId: '',
      boundDraftType: '',
      error: '',
      checkedAt: new Date().toISOString()
    })
    return
  }

  setBusinessProgress(instanceId, {
      loading: true,
      noMapping: false,
      noBinding: false,
      expectedState,
      boundDocNo: '',
      boundRecordId: '',
      boundDraftType: '',
      error: ''
    })

  try {
    const businessRow = await fetchBusinessRecordFromRow(row, mapping)
    if (!businessRow) {
      setBusinessProgress(instanceId, {
        loading: false,
        observedState: '',
        expectedState,
        done: false,
        boundDocNo: '',
        boundRecordId: '',
        boundDraftType: '',
        noBinding: true,
        error: '',
        checkedAt: new Date().toISOString()
      })
      return
    }
    const observedState = businessRow && Object.prototype.hasOwnProperty.call(businessRow, String(mapping?.state_field || '').trim())
      ? normalizeStateValue(businessRow[String(mapping?.state_field || '').trim()])
      : ''
    const boundDocNo = extractBusinessDocNo(businessRow)
    const done = expectedState
      ? isStateReached(observedState, expectedState)
      : Boolean(normalizeStateValue(observedState))
    setBusinessProgress(instanceId, {
      loading: false,
      observedState: normalizeStateValue(observedState),
      expectedState,
      done,
      boundDocNo,
      boundRecordId: String(businessRow?.id || '').trim(),
      boundDraftType: String(businessRow?.draft_type || '').trim(),
      noBinding: false,
      error: '',
      checkedAt: new Date().toISOString()
    })
  } catch {
    setBusinessProgress(instanceId, {
      loading: false,
      observedState: '',
      expectedState,
      done: false,
      boundDocNo: '',
      boundRecordId: '',
      boundDraftType: '',
      error: '检测失败',
      checkedAt: new Date().toISOString()
    })
  }
}

const refreshWorkflowBusinessProgress = async () => {
  const rows = Array.isArray(workflowInstances.value) ? workflowInstances.value : []
  removeBusinessProgressByRows(rows)
  if (!rows.length) return
  for (const row of rows) {
    // only track active/suspended records in runtime panel
    const status = String(row?.status || '').toUpperCase()
    if (status === 'COMPLETED') {
      const expectedState = resolveExpectedStateForRow(row, getCurrentTaskMapping(row?.current_task_id))
      setBusinessProgress(row?.id, {
        loading: false,
        observedState: '',
        expectedState,
        done: true,
        boundDocNo: '',
        boundRecordId: '',
        boundDraftType: '',
        noMapping: false,
        noBinding: false,
        error: '',
        checkedAt: new Date().toISOString()
      })
      continue
    }
    await refreshBusinessProgressForInstance(row)
  }
}

const getBusinessProgressInfo = (row) => {
  const key = getBusinessProgressKey(row)
  return workflowBusinessProgressMap[key] || {
    loading: false,
    observedState: '',
    expectedState: '',
    done: false,
    boundDocNo: '',
    boundRecordId: '',
    boundDraftType: '',
    noMapping: true,
    noBinding: false,
    error: '',
    checkedAt: ''
  }
}

const getBusinessDocNoLabel = (row) => {
  const info = getBusinessProgressInfo(row)
  if (info.loading) return '检测中'
  const docNo = String(info.boundDocNo || '').trim()
  return docNo || '未关联'
}

const getBusinessDocNoRaw = (row) => {
  const info = getBusinessProgressInfo(row)
  return String(info.boundDocNo || '').trim()
}

const canOpenBoundBusinessRecord = (row) => {
  const info = getBusinessProgressInfo(row)
  const rowId = String(info.boundRecordId || '').trim()
  return Boolean(rowId)
}

const getBusinessObservedLabel = (row) => {
  const info = getBusinessProgressInfo(row)
  if (info.loading) return '检测中'
  if (info.noMapping) return '未配置'
  if (info.noBinding) return '未关联单据'
  if (info.error) return '检测失败'
  return getWorkflowStateLabel(info.observedState)
}

const getBusinessObservedTagType = (row) => {
  const info = getBusinessProgressInfo(row)
  if (info.loading) return 'info'
  if (info.noMapping || info.noBinding) return 'warning'
  if (info.error) return 'danger'
  return getWorkflowStateTagType(info.observedState)
}

const getBusinessExpectedLabel = (row) => {
  const info = getBusinessProgressInfo(row)
  if (info.loading) return '检测中'
  if (!info.expectedState) return '未设置'
  return getWorkflowStateLabel(info.expectedState)
}

const getBusinessExpectedTagType = (row) => {
  const info = getBusinessProgressInfo(row)
  if (info.loading) return 'info'
  if (!info.expectedState) return 'warning'
  return getWorkflowStateTagType(info.expectedState)
}

const getBusinessProgressText = (row) => {
  const info = getBusinessProgressInfo(row)
  if (info.loading) return '状态检测中'
  if (info.noMapping) return '未配置映射'
  if (info.noBinding) return '未关联业务单据'
  if (info.error) return '检测失败'
  return info.done ? '已完成业务' : '未完成业务'
}

const getBusinessProgressTagType = (row) => {
  const info = getBusinessProgressInfo(row)
  if (info.loading) return 'info'
  if (info.noMapping || info.noBinding) return 'warning'
  if (info.error) return 'danger'
  return info.done ? 'success' : 'warning'
}

const getBusinessProgressTime = (row) => {
  const info = getBusinessProgressInfo(row)
  if (!info.checkedAt) return '未检测'
  const raw = formatDateTime(info.checkedAt)
  if (!raw || raw === '-') return '未检测'
  return `检测时间 ${raw}`
}

const getAuthToken = () => {
  const raw = localStorage.getItem('auth_token')
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.token) {
      return String(parsed.token).trim()
    }
  } catch {
    // ignore and fallback to plain text
  }
  return String(raw).trim()
}

const generateWorkflowBusinessKey = () => {
  const appPart = String(runtimeAppId.value || 'wf').replace(/[^a-zA-Z0-9]/g, '').slice(-8) || 'wf'
  const tsPart = Date.now().toString(36).toUpperCase()
  const randPart = Math.random().toString(36).slice(2, 8).toUpperCase()
  return `WK-${appPart}-${tsPart}-${randPart}`
}

const normalizeDraftSourceText = (value) => String(value || '').replace(/\r\n/g, '\n').trim()

const resolveBoundStateTarget = (taskId = '') => {
  const binding = resolveTaskBusinessBinding(taskId)
  if (binding.startsWith('legacy:')) {
    const legacy = LEGACY_BINDING_STATE_TARGET_MAP[binding]
    if (legacy?.target_table) {
      return {
        target_table: String(legacy.target_table),
        state_field: String(legacy.state_field || 'status')
      }
    }
  }
  if (binding.startsWith('table:')) {
    const table = String(binding.slice('table:'.length) || '').trim()
    if (table) return { target_table: table, state_field: 'status' }
  }
  if (binding) {
    const target = workflowBusinessApps.value.find((item) => String(item?.id || '') === binding)
    const cfg = parseJsonObject(target?.config) || {}
    const table = String(cfg.table || '').trim()
    if (table) return { target_table: table, state_field: 'status' }
  }
  return { target_table: '', state_field: '' }
}

const getCurrentTaskMapping = (taskId) => {
  const key = String(taskId || '').trim()
  if (!key) return null
  const base = stateMappings.value.find((item) => String(item?.bpmn_task_id || '').trim() === key) || null
  const bound = resolveBoundStateTarget(key)
  if (base) {
    return {
      ...base,
      target_table: String(base?.target_table || bound.target_table || '').trim(),
      state_field: String(base?.state_field || bound.state_field || 'status').trim()
    }
  }
  if (!bound.target_table) return null
  return {
    bpmn_task_id: key,
    target_table: bound.target_table,
    state_field: bound.state_field || 'status',
    state_value: ''
  }
}

const getTargetBusinessAppIdForTask = (taskId) => {
  const taskBinding = resolveTaskBusinessBinding(taskId)
  if (taskBinding) {
    if (taskBinding.startsWith('legacy:')) {
      return taskBinding
    }
    if (taskBinding.startsWith('table:')) {
      const table = String(taskBinding.slice('table:'.length) || '').trim()
      if (!table) return ''
      const legacyBinding = LEGACY_TABLE_BINDING_MAP[table]
      if (legacyBinding) return legacyBinding
      const matchedByTable = workflowBusinessApps.value.find((item) => {
        const cfg = parseJsonObject(item?.config) || {}
        return String(cfg.table || '').trim() === table
      })
      return matchedByTable?.id ? String(matchedByTable.id) : ''
    }
    return taskBinding
  }
  const mapping = getCurrentTaskMapping(taskId)
  const targetTable = String(mapping?.target_table || '').trim()
  if (!targetTable) return ''
  const legacyBinding = LEGACY_TABLE_BINDING_MAP[targetTable]
  if (legacyBinding) return legacyBinding
  const matched = workflowBusinessApps.value.find((item) => {
    const cfg = parseJsonObject(item?.config) || {}
    const table = String(cfg.table || '').trim()
    return table === targetTable
  })
  return matched?.id ? String(matched.id) : ''
}

const resolveNextTaskByStateLevel = (row, targetLevel) => {
  const currentTask = String(row?.current_task_id || '').trim()
  if (!currentTask || targetLevel < 0) return ''
  const options = getTransitionOptions(row).map((item) => String(item.value || '').trim())
  if (!options.length) return ''

  const preferred = stateMappings.value.find((item) => {
    const taskId = String(item?.bpmn_task_id || '').trim()
    if (!taskId || taskId === currentTask) return false
    if (!options.includes(taskId)) return false
    return getWorkflowStateLevel(item?.state_value) === targetLevel
  })
  if (preferred?.bpmn_task_id) return String(preferred.bpmn_task_id)
  return options[0]
}

const fetchBusinessStateFromRow = async (row, mapping) => {
  const businessKey = String(row?.business_key || '').trim()
  const instanceId = String(row?.id || '').trim()
  const fieldName = String(mapping?.state_field || '').trim()
  const tableRef = String(mapping?.target_table || '').trim()
  if (!fieldName || !tableRef) return ''
  if (!businessKey && !instanceId) return ''

  const { schema, table } = parseSchemaTable(tableRef)
  if (!schema || !table) return ''

  const token = getAuthToken()
  const headers = {
    Authorization: `Bearer ${token}`,
    'Accept-Profile': schema,
    'Content-Profile': schema
  }
  const selectPart = encodeURIComponent(fieldName)

  if (businessKey) {
    try {
      const byId = await axios.get(
        `/api/${table}?select=${selectPart}&id=eq.${encodeURIComponent(businessKey)}&limit=1`,
        { headers }
      )
      const rowData = Array.isArray(byId.data) ? byId.data[0] : null
      if (rowData && Object.prototype.hasOwnProperty.call(rowData, fieldName)) {
        return normalizeStateValue(rowData[fieldName])
      }
    } catch {
      // try business_key fallback
    }
  }

  if (businessKey) {
    try {
      const byBusinessKey = await axios.get(
        `/api/${table}?select=${selectPart}&business_key=eq.${encodeURIComponent(businessKey)}&limit=1`,
        { headers }
      )
      const rowData = Array.isArray(byBusinessKey.data) ? byBusinessKey.data[0] : null
      if (rowData && Object.prototype.hasOwnProperty.call(rowData, fieldName)) {
        return normalizeStateValue(rowData[fieldName])
      }
    } catch {
      // ignore
    }
  }

  if (businessKey) {
    try {
      const keyFilter = `${encodeURIComponent('properties->>workflow_business_key')}=eq.${encodeURIComponent(businessKey)}`
      const byPropertyKey = await axios.get(
        `/api/${table}?select=${selectPart}&${keyFilter}&limit=1`,
        { headers }
      )
      const rowData = Array.isArray(byPropertyKey.data) ? byPropertyKey.data[0] : null
      if (rowData && Object.prototype.hasOwnProperty.call(rowData, fieldName)) {
        return normalizeStateValue(rowData[fieldName])
      }
    } catch {
      // ignore
    }
  }

  if (instanceId) {
    try {
      const instanceFilter = `${encodeURIComponent('properties->>workflow_instance_id')}=eq.${encodeURIComponent(instanceId)}`
      const byPropertyInstance = await axios.get(
        `/api/${table}?select=${selectPart}&${instanceFilter}&limit=1`,
        { headers }
      )
      const rowData = Array.isArray(byPropertyInstance.data) ? byPropertyInstance.data[0] : null
      if (rowData && Object.prototype.hasOwnProperty.call(rowData, fieldName)) {
        return normalizeStateValue(rowData[fieldName])
      }
    } catch {
      // ignore
    }
  }

  if (instanceId) {
    try {
      const byWorkflowInstance = await axios.get(
        `/api/${table}?select=${selectPart}&workflow_instance_id=eq.${encodeURIComponent(instanceId)}&limit=1`,
        { headers }
      )
      const rowData = Array.isArray(byWorkflowInstance.data) ? byWorkflowInstance.data[0] : null
      if (rowData && Object.prototype.hasOwnProperty.call(rowData, fieldName)) {
        return normalizeStateValue(rowData[fieldName])
      }
    } catch {
      // ignore
    }
  }
  return ''
}

const markAutoAdvancing = (instanceId, running) => {
  const key = String(instanceId || '').trim()
  if (!key) return
  autoAdvancingInstanceIds[key] = Boolean(running)
}

const isAutoAdvancing = (instanceId) => {
  const key = String(instanceId || '').trim()
  if (!key) return false
  return autoAdvancingInstanceIds[key] === true
}

const transitionWorkflowByChoice = async (row, choice, options = {}) => {
  if (!row?.id) return false
  const { silent = false, auto = false } = options
  const next = String(choice || '').trim()
  if (!next) return false
  const complete = next === '__complete__'

  if (auto) markAutoAdvancing(row.id, true)
  instanceTransitioningId.value = row.id
  try {
    const token = localStorage.getItem('auth_token')
    await axios.post(
      '/api/rpc/transition_workflow_instance',
      {
        p_instance_id: Number(row.id),
        p_next_task_id: complete ? null : next,
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
    if (!silent) {
    ElMessage.success(complete ? '流程单已完成' : '流程单已推进')
    }
    await refreshWorkflowData()
    return true
  } catch (error) {
    if (!silent) {
    ElMessage.error(formatWorkflowError('流程单推进失败', error, '当前任务未分配给当前账号，无法执行'))
    }
    return false
  } finally {
    if (auto) markAutoAdvancing(row.id, false)
    instanceTransitioningId.value = null
  }
}

const autoAdvanceWorkflowInstances = async () => {
  if (!appData.value || appData.value.app_type !== 'workflow') return
  if (!workflowAutoAdvanceEnabled.value) return
  const activeRows = workflowInstances.value.filter((item) => String(item?.status || '').toUpperCase() === 'ACTIVE')
  if (!activeRows.length) return

  for (const row of activeRows) {
    const instanceId = String(row?.id || '').trim()
    if (!instanceId || isAutoAdvancing(instanceId)) continue
    if (instanceTransitioningId.value && Number(instanceTransitioningId.value) === Number(row?.id)) continue
    if (!canExecuteTask(row?.current_task_id)) continue

    const taskRule = getTaskAutoRule(row?.current_task_id)
    if (!taskRule.enabled) continue

    const mapping = getCurrentTaskMapping(row?.current_task_id)
    if (!mapping?.target_table || !mapping?.state_field) continue

    const businessRow = await fetchBusinessRecordFromRow(row, mapping)
    if (!businessRow) continue
    const observedState = businessRow && Object.prototype.hasOwnProperty.call(businessRow, String(mapping?.state_field || '').trim())
      ? normalizeStateValue(businessRow[String(mapping?.state_field || '').trim()])
      : ''
    if (!isAutoAdvanceSatisfied({ row, mapping, taskRule, observedState, businessRow })) continue

    const graphCandidates = resolveNextTaskCandidatesByGraph(String(row?.current_task_id || '').trim())
      .map((taskId) => String(taskId || '').trim())
      .filter(Boolean)
    if (graphCandidates.length > 0) {
      await transitionWorkflowByChoice(row, graphCandidates[0], { silent: true, auto: true })
      continue
    }

    const fallbackOptions = getTransitionOptions(row).map((item) => String(item?.value || '').trim()).filter(Boolean)
    if (fallbackOptions.length > 0) {
      const fallbackNextTask = fallbackOptions[0]
      if (fallbackNextTask) {
        await transitionWorkflowByChoice(row, fallbackNextTask, { silent: true, auto: true })
        continue
      }
    }

    // 没有可推进节点时自动完结
    if (!graphCandidates.length && !fallbackOptions.length) {
      await transitionWorkflowByChoice(row, '__complete__', { silent: true, auto: true })
    }
  }
}

const startWorkflowAutoAdvanceWatcher = () => {
  stopWorkflowAutoAdvanceWatcher()
  if (typeof window === 'undefined') return
  autoAdvanceTimer = window.setInterval(() => {
    autoAdvanceWorkflowInstances()
  }, 4500)
}

const stopWorkflowAutoAdvanceWatcher = () => {
  if (typeof window === 'undefined') return
  if (autoAdvanceTimer) {
    window.clearInterval(autoAdvanceTimer)
    autoAdvanceTimer = null
  }
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
  startWorkflowAutoAdvanceWatcher()
})

onUnmounted(() => {
  cleanupWorkflowSideResize()
  stopWorkflowAutoAdvanceWatcher()
  if (bpmnViewer) {
    bpmnViewer.destroy()
    bpmnViewer = null
  }
})

async function loadAppData() {
  loading.value = true
  flashRuntimeReady.value = false
  flashRuntimeError.value = ''
  try {
    const token = getAuthToken()
    let targetAppId = routeAppId.value
    const routeResolvedAppId = await resolveAppIdByRoutePath(token)
    if (routeResolvedAppId) targetAppId = routeResolvedAppId
    if (!targetAppId) return
    resolvedAppId.value = targetAppId

    const response = await axios.get(`/api/apps?id=eq.${targetAppId}`, {
      headers: getAppCenterHeaders(token)
    })
    appData.value = response.data?.[0] || null
    if (appData.value) {
      appData.value.config = parseJsonObject(appData.value.config) || {}
    }
    const moduleKey = resolveAppAclModule(appData.value, appData.value?.config, targetAppId)
    if (moduleKey && !hasPerm(`app:${moduleKey}`)) {
      ElMessage.warning('暂无权限访问该应用')
      router.push('/')
      return
    }
    await prepareFlashRuntimeSource(appData.value)
  } catch {
    ElMessage.error('加载应用数据失败')
  } finally {
    loading.value = false
  }
}

async function loadRuntimeData() {
  if (!appData.value) return
  if (appData.value.app_type === 'workflow') {
    await loadWorkflowBusinessApps()
    await initializeBpmnViewer()
    await loadStateMappings()
    await ensureWorkflowDefinitionId()
    await refreshWorkflowData()
  }
}

async function refreshWorkflowData() {
  await loadTaskAssignments()
  await loadWorkflowInstances()
  await refreshWorkflowBusinessProgress()
  await loadWorkflowEvents()
}

async function loadWorkflowBusinessApps() {
  try {
    const token = localStorage.getItem('auth_token')
    const response = await axios.get('/api/apps?app_type=eq.data&select=id,name,config,status&order=updated_at.desc', {
      headers: getAppCenterHeaders(token)
    })
    workflowBusinessApps.value = Array.isArray(response.data) ? response.data : []
  } catch {
    workflowBusinessApps.value = []
  }
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

function getTaskAssignmentSummary(taskId) {
  const task = String(taskId || '').trim()
  if (!task) return { unrestricted: true, roles: [], users: [] }

  const related = taskAssignments.value.filter((item) => String(item?.task_id || '').trim() === task)
  if (!related.length) return { unrestricted: true, roles: [], users: [] }

  const roleSet = new Set()
  const userSet = new Set()
  let unrestricted = false

  related.forEach((item) => {
    const roles = normalizeStringList(item?.candidate_roles)
    const users = normalizeStringList(item?.candidate_users)
    if (!roles.length && !users.length) {
      unrestricted = true
      return
    }
    roles.forEach((roleCode) => roleSet.add(roleCode))
    users.forEach((username) => userSet.add(username))
  })

  return {
    unrestricted,
    roles: Array.from(roleSet),
    users: Array.from(userSet)
  }
}

function formatTaskAssignmentHint(taskId) {
  const summary = getTaskAssignmentSummary(taskId)
  if (summary.unrestricted) return '分派:不限'

  const pieces = []
  if (summary.roles.length) {
    pieces.push(`角色:${summary.roles.join('/')}`)
  }
  if (summary.users.length) {
    pieces.push(`用户:${summary.users.join('/')}`)
  }
  return `分派:${pieces.join('，') || '不限'}`
}

function resolveNextTaskCandidatesByGraph(taskId) {
  const current = String(taskId || '').trim()
  if (!current) return []
  const graph = workflowGraph.value || {}
  const nodeTypeMap = graph.nodeTypeMap || {}
  const outgoingMap = graph.outgoingMap || {}
  const firstTargets = Array.isArray(outgoingMap[current]) ? outgoingMap[current] : []
  if (!firstTargets.length) return []

  const queue = [...firstTargets]
  const visited = new Set([current])
  const candidates = []
  let guard = 0
  const maxSteps = 300

  while (queue.length && guard < maxSteps) {
    guard += 1
    const nodeId = String(queue.shift() || '').trim()
    if (!nodeId || visited.has(nodeId)) continue
    visited.add(nodeId)

    const nodeType = String(nodeTypeMap[nodeId] || '').trim()
    if (TASK_NODE_TYPE_SET.has(nodeType)) {
      candidates.push(nodeId)
      continue
    }
    if (nodeType === 'bpmn:endEvent') continue
    if (!nodeType || PASSTHROUGH_NODE_TYPE_SET.has(nodeType)) {
      const nextTargets = Array.isArray(outgoingMap[nodeId]) ? outgoingMap[nodeId] : []
      nextTargets.forEach((nextId) => queue.push(nextId))
    }
  }

  return Array.from(new Set(candidates))
}

function getTransitionOptions(row) {
  const currentTask = String(row?.current_task_id || '')
  const set = new Set()

  const graphCandidates = resolveNextTaskCandidatesByGraph(currentTask)
  if (graphCandidates.length > 0) {
    graphCandidates.forEach((taskId) => set.add(String(taskId)))
  } else {
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
  }

  return Array.from(set)
    .map((id) => {
      const mapping = stateMappings.value.find((item) => String(item?.bpmn_task_id || '').trim() === String(id))
      const stateValue = normalizeStateValue(mapping?.state_value)
      const stateLevel = getWorkflowStateLevel(stateValue)
      const assignmentHint = formatTaskAssignmentHint(id)
      const executable = canExecuteTask(id)
      return {
        value: id,
        taskName: formatTaskName(id),
        stateValue,
        assignmentText: assignmentHint,
        stateLevel,
        disabled: !executable,
        label: formatTaskName(id)
      }
    })
    .sort((a, b) => {
      const aLevel = a.stateLevel >= 0 ? a.stateLevel : 99
      const bLevel = b.stateLevel >= 0 ? b.stateLevel : 99
      if (aLevel !== bLevel) return aLevel - bLevel
      return String(a.taskName || '').localeCompare(String(b.taskName || ''), 'zh-Hans-CN')
    })
}

function getSelectedNextTaskText(row) {
  const key = String(row?.id || '').trim()
  if (!key) return ''
  const selected = String(nextTaskSelections[key] || '').trim()
  if (!selected) return ''
  if (selected === '__complete__') return '结束当前流程单'
  return formatTaskName(selected)
}

function openNextTaskPicker(row) {
  if (!row?.id) return
  const options = getTransitionOptions(row)
  nextTaskPickerOptions.value = options
  nextTaskPickerRow.value = row
  nextTaskPickerSelected.value = String(nextTaskSelections[row.id] || '').trim()
  nextTaskPickerVisible.value = true
}

function closeNextTaskPicker() {
  nextTaskPickerVisible.value = false
  nextTaskPickerRow.value = null
  nextTaskPickerOptions.value = []
  nextTaskPickerSelected.value = ''
}

function applyNextTaskPicker() {
  const row = nextTaskPickerRow.value
  if (!row?.id) {
    closeNextTaskPicker()
    return
  }
  const value = String(nextTaskPickerSelected.value || '').trim()
  if (!value) {
    ElMessage.warning('请先选择下一步')
    return
  }
  nextTaskSelections[row.id] = value
  closeNextTaskPicker()
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
    ElMessage.error('加载流程单失败')
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
        p_business_key: generateWorkflowBusinessKey(),
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
      throw new Error('流程单创建失败')
    }

    ElMessage.success('流程单已启动')
    await refreshWorkflowData()
  } catch (error) {
    ElMessage.error(formatWorkflowError('启动流程单失败', error, '当前账号无权限启动流程单'))
  } finally {
    instanceStarting.value = false
  }
}

async function transitionWorkflowInstance(row) {
  if (!row?.id) return
  const next = nextTaskSelections[row.id]
  if (!next) {
    ElMessage.warning('请选择下一步，或选择“结束当前流程单”')
    return
  }
  const done = await transitionWorkflowByChoice(row, next, { silent: false, auto: false })
  if (done) {
    delete nextTaskSelections[row.id]
  }
}

function resolveLegacyBusinessRoute(bindingKey, businessKey) {
  const key = String(bindingKey || '').trim()
  const rowKey = String(businessKey || '').trim()
  const isNumericKey = /^\d+$/.test(rowKey)

  if (key === 'legacy:hr_employee') {
    if (isNumericKey) return { path: `/hr/employee/detail/${rowKey}`, query: { appKey: 'a' } }
    return { path: '/hr/employee' }
  }
  if (key === 'legacy:hr_change') {
    if (isNumericKey) return { path: `/hr/employee/detail/${rowKey}`, query: { appKey: 'b' } }
    return { path: '/hr/app/b' }
  }
  if (key === 'legacy:hr_attendance') return { path: '/hr/app/c' }
  if (key === 'legacy:hr_user') return { path: '/hr/users' }
  if (key === 'legacy:mms_ledger') {
    if (isNumericKey) return { path: `/materials/material/detail/${rowKey}`, query: { appKey: 'a' } }
    return { path: '/materials/app/a' }
  }
  if (key === 'legacy:mms_inventory_ledger') return { path: '/materials/inventory-ledger' }
  if (key === 'legacy:mms_inventory_stock_in') return { path: '/materials/inventory-stock-in' }
  if (key === 'legacy:mms_inventory_stock_out') return { path: '/materials/inventory-stock-out' }
  if (key === 'legacy:mms_inventory_current') return { path: '/materials/inventory-current' }
  return null
}

function navigateCrossMicroPath(target) {
  const path = String(target?.path || '').trim()
  if (!path) return false
  const queryObj = target?.query && typeof target.query === 'object' ? target.query : {}
  const query = new URLSearchParams(
    Object.entries(queryObj)
      .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== '')
      .map(([k, v]) => [k, String(v)])
  ).toString()
  const fullPath = `${path}${query ? `?${query}` : ''}`
  if (typeof window !== 'undefined') {
    window.location.assign(fullPath)
    return true
  }
  return false
}

function toHostRoutePath(path) {
  const raw = String(path || '').trim()
  if (!raw) return ''
  if (raw.startsWith('/app/')) return `/apps${raw}`
  if (raw.startsWith('/workflow-designer/')) return `/apps${raw}`
  if (raw.startsWith('/flash-builder/')) return `/apps${raw}`
  if (raw.startsWith('/data-app/')) return `/apps${raw}`
  if (raw.startsWith('/config-center/')) return `/apps${raw}`
  if (raw.startsWith('/ontology-relations/')) return `/apps${raw}`
  return raw
}

function resolveBindingDisplayName(binding) {
  const key = String(binding || '').trim()
  if (!key) return '业务处理'
  if (key.startsWith('legacy:')) {
    return LEGACY_BINDING_LABEL_MAP[key] || '业务处理'
  }
  const matched = workflowBusinessApps.value.find((item) => String(item?.id || '').trim() === key)
  return String(matched?.name || '').trim() || '业务处理'
}

function openInHostTab(target, options = {}) {
  if (typeof window === 'undefined') return false
  const hasHostViewport = Boolean(document.getElementById('subapp-viewport'))
  if (!hasHostViewport) return false
  const rawPath = String(target?.path || '').trim()
  if (!rawPath) return false
  const path = toHostRoutePath(rawPath)
  if (!path) return false
  const queryObj = target?.query && typeof target.query === 'object' ? target.query : {}
  const query = {}
  Object.entries(queryObj).forEach(([k, v]) => {
    if (v === null || v === undefined) return
    const text = String(v).trim()
    if (!text) return
    query[k] = text
  })
  const row = options?.row && typeof options.row === 'object' ? options.row : null
  const targetBinding = String(options?.targetBinding || '').trim()
  const scope = String(options?.scope || 'business').trim()
  const instanceId = String(row?.id || query?.wf_instance || '').trim() || 'instance'
  const workflowAppId = String(runtimeAppId.value || query?.wf_app || '').trim() || 'workflow'
  const tabKey = String(options?.tabKey || `${workflowAppId}:${instanceId}:${targetBinding || path}:${scope}`).trim()
  const baseTitle = String(options?.tabTitle || '').trim()
  const tabTitle = baseTitle || `业务处理 · ${resolveBindingDisplayName(targetBinding)}`

  const detail = {
    path,
    query,
    openInNewTab: true,
    tabKey,
    tabTitle
  }
  const payload = { type: 'eis:open-host-tab', detail }
  try {
    window.dispatchEvent(new CustomEvent('eis:open-host-tab', { detail }))
  } catch (e) {}
  try {
    window.postMessage(payload, window.location.origin)
  } catch (e) {}
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(payload, window.location.origin)
    }
  } catch (e) {}
  return true
}

function buildWorkflowRouteQuery(row) {
  const query = {}
  const instanceId = String(row?.id || '').trim()
  const businessKey = String(row?.business_key || '').trim()
  const taskId = String(row?.current_task_id || '').trim()
  const definitionId = String(row?.definition_id || workflowDefinitionId.value || '').trim()
  const workflowAppId = String(runtimeAppId.value || '').trim()
  if (instanceId) query.wf_instance = instanceId
  if (businessKey) query.wf_key = businessKey
  if (taskId) query.wf_task = taskId
  if (definitionId) query.wf_definition = definitionId
  if (workflowAppId) query.wf_app = workflowAppId
  query.wf_from = 'workflow_runtime'
  return query
}

function openBusinessPageForInstance(row) {
  const currentTaskId = String(row?.current_task_id || '').trim()
  const taskBinding = resolveTaskBusinessBinding(currentTaskId)
  const targetBinding = getTargetBusinessAppIdForTask(currentTaskId)
  if (!targetBinding) {
    if (String(taskBinding || '').startsWith('table:')) {
      const tableBinding = String(taskBinding.slice('table:'.length) || '').trim()
      ElMessage.warning(`检测到旧按表绑定：${tableBinding}。请在流程设计器按任务节点改为绑定业务应用。`)
      return
    }
    ElMessage.warning('当前任务未绑定业务应用，请先到流程设计器选中该任务并保存“业务应用绑定”')
    return
  }
  const key = String(row?.business_key || '').trim()
  const workflowQuery = buildWorkflowRouteQuery(row)
  if (targetBinding.startsWith('legacy:')) {
    const resolved = resolveLegacyBusinessRoute(targetBinding, key)
    if (!resolved?.path) {
      ElMessage.warning('未找到该业务应用的跳转路由，请联系管理员配置')
      return
    }
    const resolvedTarget = {
      ...resolved,
      query: {
        ...(resolved?.query && typeof resolved.query === 'object' ? resolved.query : {}),
        ...workflowQuery
      }
    }
    if (!openInHostTab(resolvedTarget, { row, targetBinding, scope: 'open' }) && !navigateCrossMicroPath(resolvedTarget)) {
      router.push(resolvedTarget)
    }
    return
  }
  const target = {
    path: `/app/${targetBinding}`,
    query: workflowQuery
  }
  if (openInHostTab(target, { row, targetBinding, scope: 'open' })) return
  router.push(target)
}

function openBoundBusinessRecord(row) {
  const info = getBusinessProgressInfo(row)
  const recordId = String(info.boundRecordId || '').trim()
  if (!recordId) {
    ElMessage.warning('当前流程单尚未关联业务单据')
    return
  }
  const currentTaskId = String(row?.current_task_id || '').trim()
  const targetBinding = getTargetBusinessAppIdForTask(currentTaskId)
  const workflowQuery = buildWorkflowRouteQuery(row)

  if (targetBinding === 'legacy:mms_inventory_stock_in' || targetBinding === 'legacy:mms_inventory_stock_out') {
    const draftType = String(info.boundDraftType || '').trim()
      || (targetBinding === 'legacy:mms_inventory_stock_out' ? 'out' : 'in')
    const target = {
      path: `/materials/inventory-draft/detail/${encodeURIComponent(recordId)}`,
      query: {
        ...workflowQuery,
        draftType
      }
    }
    if (!openInHostTab(target, { row, targetBinding, scope: 'record', tabKey: `${runtimeAppId.value || 'workflow'}:${row?.id || ''}:${recordId}:record` }) && !navigateCrossMicroPath(target)) {
      router.push(target)
    }
    return
  }

  if (targetBinding && targetBinding.startsWith('legacy:')) {
    const legacy = resolveLegacyBusinessRoute(targetBinding, String(row?.business_key || '').trim())
    if (legacy?.path) {
      const target = {
        ...legacy,
        query: {
          ...(legacy?.query && typeof legacy.query === 'object' ? legacy.query : {}),
          ...workflowQuery
        }
      }
      if (!openInHostTab(target, { row, targetBinding, scope: 'record', tabKey: `${runtimeAppId.value || 'workflow'}:${row?.id || ''}:${recordId}:record` }) && !navigateCrossMicroPath(target)) {
        router.push(target)
      }
      return
    }
  }

  if (targetBinding) {
    const target = {
      path: `/app/${targetBinding}`,
      query: {
        ...workflowQuery,
        wf_row_id: recordId
      }
    }
    if (openInHostTab(target, { row, targetBinding, scope: 'record', tabKey: `${runtimeAppId.value || 'workflow'}:${row?.id || ''}:${recordId}:record` })) return
    router.push(target)
    return
  }

  openBusinessPageForInstance(row)
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
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 6px;
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
  margin-bottom: 6px;
  flex: 0 0 auto;
}

.workflow-side-overview {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}

.workflow-side-overview-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-color-primary-light-9);
}

.overview-icon {
  font-size: 16px;
  color: var(--el-color-primary);
}

.overview-meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.2;
}

.overview-meta strong {
  font-size: 16px;
  color: var(--el-text-color-primary);
}

.overview-meta span {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.workflow-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  gap: 8px;
}

.workflow-tip {
  margin-bottom: 4px;
}

.workflow-auto-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 2px 0 6px;
}

.workflow-auto-text {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.instance-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
}

.workflow-card-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.workflow-card-list-scroll {
  max-height: 42vh;
  overflow-y: auto;
  padding-right: 4px;
}

.workflow-card-list-scroll::-webkit-scrollbar {
  width: 8px;
}

.workflow-card-list-scroll::-webkit-scrollbar-thumb {
  background: rgba(144, 147, 153, 0.45);
  border-radius: 8px;
}

.workflow-card-list-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.workflow-task-card {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 12px;
  background: #fff;
  padding: 10px;
  box-shadow: 0 1px 2px rgba(16, 24, 40, 0.04);
}

.workflow-task-card.admin {
  border-left: 4px solid var(--el-color-primary);
}

.task-card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.task-card-head-tags {
  display: flex;
  align-items: center;
  gap: 6px;
}

.task-card-title {
  font-size: 14px;
  color: var(--el-text-color-primary);
}

.task-card-meta {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}

.task-card-progress {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.task-progress-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.task-progress-item em {
  font-style: normal;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.task-progress-time {
  margin-left: auto;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.task-card-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color-lighter);
  border-radius: 8px;
  padding: 6px 8px;
}

.task-card-meta-item em {
  font-style: normal;
  color: var(--el-text-color-secondary);
}

.task-card-meta-item strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.task-card-meta-item strong.doc-no-link {
  color: var(--el-color-primary);
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.instance-actions {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 6px;
  align-items: center;
  width: 100%;
  overflow: hidden;
}

.instance-open-btn,
.instance-choose-btn {
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  justify-content: center;
}

.instance-choose-btn {
  min-width: 0;
}

.instance-submit-btn {
  grid-column: 1 / span 2;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  justify-content: center;
}

:deep(.instance-actions .el-button) {
  margin-left: 0 !important;
}

.next-task-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: var(--el-fill-color-lighter);
}

.picker-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.picker-title-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.picker-title-row strong {
  color: var(--el-text-color-primary);
  font-size: 13px;
}

.next-task-picker-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-right: 2px;
}

.next-task-picker-item {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 10px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  padding: 10px 12px;
  transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
}

.next-task-picker-item:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-8);
}

.next-task-picker-item.is-active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.next-task-picker-item.is-disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.picker-item-main {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.picker-item-icon {
  font-size: 18px;
  margin-top: 1px;
}

.complete-icon {
  color: var(--el-color-warning);
}

.picker-item-content {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.picker-item-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  line-height: 1.3;
}

.picker-item-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

:deep(.workflow-instance-table .el-table__body-wrapper) {
  overflow-x: hidden;
}

:deep(.workflow-instance-table .el-table__cell) {
  padding-top: 8px;
  padding-bottom: 8px;
  vertical-align: top;
}

.flash-runtime {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
}

.flash-preview {
  flex: 1;
  width: 100%;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: #fff;
}

.flash-runtime-alert {
  margin-top: 4px;
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

  .task-card-meta {
    grid-template-columns: 1fr;
  }

  .task-progress-time {
    width: 100%;
    margin-left: 0;
  }
}
</style>
