<template>
  <div class="approval-center">
    <div class="page-header">
      <div class="header-left">
        <el-button text :icon="ArrowLeft" @click="goBack">返回</el-button>
        <div class="header-text">
          <h2>审批中心</h2>
          <p>跨流程查看会签进度与审批意见</p>
        </div>
      </div>
      <div class="header-actions">
        <el-button :icon="Refresh" :loading="loading" @click="loadData">刷新</el-button>
      </div>
    </div>

    <el-card class="summary-panel" shadow="never">
      <div class="summary-grid">
        <div class="summary-item">
          <div class="summary-label">会签节点</div>
          <div class="summary-value">{{ summary.totalProgress }}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">待会签</div>
          <div class="summary-value warning">{{ summary.pendingProgress }}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">审批记录</div>
          <div class="summary-value">{{ summary.totalApprovals }}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">流程单</div>
          <div class="summary-value">{{ summary.instanceCount }}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">我的待办</div>
          <div class="summary-value warning">{{ summary.myPendingCount }}</div>
        </div>
      </div>
    </el-card>

    <el-card class="filter-panel" shadow="never">
      <div class="filters">
        <el-select
          v-model="filters.definitionId"
          clearable
          filterable
          placeholder="按流程定义筛选"
          style="width: 280px"
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
          placeholder="搜索流程单号 / 任务 / 审批人 / 业务单号"
          style="width: 320px"
        />
        <el-switch
          v-model="filters.pendingOnly"
          active-text="仅待会签"
          inactive-text="全部记录"
        />
        <el-switch
          v-model="filters.myFirst"
          active-text="我的待办优先"
          inactive-text="普通排序"
        />
        <el-switch
          v-model="filters.myRelatedOnly"
          active-text="仅我相关"
          inactive-text="全部人员"
        />
      </div>
    </el-card>

    <el-card class="table-panel" shadow="never">
      <template #header>
        <div class="panel-head">会签进度</div>
      </template>
      <el-table v-loading="loading" :data="filteredProgressRows" size="small" border>
        <el-table-column prop="instanceId" label="流程单号" min-width="90" />
        <el-table-column prop="definitionName" label="流程定义" min-width="170" />
        <el-table-column prop="taskName" label="任务节点" min-width="170" />
        <el-table-column prop="businessKey" label="业务单号" min-width="170" />
        <el-table-column prop="approvalModeLabel" label="审批模式" min-width="120" />
        <el-table-column label="进度" min-width="120">
          <template #default="{ row }">
            {{ row.approvedCount }}/{{ row.requiredApprovals }}
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
        <el-table-column label="操作" fixed="right" min-width="110">
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
    </el-card>

    <el-card class="table-panel" shadow="never">
      <template #header>
        <div class="panel-head">审批意见明细</div>
      </template>
      <el-table v-loading="loading" :data="filteredApprovalRows" size="small" border>
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
    </el-card>

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
        <el-descriptions-item label="会签进度">
          {{ approvalDialog.row.approvedCount }}/{{ approvalDialog.row.requiredApprovals }}
        </el-descriptions-item>
      </el-descriptions>

      <el-form class="approval-form" label-width="84px">
        <el-form-item label="处理结果">
          <el-radio-group v-model="approvalForm.decision">
            <el-radio-button label="approved">同意</el-radio-button>
            <el-radio-button label="rejected">驳回</el-radio-button>
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
            :placeholder="approvalDialog.row?.requireComment ? '当前节点要求填写审批意见' : '可填写审批意见'"
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

import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft, Refresh } from '@element-plus/icons-vue'
import axios from 'axios'

const router = useRouter()

const loading = ref(false)
const definitions = ref([])
const instances = ref([])
const assignments = ref([])
const approvals = ref([])
const currentActor = ref({ username: '', appRole: '' })
const approvalSubmitting = ref(false)

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

const APPROVAL_MODE_LABEL_MAP = Object.freeze({
  any: '单人通过',
  quota: '多人会签',
  all: '全员会签'
})

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

const normalizeStringList = (value) => {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item || '').trim()).filter(Boolean)
}

