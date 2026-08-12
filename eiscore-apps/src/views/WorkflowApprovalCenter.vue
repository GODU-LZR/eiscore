<template>
  <div class="approval-center">
    <header class="page-header">
      <div class="header-left">
        <el-button text :icon="ArrowLeft" @click="goBack">返回</el-button>
        <div class="header-text">
          <h2>审批中心</h2>
          <p>先处理我的待办，再查看流程态势与审计明细</p>
        </div>
      </div>
      <div class="header-actions">
        <div class="actor-chip">
          <el-icon><User /></el-icon>
          <span>{{ actorLabel }}</span>
        </div>
        <el-button :icon="Refresh" :loading="loading" @click="loadData">刷新</el-button>
      </div>
    </header>

    <section class="focus-board">
      <div class="focus-main">
        <div class="section-kicker">
          <el-icon><Warning /></el-icon>
          <span>注意力队列</span>
        </div>
        <div class="focus-headline">
          <div>
            <h3>{{ focusHeadline }}</h3>
            <p>{{ focusSubtext }}</p>
          </div>
          <el-button
            v-if="focusLeadRow?.myPending"
            type="primary"
            :loading="approvalSubmitting && approvalDialog.row?.key === focusLeadRow.key"
            @click="openApprovalDialog(focusLeadRow)"
          >
            处理当前待办
          </el-button>
        </div>

        <div v-if="focusQueueRows.length" class="focus-queue">
          <article
            v-for="row in focusQueueRows"
            :key="row.key"
            class="focus-item"
            :class="{ 'is-primary': row.myPending }"
          >
            <div class="focus-item-main">
              <div class="focus-item-title">
                <span>{{ row.taskName }}</span>
                <el-tag size="small" :type="getProgressTagType(row)">{{ row.progressText }}</el-tag>
              </div>
              <div class="focus-item-meta">
                <span>{{ row.definitionName }}</span>
                <span>流程单 {{ row.instanceId }}</span>
                <span>业务 {{ row.businessKey }}</span>
              </div>
            </div>
            <div class="focus-item-progress">
              <span>{{ row.approvedCount }}/{{ row.requiredApprovals }}</span>
              <div class="mini-progress">
                <i :style="{ width: `${getApprovalPercent(row)}%` }"></i>
              </div>
            </div>
            <el-button
              v-if="row.myPending"
              size="small"
              type="primary"
              :loading="approvalSubmitting && approvalDialog.row?.key === row.key"
              @click="openApprovalDialog(row)"
            >
              处理
            </el-button>
          </article>
        </div>
        <el-empty v-else description="暂无需要你处理的审批" :image-size="84" />
      </div>

      <aside class="focus-side">
        <div
          v-for="item in attentionStats"
          :key="item.key"
          class="stat-line"
          :class="item.tone"
        >
          <div>
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
          </div>
          <el-icon><component :is="item.icon" /></el-icon>
        </div>
      </aside>
    </section>

    <section class="control-strip">
      <div class="view-switch">
        <el-radio-group v-model="activeView" size="small">
          <el-radio-button value="mine">我的待办</el-radio-button>
          <el-radio-button value="pending">全部待签</el-radio-button>
          <el-radio-button value="all">流程态势</el-radio-button>
          <el-radio-button value="audit">审批明细</el-radio-button>
        </el-radio-group>
      </div>
      <div class="filters">
        <el-select
          v-model="filters.definitionId"
          clearable
          filterable
          placeholder="流程定义"
          class="definition-filter"
        >
          <el-option
            v-for="item in definitionOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
        <el-input
          v-model="filters.keyword"
          clearable
          placeholder="搜索流程单 / 任务 / 审批人 / 业务单号"
          class="keyword-filter"
        >
          <template #prefix>
            <el-icon><Search /></el-icon>
          </template>
        </el-input>
        <el-checkbox v-model="filters.myRelatedOnly">仅我相关</el-checkbox>
      </div>
    </section>

    <section v-if="activeView !== 'audit'" class="table-panel">
      <div class="panel-title-row">
        <div>
          <h3>{{ progressPanelTitle }}</h3>
          <p>{{ progressPanelSubtitle }}</p>
        </div>
        <el-tag size="small" effect="plain">{{ visibleProgressRows.length }} 条</el-tag>
      </div>
      <el-table
        v-loading="loading"
        :data="visibleProgressRows"
        size="small"
        border
        :empty-text="progressEmptyText"
        :row-class-name="getProgressRowClassName"
      >
        <el-table-column prop="instanceId" label="流程单号" min-width="90" />
        <el-table-column prop="definitionName" label="流程定义" min-width="170" />
        <el-table-column prop="taskName" label="任务节点" min-width="170" />
        <el-table-column label="业务事项" min-width="240">
          <template #default="{ row }">
            <div class="business-cell">
              <span>{{ row.businessTitle || row.businessKey }}</span>
              <small v-if="row.businessOwner">负责人：{{ row.businessOwner }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="会签" min-width="150">
          <template #default="{ row }">
            <div class="table-progress">
              <span>{{ row.approvalModeLabel }}</span>
              <strong>{{ row.approvedCount }}/{{ row.requiredApprovals }}</strong>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" min-width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="getProgressTagType(row)">{{ row.progressText }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="latestActor" label="最近审批人" min-width="130" />
        <el-table-column label="最近时间" min-width="170">
          <template #default="{ row }">{{ formatDateTime(row.latestAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" fixed="right" min-width="120">
          <template #default="{ row }">
            <el-button
              v-if="row.myPending"
              size="small"
              type="primary"
              :loading="approvalSubmitting && approvalDialog.row?.key === row.key"
              @click="openApprovalDialog(row)"
            >
              处理
            </el-button>
            <span v-else class="muted-action">-</span>
          </template>
        </el-table-column>
      </el-table>
    </section>

    <section v-else class="table-panel">
      <div class="panel-title-row">
        <div>
          <h3>审批意见明细</h3>
          <p>按时间追溯每一次同意、驳回和审批意见</p>
        </div>
        <el-tag size="small" effect="plain">{{ filteredApprovalRows.length }} 条</el-tag>
      </div>
      <el-table v-loading="loading" :data="filteredApprovalRows" size="small" border empty-text="暂无审批意见">
        <el-table-column prop="createdAtText" label="时间" min-width="170" />
        <el-table-column prop="instanceId" label="流程单号" min-width="90" />
        <el-table-column prop="definitionName" label="流程定义" min-width="160" />
        <el-table-column prop="taskName" label="任务节点" min-width="160" />
        <el-table-column prop="actorUsername" label="审批人" min-width="110" />
        <el-table-column prop="actorRole" label="角色" min-width="110" />
        <el-table-column label="决定" min-width="90">
          <template #default="{ row }">
            <el-tag size="small" :type="row.decision === 'rejected' ? 'danger' : 'success'">
              {{ row.decision === 'rejected' ? '驳回' : '同意' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="commentText" label="审批意见" min-width="260" show-overflow-tooltip />
      </el-table>
    </section>

    <el-dialog
      v-model="approvalDialog.visible"
      title="处理审批"
      width="540px"
      destroy-on-close
      @closed="resetApprovalDialog"
    >
      <el-descriptions v-if="approvalDialog.row" :column="1" size="small" border>
        <el-descriptions-item label="流程单号">{{ approvalDialog.row.instanceId }}</el-descriptions-item>
        <el-descriptions-item label="流程定义">{{ approvalDialog.row.definitionName }}</el-descriptions-item>
        <el-descriptions-item label="当前节点">{{ approvalDialog.row.taskName }}</el-descriptions-item>
        <el-descriptions-item v-if="approvalDialog.row.businessOwner" label="负责人">
          {{ approvalDialog.row.businessOwner }}
        </el-descriptions-item>
        <el-descriptions-item label="会签进度">
          {{ approvalDialog.row.approvedCount }}/{{ approvalDialog.row.requiredApprovals }}
        </el-descriptions-item>
      </el-descriptions>

      <section
        v-if="approvalDialog.row?.smartBiActionDetails"
        class="smart-bi-action-context"
      >
        <div class="smart-bi-action-context__head">
          <span>智能 BI 行动详情</span>
          <el-tag
            size="small"
            :type="approvalDialog.row.smartBiActionDetails.riskTagType"
          >
            {{ approvalDialog.row.smartBiActionDetails.riskLabel }}
          </el-tag>
        </div>
        <strong class="smart-bi-action-context__title">
          {{ approvalDialog.row.smartBiActionDetails.title }}
        </strong>
        <div class="smart-bi-action-context__meta">
          <span>{{ approvalDialog.row.smartBiActionDetails.domainLabel }}</span>
          <span>{{ approvalDialog.row.smartBiActionDetails.statusLabel }}</span>
          <span>{{ approvalDialog.row.smartBiActionDetails.dueText }}</span>
        </div>
        <div class="smart-bi-action-context__body">
          <p v-if="approvalDialog.row.smartBiActionDetails.reason">
            <span>原因</span>
            {{ approvalDialog.row.smartBiActionDetails.reason }}
          </p>
          <p v-if="approvalDialog.row.smartBiActionDetails.target">
            <span>目标</span>
            {{ approvalDialog.row.smartBiActionDetails.target }}
          </p>
          <p v-if="approvalDialog.row.smartBiActionDetails.nextStep">
            <span>下一步</span>
            {{ approvalDialog.row.smartBiActionDetails.nextStep }}
          </p>
          <p v-if="approvalDialog.row.smartBiActionDetails.sourceQuestion">
            <span>原始问题</span>
            {{ approvalDialog.row.smartBiActionDetails.sourceQuestion }}
          </p>
        </div>
      </section>

      <el-form class="approval-form" label-width="84px">
        <el-form-item label="处理结果">
          <el-radio-group v-model="approvalForm.decision">
            <el-radio-button value="approved">同意</el-radio-button>
            <el-radio-button value="rejected">驳回</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="approvalForm.decision === 'approved'" label="下一步">
          <el-select v-model="approvalForm.nextTaskId" placeholder="请选择下一步" style="width: 100%">
            <el-option
              v-for="item in approvalNextOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="审批意见">
          <el-input
            v-model="approvalForm.comment"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            :placeholder="getApprovalCommentPlaceholder(approvalDialog.row)"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="approvalDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="approvalSubmitting" @click="submitApproval">
          提交
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { ref, reactive, computed, nextTick, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowLeft,
  DocumentChecked,
  List,
  Refresh,
  Search,
  User,
  Warning
} from '@element-plus/icons-vue'
import axios from 'axios'

const router = useRouter()
const route = useRoute()

const loading = ref(false)
const definitions = ref([])
const instances = ref([])
const assignments = ref([])
const approvals = ref([])
const smartBiActions = ref([])
const currentActor = ref({ username: '', appRole: '' })
const approvalSubmitting = ref(false)
const activeView = ref('mine')
const openedRouteFocusDialogKey = ref('')

const approvalDialog = reactive({
  visible: false,
  row: null
})

const approvalForm = reactive({
  decision: 'approved',
  nextTaskId: '',
  comment: ''
})

const filters = reactive({
  definitionId: '',
  keyword: '',
  pendingOnly: false,
  myFirst: true,
  myRelatedOnly: false
})

const routeFocus = reactive({
  smartBiActionId: '',
  instanceId: '',
  autoOpen: false
})

const actorLabel = computed(() => {
  const username = String(currentActor.value?.username || '').trim()
  const role = String(currentActor.value?.appRole || '').trim()
  if (username && role) return `${username} · ${role}`
  return username || role || '当前账号'
})

const APPROVAL_MODE_LABEL_MAP = Object.freeze({
  any: '单人通过',
  quota: '多人会签',
  all: '全员会签'
})

const SMART_BI_DOMAIN_LABEL_MAP = Object.freeze({
  overview: '经营总览',
  sales: '销售',
  purchase: '采购',
  inventory: '库存',
  production: '生产',
  quality: '质量',
  equipment: '设备'
})

const SMART_BI_RISK_META = Object.freeze({
  critical: { label: '严重', tagType: 'danger' },
  warning: { label: '预警', tagType: 'warning' },
  focus: { label: '关注', tagType: 'primary' },
  normal: { label: '正常', tagType: 'success' }
})

const SMART_BI_ACTION_REFRESH_EVENT = 'eis-smart-bi-action-refresh'
const SMART_BI_ACTION_REFRESH_STORAGE_KEY = 'eis_smart_bi_action_refresh_at'

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

const getWorkflowHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Accept-Profile': 'workflow',
  'Content-Profile': 'workflow'
})

const getPublicHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  'Accept-Profile': 'public',
  'Content-Profile': 'public'
})

const normalizeStringList = (value) => {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || '').trim()).filter(Boolean)
}

const normalizeApprovalMode = (value) => {
  const mode = String(value || '').trim().toLowerCase()
  if (mode === 'quota' || mode === 'all') return mode
  return 'any'
}

const normalizeSmartBiRiskLevel = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  if (['critical', 'serious', '严重', '高', '高风险'].includes(raw)) return 'critical'
  if (['warning', 'warn', '预警', '中', '中风险'].includes(raw)) return 'warning'
  if (['focus', '关注', '低', '低风险'].includes(raw)) return 'focus'
  return 'normal'
}

const normalizeRequiredApprovals = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 1
  return Math.max(1, Math.floor(parsed))
}

const formatDateTime = (value) => {
  const text = String(value || '').trim()
  if (!text) return '-'
  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text
  return date.toLocaleString('zh-CN', { hour12: false })
}

const parsePayloadObject = (payload) => {
  if (!payload || typeof payload !== 'object') return {}
  return payload
}

const getTimeValue = (value) => {
  const time = Date.parse(String(value || ''))
  return Number.isFinite(time) ? time : 0
}

const getSmartBiDomainLabel = (value) => {
  const key = String(value || '').trim().toLowerCase()
  return SMART_BI_DOMAIN_LABEL_MAP[key] || value || '经营'
}