const normalizeApprovalMode = (value) => {
  const mode = String(value || '').trim().toLowerCase()
  if (mode === 'quota' || mode === 'all') return mode
  return 'any'
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
      const actorCanExecute = canActorExecuteByAssignment(assignment)
      const myPending = pending && actorCanExecute && !actorReviewed
      const myRelated = actorCanExecute || actorReviewed

      return {
        key: bucket.key,
        instanceId: bucket.instanceId,
        definitionId: bucket.definitionId,
        definitionName: definitionNameMap.value[bucket.definitionId] || `流程定义#${bucket.definitionId}`,
        taskId: bucket.taskId,
        taskName: getTaskName(bucket.definitionId, bucket.taskId),
        businessKey: String(instance?.business_key || '').trim() || '-',
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

const goBack = () => router.push('/')

const resetApprovalDialog = () => {
  approvalDialog.row = null
  approvalForm.decision = 'approved'
  approvalForm.nextTaskId = ''
  approvalForm.comment = ''
}

const openApprovalDialog = (row) => {
  approvalDialog.row = row
  approvalForm.decision = 'approved'
  approvalForm.comment = ''
  approvalForm.nextTaskId = getTransitionOptions(row)?.[0]?.value || '__complete__'
  approvalDialog.visible = true
}

const submitApproval = async () => {
  const row = approvalDialog.row
  if (!row?.instanceId) return

  const comment = String(approvalForm.comment || '').trim()
  if (row.requireComment && !comment) {
    ElMessage.warning('当前节点要求填写审批意见')
    return
  }

  approvalSubmitting.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const headers = {
      ...getWorkflowHeaders(token),
      'Content-Type': 'application/json'
    }
    if (approvalForm.decision === 'rejected') {
      await axios.post(
        '/api/rpc/reject_workflow_task',
        {
          p_instance_id: Number(row.instanceId),
          p_comment: comment || null,
          p_variables: comment ? { approval_comment: comment } : {}
        },
        { headers }
      )
      ElMessage.success('已驳回流程单')
    } else {
      const nextTaskId = String(approvalForm.nextTaskId || '').trim()
      if (!nextTaskId) {
        ElMessage.warning('请选择下一步')
        return
      }
      const complete = nextTaskId === '__complete__'
      const response = await axios.post(
        '/api/rpc/transition_workflow_instance',
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
    const [definitionRes, instanceRes, assignmentRes, approvalRes] = await Promise.all([
      axios.get('/api/definitions?select=id,name,app_id,bpmn_xml,updated_at&order=id.desc&limit=500', { headers }),
      axios.get('/api/instances?select=id,definition_id,current_task_id,status,business_key,started_at,ended_at&order=id.desc&limit=2000', { headers }),
      axios.get('/api/task_assignments?select=id,definition_id,task_id,candidate_roles,candidate_users,approval_mode,required_approvals,require_comment&order=id.desc&limit=2000', { headers }),
      axios.get('/api/task_approvals?select=id,instance_id,definition_id,task_id,actor_username,actor_role,decision,comment,payload,created_at,updated_at&order=created_at.desc&limit=5000', { headers })
    ])
    definitions.value = Array.isArray(definitionRes.data) ? definitionRes.data : []
    instances.value = Array.isArray(instanceRes.data) ? instanceRes.data : []
    assignments.value = Array.isArray(assignmentRes.data) ? assignmentRes.data : []
    approvals.value = Array.isArray(approvalRes.data) ? approvalRes.data : []
  } catch (error) {
    ElMessage.error(`加载审批中心数据失败：${error?.response?.data?.message || error?.message || '未知错误'}`)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  readCurrentActor()
  loadData()
})
</script>

<style scoped>
.approval-center {
  padding: 16px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #f5f7fb;
  box-sizing: border-box;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-text h2 {
  margin: 0;
  font-size: 20px;
  color: #303133;
}

.header-text p {
  margin: 4px 0 0;
  color: #909399;
  font-size: 12px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.summary-item {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  padding: 12px;
}

.summary-label {
  font-size: 12px;
  color: #909399;
}

.summary-value {
  margin-top: 6px;
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}

.summary-value.warning {
  color: #e6a23c;
}

.filters {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.panel-head {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.muted-action {
  color: #c0c4cc;
}

.approval-form {
  margin-top: 14px;
}

@media (max-width: 960px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