const getSmartBiDueText = (value) => {
  const text = String(value || '').trim()
  if (!text) return '暂无截止时间'
  const time = Date.parse(text)
  if (!Number.isFinite(time)) return text
  const diff = time - Date.now()
  const absDays = Math.ceil(Math.abs(diff) / 86400000)
  if (diff < 0) return `已超期 ${Math.max(absDays, 1)} 天`
  if (diff < 86400000) return '今天到期'
  if (diff < 2 * 86400000) return '明天到期'
  if (diff <= 7 * 86400000) return `${Math.ceil(diff / 86400000)} 天内到期`
  return `截止 ${new Date(time).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })}`
}

const extractSmartBiSuggestionText = (suggestion, ...keys) => {
  if (!suggestion || typeof suggestion !== 'object') return ''
  for (const key of keys) {
    const value = String(suggestion?.[key] || '').trim()
    if (value) return value
  }
  return ''
}

const buildSmartBiActionDetails = (action = {}) => {
  const suggestion = parsePayloadObject(action?.suggestion)
  const riskLevel = normalizeSmartBiRiskLevel(action?.risk_level)
  const riskMeta = SMART_BI_RISK_META[riskLevel] || SMART_BI_RISK_META.normal
  const title = String(action?.title || action?.action_no || '').trim() || '未命名行动单'
  return {
    actionNo: String(action?.action_no || '').trim(),
    title,
    domainLabel: getSmartBiDomainLabel(action?.domain),
    riskLevel,
    riskLabel: riskMeta.label,
    riskTagType: riskMeta.tagType,
    statusLabel: String(action?.status || '').trim() || '待发起',
    dueText: getSmartBiDueText(action?.due_at),
    reason: extractSmartBiSuggestionText(suggestion, 'reason', 'risk_reason', 'riskReason', 'problem'),
    target: extractSmartBiSuggestionText(suggestion, 'target', 'goal', 'expected_result', 'expectedResult'),
    nextStep: extractSmartBiSuggestionText(suggestion, 'next_step', 'nextStep', 'measure', 'todo'),
    sourceQuestion: String(action?.source_question || '').trim(),
    reportExcerpt: String(action?.report_excerpt || '').trim()
  }
}

const getRouteQueryValue = (name) => {
  const value = route.query?.[name]
  const raw = Array.isArray(value) ? value[0] : value
  return String(raw || '').trim()
}

const findSmartBiActionByRouteFocus = (actionId, instanceId) => smartBiActions.value.find((item) => {
  const itemId = String(item?.id || '').trim()
  const itemInstanceId = String(item?.workflow_instance_id || '').trim()
  if (actionId && itemId === actionId) return true
  return Boolean(instanceId && itemInstanceId === instanceId)
})

const applyRouteFocusFromQuery = () => {
  const actionId = getRouteQueryValue('smart_bi_action_id') || getRouteQueryValue('smartBiActionId') || getRouteQueryValue('action_id')
  const instanceId = getRouteQueryValue('instance_id') || getRouteQueryValue('workflow_instance_id') || getRouteQueryValue('instanceId')
  const keyword = getRouteQueryValue('keyword')
  const autoOpen = ['1', 'true', 'yes'].includes(
    (getRouteQueryValue('open') || getRouteQueryValue('auto_open') || getRouteQueryValue('autoOpen')).toLowerCase()
  )
  if (!actionId && !instanceId && !keyword) return false

  const action = findSmartBiActionByRouteFocus(actionId, instanceId)
  const previousFocusKey = `${routeFocus.smartBiActionId}::${routeFocus.instanceId}`
  routeFocus.smartBiActionId = actionId || String(action?.id || '').trim()
  routeFocus.instanceId = instanceId || String(action?.workflow_instance_id || '').trim()
  routeFocus.autoOpen = autoOpen
  const nextFocusKey = `${routeFocus.smartBiActionId}::${routeFocus.instanceId}`
  if (nextFocusKey !== previousFocusKey) openedRouteFocusDialogKey.value = ''

  activeView.value = 'all'
  filters.pendingOnly = false
  filters.myRelatedOnly = false
  filters.keyword = keyword
    || String(action?.action_no || action?.title || '').trim()
    || routeFocus.instanceId
    || routeFocus.smartBiActionId

  return true
}

const getTagAttribute = (tag, name) => {
  const pattern = new RegExp(`${name}="([^"]*)"`, 'i')
  return tag.match(pattern)?.[1] || ''
}

const decodeXmlText = (value) => String(value || '')
  .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&#([0-9]+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&quot;/g, '"')
  .replace(/&#34;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&amp;/g, '&')

const parseBpmnTaskNameMap = (raw) => {
  const xml = String(raw || '')
  const map = {}
  const regex = /<bpmn:(?:userTask|task|serviceTask|manualTask|scriptTask|receiveTask|sendTask|callActivity)\b[^>]*>/gi
  let match
  while ((match = regex.exec(xml)) !== null) {
    const tag = match[0] || ''
    const id = getTagAttribute(tag, 'id')
    const name = getTagAttribute(tag, 'name')
    if (id) map[id] = decodeXmlText(name) || id
  }
  return map
}

const parseBpmnGraph = (raw) => {
  const xml = String(raw || '')
  const nodeTypeMap = {}
  const outgoingMap = {}
  const nodeRegex = /<bpmn:([a-zA-Z0-9]+)\b[^>]*\bid="([^"]+)"/g
  let nodeMatch
  while ((nodeMatch = nodeRegex.exec(xml)) !== null) {
    const type = String(nodeMatch[1] || '').trim()
    const id = String(nodeMatch[2] || '').trim()
    if (type && id) nodeTypeMap[id] = `bpmn:${type}`
  }

  const flowRegex = /<bpmn:sequenceFlow\b[^>]*>/gi
  let flowMatch
  while ((flowMatch = flowRegex.exec(xml)) !== null) {
    const tag = flowMatch[0] || ''
    const source = getTagAttribute(tag, 'sourceRef')
    const target = getTagAttribute(tag, 'targetRef')
    if (!source || !target) continue
    if (!outgoingMap[source]) outgoingMap[source] = []
    outgoingMap[source].push(target)
  }

  return { nodeTypeMap, outgoingMap }
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
}

const extractComment = (row) => {
  const payload = parsePayloadObject(row?.payload)
  const text = String(
    row?.comment
    || payload?.approval_comment
    || payload?.comment
    || payload?.opinion
    || payload?.approval?.comment
    || ''
  ).trim()
  return text || '-'
}

const definitionNameMap = computed(() => {
  const map = {}
  definitions.value.forEach((item) => {
    const key = String(item?.id || '').trim()
    if (!key) return
    map[key] = String(item?.name || '').trim() || `流程定义#${key}`
  })
  return map
})

const definitionMap = computed(() => {
  const map = {}
  definitions.value.forEach((item) => {
    const key = String(item?.id || '').trim()
    if (key) map[key] = item
  })
  return map
})

const taskNameMapByDefinition = computed(() => {
  const map = {}
  definitions.value.forEach((item) => {
    const key = String(item?.id || '').trim()
    if (key) map[key] = parseBpmnTaskNameMap(item?.bpmn_xml)
  })
  return map
})

const workflowGraphByDefinition = computed(() => {
  const map = {}
  definitions.value.forEach((item) => {
    const key = String(item?.id || '').trim()
    if (key) map[key] = parseBpmnGraph(item?.bpmn_xml)
  })
  return map
})

const getTaskName = (definitionId, taskId) => {
  const defKey = String(definitionId || '').trim()
  const taskKey = String(taskId || '').trim()
  if (!taskKey) return '-'
  return taskNameMapByDefinition.value?.[defKey]?.[taskKey] || taskKey
}

const definitionOptions = computed(() => definitions.value.map((item) => ({
  value: String(item?.id || '').trim(),
  label: String(item?.name || '').trim() || `流程定义#${item?.id}`
})))

const instanceMap = computed(() => {
  const map = {}
  instances.value.forEach((item) => {
    const key = String(item?.id || '').trim()
    if (key) map[key] = item
  })
  return map
})

const smartBiActionMap = computed(() => {
  const byId = {}
  const byInstance = {}
  smartBiActions.value.forEach((item) => {
    const id = String(item?.id || '').trim()
    const instanceId = String(item?.workflow_instance_id || '').trim()
    if (id) byId[id] = item
    if (instanceId) byInstance[instanceId] = item
  })
  return { byId, byInstance }
})

const getBusinessDisplay = (instance = {}) => {
  const definition = definitionMap.value[String(instance?.definition_id || '').trim()] || {}
  const associatedTable = String(definition?.associated_table || '').trim()
  const businessKey = String(instance?.business_key || '').trim()
  if (associatedTable === 'public.smart_bi_action_items') {
    const action = smartBiActionMap.value.byInstance[String(instance?.id || '').trim()]
      || smartBiActionMap.value.byId[businessKey]
    if (action) {
      const actionNo = String(action?.action_no || '').trim()
      const title = String(action?.title || '').trim()
      const ownerName = String(action?.owner_name || '').trim()
      const ownerRole = String(action?.owner_role || '').trim()
      const ownerUsername = String(action?.owner_username || '').trim()
      const ownerPrimary = ownerName || ownerRole || ownerUsername
      const ownerAccount = ownerUsername && ownerUsername !== ownerPrimary ? `账号 ${ownerUsername}` : ''
      return {
        key: actionNo || businessKey || '-',
        title: [actionNo, title].filter(Boolean).join(' · ') || businessKey || '-',
        owner: [ownerPrimary, ownerAccount].filter(Boolean).join(' / '),
        ownerName,
        ownerRole,
        ownerUsername,
        isSmartBiAction: true,
        smartBiActionId: String(action?.id || '').trim(),
        smartBiActionDetails: buildSmartBiActionDetails(action)
      }
    }
  }
  return {
    key: businessKey || '-',
    title: businessKey || '-',
    owner: '',
    ownerName: '',
    ownerRole: '',
    ownerUsername: '',
    isSmartBiAction: false,
    smartBiActionId: '',
    smartBiActionDetails: null
  }
}

const assignmentMap = computed(() => {
  const map = {}
  assignments.value.forEach((item) => {
    const definitionId = String(item?.definition_id || '').trim()
    const taskId = String(item?.task_id || '').trim()
    if (!definitionId || !taskId) return
    const key = `${definitionId}::${taskId}`
    const existing = map[key]
    if (!existing || Number(item?.id || 0) > Number(existing?.id || 0)) {
      map[key] = item
    }
  })
  return map
})

const canActorExecuteByAssignment = (assignment) => {
  const role = String(currentActor.value?.appRole || '').trim()
  const username = String(currentActor.value?.username || '').trim()
  if (role === 'super_admin') return true
  if (!assignment || typeof assignment !== 'object') return true
  const roles = normalizeStringList(assignment?.candidate_roles)
  const users = normalizeStringList(assignment?.candidate_users)
  const roleOk = !roles.length || (role && roles.includes(role))
  const userOk = !users.length || (username && users.includes(username))
  return roleOk && userOk
}

const canActorExecuteSmartBiAction = (businessDisplay) => {
  if (!businessDisplay?.isSmartBiAction) return true
  const role = String(currentActor.value?.appRole || '').trim()
  const username = String(currentActor.value?.username || '').trim()
  if (role === 'super_admin') return true

  const ownerUsername = String(businessDisplay?.ownerUsername || '').trim()
  if (ownerUsername) {
    return Boolean(username && username.toLowerCase() === ownerUsername.toLowerCase())
  }

  const ownerRole = String(businessDisplay?.ownerRole || '').trim()
  if (ownerRole) return Boolean(role && role === ownerRole)

  return true
}

const resolveNextTaskCandidatesByGraph = (definitionId, taskId) => {
  const current = String(taskId || '').trim()
  if (!current) return []
  const graph = workflowGraphByDefinition.value?.[String(definitionId || '').trim()] || {}
  const nodeTypeMap = graph.nodeTypeMap || {}
  const outgoingMap = graph.outgoingMap || {}
  const firstTargets = Array.isArray(outgoingMap[current]) ? outgoingMap[current] : []
  if (!firstTargets.length) return []

  const queue = [...firstTargets]
  const visited = new Set([current])
  const candidates = []
  let guard = 0

  while (queue.length && guard < 300) {
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

const getTransitionOptions = (row) => {
  const definitionId = String(row?.definitionId || '').trim()
  const currentTaskId = String(row?.taskId || '').trim()
  const graph = workflowGraphByDefinition.value?.[definitionId] || {}
  const hasGraphOutgoing = Array.isArray(graph?.outgoingMap?.[currentTaskId])
    && graph.outgoingMap[currentTaskId].length > 0
  const graphCandidates = resolveNextTaskCandidatesByGraph(definitionId, currentTaskId)
  const set = new Set(graphCandidates)

  if (!set.size && hasGraphOutgoing) {
    return [{ value: '__complete__', label: '结束当前流程单' }]
  }

  if (!set.size) {
    assignments.value
      .filter((item) => String(item?.definition_id || '').trim() === definitionId)
      .map((item) => String(item?.task_id || '').trim())
      .filter((taskId) => taskId && taskId !== currentTaskId)
      .forEach((taskId) => set.add(taskId))
  }

  const options = Array.from(set).map((taskId) => ({
    value: taskId,
    label: getTaskName(definitionId, taskId)
  }))

  if (!options.length) {
    options.push({ value: '__complete__', label: '结束当前流程单' })
  }

  return options
}

const approvalNextOptions = computed(() => getTransitionOptions(approvalDialog.row))

const progressRows = computed(() => {
  const grouped = {}
  const ensureBucket = (instanceId, definitionId, taskId) => {
    const key = `${instanceId}::${taskId}`
    if (!grouped[key]) {
      grouped[key] = {
        key,
        instanceId,
        definitionId,
        taskId,
        latestAt: '',
        latestActor: '-',
        approvedActorSet: new Set(),
        rejectedActorSet: new Set()
      }
    }
    return grouped[key]
  }

  instances.value.forEach((item) => {
    const instanceId = String(item?.id || '').trim()
    const definitionId = String(item?.definition_id || '').trim()
    const taskId = String(item?.current_task_id || '').trim()
    const status = String(item?.status || '').toUpperCase()
    if (!instanceId || !definitionId || !taskId || status === 'COMPLETED') return
    const bucket = ensureBucket(instanceId, definitionId, taskId)
    bucket.latestAt = String(item?.started_at || '').trim()
  })

  approvals.value.forEach((item) => {
    const instanceId = String(item?.instance_id || '').trim()
    const definitionId = String(item?.definition_id || '').trim()
    const taskId = String(item?.task_id || '').trim()
    if (!instanceId || !definitionId || !taskId) return
    const bucket = ensureBucket(instanceId, definitionId, taskId)
    const decision = String(item?.decision || '').toLowerCase()
    const actor = String(item?.actor_username || '').trim()
    if (decision === 'rejected') {
      if (actor) bucket.rejectedActorSet.add(actor)
    } else if (actor) {
      bucket.approvedActorSet.add(actor)
    }
    const createdAt = String(item?.created_at || '').trim()
    if (!bucket.latestAt || getTimeValue(createdAt) > getTimeValue(bucket.latestAt)) {
      bucket.latestAt = createdAt
      bucket.latestActor = actor || '-'
    }
  })

  return Object.values(grouped)
    .map((bucket) => {
      const assignment = assignmentMap.value[`${bucket.definitionId}::${bucket.taskId}`] || null
      const mode = normalizeApprovalMode(assignment?.approval_mode)
      let required = normalizeRequiredApprovals(assignment?.required_approvals)
      if (mode === 'all') {
        const users = normalizeStringList(assignment?.candidate_users)
        if (users.length) required = Math.max(required, users.length)
      }
      const approved = bucket.approvedActorSet.size
      const rejected = bucket.rejectedActorSet.size > 0
      const instance = instanceMap.value[bucket.instanceId] || {}
      const currentTask = String(instance?.current_task_id || '').trim()
      const instanceStatus = String(instance?.status || '').toUpperCase()
      const movedOn = Boolean(currentTask) && currentTask !== bucket.taskId
      const isCompleted = instanceStatus === 'COMPLETED'
      const pending = !rejected && !isCompleted && !movedOn && approved < required
      const progressText = rejected ? '已驳回' : (isCompleted ? '流程已完成' : (movedOn ? '已流转' : (pending ? '待会签' : '可推进')))
      const approvedActors = Array.from(bucket.approvedActorSet)
      const reviewedActors = [...approvedActors, ...Array.from(bucket.rejectedActorSet)]
      const actorReviewed = reviewedActors.includes(String(currentActor.value?.username || '').trim())
      const businessDisplay = getBusinessDisplay(instance)
      const actorCanExecute = canActorExecuteByAssignment(assignment)
        && canActorExecuteSmartBiAction(businessDisplay)
      const myPending = pending && actorCanExecute && !actorReviewed
      const myRelated = actorCanExecute || actorReviewed

      return {
        key: bucket.key,
        instanceId: bucket.instanceId,
        definitionId: bucket.definitionId,
        definitionName: definitionNameMap.value[bucket.definitionId] || `流程定义#${bucket.definitionId}`,
        taskId: bucket.taskId,
        taskName: getTaskName(bucket.definitionId, bucket.taskId),
        businessKey: businessDisplay.key,
        businessTitle: businessDisplay.title,
        businessOwner: businessDisplay.owner,
        businessOwnerRole: businessDisplay.ownerRole,
        businessOwnerName: businessDisplay.ownerName,
        businessOwnerUsername: businessDisplay.ownerUsername,
        isSmartBiAction: businessDisplay.isSmartBiAction,
        smartBiActionId: businessDisplay.smartBiActionId,
        smartBiActionDetails: businessDisplay.smartBiActionDetails,
        approvalMode: mode,
        approvalModeLabel: APPROVAL_MODE_LABEL_MAP[mode] || mode,
        approvedCount: approved,
        requiredApprovals: required,
        requireComment: assignment?.require_comment === true,
        rejected,
        pending,
        myPending,
        myRelated,
        approvedActors,
        progressText,
        latestAt: bucket.latestAt,
        latestActor: bucket.latestActor
      }
    })
    .sort((a, b) => getTimeValue(b.latestAt) - getTimeValue(a.latestAt))
})

const pendingProgressKeySet = computed(() => {
  const set = new Set()
  progressRows.value.forEach((item) => {
    if (item.pending) set.add(item.key)
  })
  return set
})

const approvalRows = computed(() => approvals.value.map((item) => {
  const instanceId = String(item?.instance_id || '').trim()
  const definitionId = String(item?.definition_id || '').trim()
  const taskId = String(item?.task_id || '').trim()
  return {
    id: item?.id,
    key: `${instanceId}::${taskId}`,
    instanceId,
    definitionId,
    definitionName: definitionNameMap.value[definitionId] || `流程定义#${definitionId}`,
    taskId,
    taskName: getTaskName(definitionId, taskId),
    actorUsername: String(item?.actor_username || '').trim() || '-',
    actorRole: String(item?.actor_role || '').trim() || '-',
    decision: String(item?.decision || '').trim().toLowerCase() || 'approved',
    commentText: extractComment(item),
    createdAt: String(item?.created_at || '').trim(),
    createdAtText: formatDateTime(item?.created_at)
  }
}))

const containsKeyword = (row, keyword) => {
  if (!keyword) return true
  const needle = keyword.toLowerCase()
  return [
    row.instanceId,
    row.taskId,
    row.taskName,
    row.definitionName,
    row.latestActor,
    row.actorUsername,
    row.businessKey,
    row.businessTitle,
    row.businessOwner,
    row.businessOwnerRole,
    row.businessOwnerUsername,
    row.smartBiActionId,
    row.smartBiActionDetails?.reason,
    row.smartBiActionDetails?.target,
    row.smartBiActionDetails?.nextStep,
    row.smartBiActionDetails?.sourceQuestion,
    row.commentText
  ].some((item) => String(item || '').toLowerCase().includes(needle))
}

const filteredProgressRows = computed(() => {
  const definitionId = String(filters.definitionId || '').trim()
  const keyword = String(filters.keyword || '').trim().toLowerCase()
  const rows = progressRows.value.filter((row) => {
    if (definitionId && row.definitionId !== definitionId) return false
    if (filters.pendingOnly && !row.pending) return false
    if (filters.myRelatedOnly && !row.myRelated) return false
    if (!containsKeyword(row, keyword)) return false
    return true
  })
  const sorted = rows.slice().sort((a, b) => {
    if (filters.myFirst) {
      if (a.myPending !== b.myPending) return a.myPending ? -1 : 1
      if (a.pending !== b.pending) return a.pending ? -1 : 1
    }
    return Date.parse(b.latestAt || '') - Date.parse(a.latestAt || '')
  })
  return sorted
})

const myPendingRows = computed(() => filteredProgressRows.value.filter((row) => row.myPending))

const pendingRows = computed(() => filteredProgressRows.value.filter((row) => row.pending))

const focusQueueRows = computed(() => {
  const primary = myPendingRows.value
  if (primary.length) return primary.slice(0, 4)
  return pendingRows.value.slice(0, 4)
})

const focusLeadRow = computed(() => (
  focusQueueRows.value[0]
  || filteredProgressRows.value[0]
  || null
))

const focusHeadline = computed(() => {
  if (summary.value.myPendingCount > 0) {
    return `你有 ${summary.value.myPendingCount} 个待处理审批`
  }
  if (summary.value.pendingProgress > 0) {
    return `当前还有 ${summary.value.pendingProgress} 个待会签节点`
  }
  return '当前没有阻塞你的审批'
})

const focusSubtext = computed(() => {
  const row = focusLeadRow.value
  if (row?.myPending) {
    return `${row.definitionName} / ${row.taskName} 正在等待你处理`
  }
  if (row?.pending) {
    return '下面显示全局待会签节点，便于你判断流程是否拥堵'
  }
  return '可切换到流程态势或审批明细查看历史记录'
})

const visibleProgressRows = computed(() => {
  if (activeView.value === 'mine') return myPendingRows.value
  if (activeView.value === 'pending') return pendingRows.value
  return filteredProgressRows.value
})

const progressPanelTitle = computed(() => {
  if (activeView.value === 'mine') return '我的待办'
  if (activeView.value === 'pending') return '全部待签'
  return '流程态势'
})

const progressPanelSubtitle = computed(() => {
  if (activeView.value === 'mine') return '只保留当前账号可以处理且尚未审批的节点'
  if (activeView.value === 'pending') return '按待处理优先级查看所有仍未满足会签条件的节点'
  return '查看所有活动流程、已流转节点和可推进节点'
})

const progressEmptyText = computed(() => {
  if (activeView.value === 'mine') return '暂无我的待办'
  if (activeView.value === 'pending') return '暂无待会签节点'
  return '暂无流程记录'
})

const getApprovalPercent = (row) => {
  const required = Math.max(1, Number(row?.requiredApprovals || 1))
  const approved = Math.max(0, Number(row?.approvedCount || 0))
  return Math.min(100, Math.round((approved / required) * 100))
}

const attentionStats = computed(() => ([
  {
    key: 'mine',
    label: '我的待办',
    value: summary.value.myPendingCount,
    icon: User,
    tone: summary.value.myPendingCount > 0 ? 'warning' : 'quiet'
  },
  {
    key: 'pending',
    label: '待会签',
    value: summary.value.pendingProgress,
    icon: Warning,
    tone: summary.value.pendingProgress > 0 ? 'warning' : 'quiet'
  },
  {
    key: 'instance',
    label: '流程单',
    value: summary.value.instanceCount,
    icon: List,
    tone: 'neutral'
  },
  {
    key: 'approval',
    label: '审批记录',
    value: summary.value.totalApprovals,
    icon: DocumentChecked,
    tone: 'neutral'
  }
]))

const myRelatedProgressKeySet = computed(() => {
  const set = new Set()
  progressRows.value.forEach((item) => {
    if (item.myRelated) set.add(item.key)
  })
  return set
})

const filteredApprovalRows = computed(() => {
  const definitionId = String(filters.definitionId || '').trim()
  const keyword = String(filters.keyword || '').trim().toLowerCase()
  const username = String(currentActor.value?.username || '').trim()
  const rows = approvalRows.value.filter((row) => {
    if (definitionId && row.definitionId !== definitionId) return false
    if (filters.pendingOnly && !pendingProgressKeySet.value.has(row.key)) return false
    if (filters.myRelatedOnly) {
      const mine = username && row.actorUsername === username
      if (!mine && !myRelatedProgressKeySet.value.has(row.key)) return false
    }
    if (!containsKeyword(row, keyword)) return false
    return true
  })
  if (!filters.myFirst) return rows
  return rows.slice().sort((a, b) => {
    const mineA = Boolean(username && a.actorUsername === username)
    const mineB = Boolean(username && b.actorUsername === username)
    if (mineA !== mineB) return mineA ? -1 : 1
    return Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '')
  })
})

const summary = computed(() => {
  const instanceSet = new Set(filteredProgressRows.value.map((item) => item.instanceId))
  return {
    totalProgress: filteredProgressRows.value.length,
    pendingProgress: filteredProgressRows.value.filter((item) => item.pending).length,
    myPendingCount: filteredProgressRows.value.filter((item) => item.myPending).length,
    totalApprovals: filteredApprovalRows.value.length,
    instanceCount: instanceSet.size
  }
})

const getProgressTagType = (row) => {
  if (row?.rejected) return 'danger'
  if (row?.pending) return 'warning'
  if (String(row?.progressText || '') === '流程已完成') return 'info'
  return 'success'
}

const getProgressRowClassName = ({ row }) => {
  if (
    (routeFocus.smartBiActionId && String(row?.smartBiActionId || '') === routeFocus.smartBiActionId)
    || (routeFocus.instanceId && String(row?.instanceId || '') === routeFocus.instanceId)
  ) {
    return 'approval-row--smart-bi-focus'
  }
  if (row?.myPending) return 'approval-row--focus'
  if (row?.pending) return 'approval-row--pending'
  return ''
}

const goBack = () => router.push('/')

const resetApprovalDialog = () => {
  approvalDialog.row = null
  approvalForm.decision = 'approved'
  approvalForm.nextTaskId = ''
  approvalForm.comment = ''
}

const getApprovalCommentPlaceholder = (row) => {
  if (row?.isSmartBiAction) {
    const taskId = String(row?.taskId || '').trim()
    if (taskId === 'Task_BIExecute') return '请填写执行结果、负责人动作、预计或实际完成情况'
    if (taskId === 'Task_BIVerify') return '请填写验证结论、指标变化、是否同意闭环'
    if (taskId === 'Task_BIReview') return '可填写确认意见，例如风险是否属实、建议是否采纳'
  }
  return row?.requireComment ? '当前节点要求填写审批意见' : '可填写审批意见'
}

const getApprovalRequiredCommentMessage = (row) => {
  if (row?.isSmartBiAction) {
    const taskId = String(row?.taskId || '').trim()
    if (taskId === 'Task_BIExecute') return '请填写智能 BI 行动执行结果'
    if (taskId === 'Task_BIVerify') return '请填写智能 BI 闭环验证结论'
  }
  return '当前节点要求填写审批意见'
}

const openApprovalDialog = (row) => {
  approvalDialog.row = row
  approvalForm.decision = 'approved'
  approvalForm.comment = ''
  approvalForm.nextTaskId = getTransitionOptions(row)?.[0]?.value || '__complete__'
  approvalDialog.visible = true
}

const notifySmartBiActionChanged = (row, decision) => {
  if (!row?.isSmartBiAction || typeof window === 'undefined') return
  const payload = {
    actionId: String(row.smartBiActionId || '').trim(),
    instanceId: String(row.instanceId || '').trim(),
    taskId: String(row.taskId || '').trim(),
    decision: String(decision || '').trim(),
    updatedAt: Date.now()
  }
  try {
    window.localStorage?.setItem(SMART_BI_ACTION_REFRESH_STORAGE_KEY, JSON.stringify(payload))
  } catch {}
  window.dispatchEvent(new CustomEvent(SMART_BI_ACTION_REFRESH_EVENT, { detail: payload }))
}

const getRouteFocusedProgressRow = () => {
  const actionId = String(routeFocus.smartBiActionId || '').trim()
  const instanceId = String(routeFocus.instanceId || '').trim()
  if (!actionId && !instanceId) return null
  const isMatched = (row) => (
    (actionId && String(row?.smartBiActionId || '') === actionId)
    || (instanceId && String(row?.instanceId || '') === instanceId)
  )
  return filteredProgressRows.value.find(isMatched)
    || progressRows.value.find(isMatched)
    || null
}

const maybeOpenRouteFocusDialog = async () => {
  if (!routeFocus.autoOpen || approvalDialog.visible) return
  const row = getRouteFocusedProgressRow()
  if (!row?.myPending) return
  const key = String(row.key || '')
  if (!key || openedRouteFocusDialogKey.value === key) return
  openedRouteFocusDialogKey.value = key
  await nextTick()
  openApprovalDialog(row)
}

const submitApproval = async () => {
  const row = approvalDialog.row
  if (!row?.instanceId) return

  const comment = String(approvalForm.comment || '').trim()
  if (row.requireComment && !comment) {
    ElMessage.warning(getApprovalRequiredCommentMessage(row))
    return
  }

  approvalSubmitting.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const headers = {
      ...getWorkflowHeaders(token),
      'Content-Type': 'application/json'
    }
    const rejectRpcPath = row.isSmartBiAction
      ? '/api/rpc/reject_smart_bi_action_workflow'
      : '/api/rpc/reject_workflow_task'
    const transitionRpcPath = row.isSmartBiAction
      ? '/api/rpc/transition_smart_bi_action_workflow'
      : '/api/rpc/transition_workflow_instance'

    if (approvalForm.decision === 'rejected') {
      await axios.post(
        rejectRpcPath,
        {
          p_instance_id: Number(row.instanceId),
          p_comment: comment || null,
          p_variables: comment ? { approval_comment: comment } : {}
        },
        { headers }
      )
      ElMessage.success('已驳回流程单')
      notifySmartBiActionChanged(row, 'rejected')
    } else {
      const nextTaskId = String(approvalForm.nextTaskId || '').trim()
      if (!nextTaskId) {
        ElMessage.warning('请选择下一步')
        return
      }
      const complete = nextTaskId === '__complete__'
      const response = await axios.post(
        transitionRpcPath,
        {
          p_instance_id: Number(row.instanceId),
          p_next_task_id: complete ? null : nextTaskId,
          p_complete: complete,
          p_variables: comment ? { approval_comment: comment } : {}
        },
        { headers }
      )
      const updated = Array.isArray(response.data) ? response.data[0] : response.data
      const stillPendingSameTask = !complete
        && String(updated?.current_task_id || '').trim() === String(row.taskId || '').trim()
        && String(updated?.status || '').toUpperCase() === 'ACTIVE'
      ElMessage.success(stillPendingSameTask ? '已记录审批意见，等待其他审批人' : '流程单已推进')
      notifySmartBiActionChanged(row, 'approved')
    }
    approvalDialog.visible = false
    await loadData()
  } catch (error) {
    ElMessage.error(`审批处理失败：${error?.response?.data?.message || error?.message || '未知错误'}`)
  } finally {
    approvalSubmitting.value = false
  }
}

const loadData = async () => {
  loading.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const headers = getWorkflowHeaders(token)
    const publicHeaders = getPublicHeaders(token)
    const [definitionRes, instanceRes, assignmentRes, approvalRes, smartBiActionRes] = await Promise.all([
      axios.get('/api/definitions?select=id,name,app_id,associated_table,bpmn_xml,updated_at&order=id.desc&limit=500', { headers }),
      axios.get('/api/instances?select=id,definition_id,current_task_id,status,business_key,started_at,ended_at&order=id.desc&limit=2000', { headers }),
      axios.get('/api/task_assignments?select=id,definition_id,task_id,candidate_roles,candidate_users,approval_mode,required_approvals,require_comment&order=id.desc&limit=2000', { headers }),
      axios.get('/api/task_approvals?select=id,instance_id,definition_id,task_id,actor_username,actor_role,decision,comment,payload,created_at,updated_at&order=created_at.desc&limit=5000', { headers }),
      axios.get('/api/smart_bi_action_items?select=id,action_no,title,domain,risk_level,owner_role,owner_name,owner_username,due_at,status,source_question,report_excerpt,suggestion,workflow_instance_id&order=updated_at.desc&limit=2000', { headers: publicHeaders })
        .catch(() => ({ data: [] }))
    ])
    definitions.value = Array.isArray(definitionRes.data) ? definitionRes.data : []
    instances.value = Array.isArray(instanceRes.data) ? instanceRes.data : []
    assignments.value = Array.isArray(assignmentRes.data) ? assignmentRes.data : []
    approvals.value = Array.isArray(approvalRes.data) ? approvalRes.data : []
    smartBiActions.value = Array.isArray(smartBiActionRes.data) ? smartBiActionRes.data : []
    const hasRouteFocus = applyRouteFocusFromQuery()
    if (hasRouteFocus) await maybeOpenRouteFocusDialog()
  } catch (error) {
    ElMessage.error(`加载审批中心数据失败：${error?.response?.data?.message || error?.message || '未知错误'}`)
  } finally {
    loading.value = false
  }
}

watch(() => route.query, async () => {
  const hasRouteFocus = applyRouteFocusFromQuery()
  if (hasRouteFocus) await maybeOpenRouteFocusDialog()
})

onMounted(() => {
  readCurrentActor()
  loadData()
})
</script>

<style scoped>
.approval-center {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  background: #f4f6f9;
  box-sizing: border-box;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-text h2 {
  margin: 0;
  font-size: 20px;
  line-height: 1.25;
  color: #303133;
}

.header-text p {
  margin: 4px 0 0;
  color: #6b7280;
  font-size: 12px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.actor-chip {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid #d8dee9;
  border-radius: 8px;
  background: #fff;
  color: #4b5563;
  font-size: 12px;
}

.focus-board {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 240px;
  gap: 12px;
}

.focus-main,
.focus-side,
.control-strip,
.table-panel {
  background: #fff;
  border: 1px solid #dfe5ee;
  border-radius: 8px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.focus-main {
  min-width: 0;
  padding: 16px;
}

.section-kicker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #9a5b00;
}

.focus-headline {
  min-height: 56px;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
}

.focus-headline h3 {
  margin: 0;
  font-size: 22px;
  line-height: 1.25;
  color: #172033;
}

.focus-headline p {
  margin: 6px 0 0;
  color: #64748b;
  font-size: 13px;
}

.focus-queue {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 16px;
}

.focus-item {
  min-height: 68px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px auto;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #e5eaf2;
  border-radius: 8px;
  background: #fbfcfe;
}

.focus-item.is-primary {
  border-color: #8db9ff;
  background: #f4f8ff;
}

.focus-item-main {
  min-width: 0;
}

.focus-item-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.focus-item-title span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
}

.focus-item-meta {
  display: flex;
  gap: 10px;
  margin-top: 6px;
  min-width: 0;
  color: #64748b;
  font-size: 12px;
}

.focus-item-meta span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.focus-item-progress {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #4b5563;
  font-size: 12px;
}

.mini-progress {
  width: 100%;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: #e5e7eb;
}

.mini-progress i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #3b82f6;
}

.focus-side {
  display: flex;
  flex-direction: column;
  padding: 8px;
}

.stat-line {
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px;
  border-radius: 8px;
  color: #4b5563;
}

.stat-line + .stat-line {
  border-top: 1px solid #eef2f7;
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}

.stat-line span {
  display: block;
  font-size: 12px;
  color: #64748b;
}

.stat-line strong {
  display: block;
  margin-top: 2px;
  font-size: 22px;
  line-height: 1;
  color: #111827;
}

.stat-line.warning {
  background: #fff7ed;
}

.stat-line.warning strong,
.stat-line.warning .el-icon {
  color: #c2410c;
}

.stat-line.quiet strong,
.stat-line.quiet .el-icon {
  color: #16a34a;
}

.control-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
}

.filters {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.definition-filter {
  width: 240px;
}

.keyword-filter {
  width: 320px;
}

.table-panel {
  padding: 12px;
}

.panel-title-row {
  min-height: 42px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.panel-title-row h3 {
  margin: 0;
  font-size: 15px;
  line-height: 1.3;
  color: #1f2937;
}

.panel-title-row p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
}

.table-progress {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.table-progress span {
  color: #64748b;
}

.table-progress strong {
  color: #1f2937;
}

.muted-action {
  color: #c0c4cc;
}

.business-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.4;
}

.business-cell small {
  color: #909399;
}

.smart-bi-action-context {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 12px;
  padding: 12px;
  border: 1px solid #d9ecff;
  border-radius: 8px;
  background: #f4f8ff;
}

.smart-bi-action-context__head,
.smart-bi-action-context__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.smart-bi-action-context__head span {
  color: #1f2937;
  font-size: 13px;
  font-weight: 650;
}

.smart-bi-action-context__title {
  color: #111827;
  font-size: 14px;
  line-height: 1.35;
}

.smart-bi-action-context__meta {
  justify-content: flex-start;
  flex-wrap: wrap;
  color: #64748b;
  font-size: 12px;
}

.smart-bi-action-context__meta span {
  padding: 2px 8px;
  border-radius: 999px;
  background: #ffffff;
}

.smart-bi-action-context__body {
  display: grid;
  gap: 6px;
}

.smart-bi-action-context__body p {
  margin: 0;
  color: #374151;
  font-size: 12px;
  line-height: 1.55;
}

.smart-bi-action-context__body p span {
  display: inline-block;
  min-width: 52px;
  color: #64748b;
  font-weight: 650;
}

.approval-form {
  margin-top: 14px;
}

:deep(.approval-row--focus) {
  --el-table-tr-bg-color: #f4f8ff;
}

:deep(.approval-row--smart-bi-focus) {
  --el-table-tr-bg-color: #ecf5ff;
}

:deep(.approval-row--smart-bi-focus td:first-child) {
  box-shadow: inset 3px 0 0 #409eff;
}

:deep(.approval-row--pending) {
  --el-table-tr-bg-color: #fffaf0;
}

@media (max-width: 960px) {
  .focus-board {
    grid-template-columns: minmax(0, 1fr);
  }

  .focus-side {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stat-line + .stat-line {
    border-top: 0;
  }

  .control-strip,
  .page-header,
  .focus-headline {
    align-items: stretch;
    flex-direction: column;
  }

  .filters,
  .header-actions {
    justify-content: flex-start;
  }

  .definition-filter,
  .keyword-filter {
    width: 100%;
  }

  .focus-item {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
