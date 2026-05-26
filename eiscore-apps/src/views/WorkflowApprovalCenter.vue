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
  </div>
</template>

<script setup>
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

const progressRows = computed(() => {
  const grouped = {}
  approvals.value.forEach((item) => {
    const instanceId = String(item?.instance_id || '').trim()
    const definitionId = String(item?.definition_id || '').trim()
    const taskId = String(item?.task_id || '').trim()
    if (!instanceId || !definitionId || !taskId) return
    const key = `${instanceId}::${taskId}`
    if (!grouped[key]) {
      grouped[key] = {
        key,
        instanceId,
        definitionId,
        taskId,
        latestAt: '',
        latestActor: '-',
        approvedActorSet: new Set()
      }
    }
    const bucket = grouped[key]
    if (String(item?.decision || '').toLowerCase() !== 'rejected') {
      const actor = String(item?.actor_username || '').trim()
      if (actor) bucket.approvedActorSet.add(actor)
    }
    const createdAt = String(item?.created_at || '').trim()
    if (!bucket.latestAt || Date.parse(createdAt) > Date.parse(bucket.latestAt)) {
      bucket.latestAt = createdAt
      bucket.latestActor = String(item?.actor_username || '').trim() || '-'
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
      const instance = instanceMap.value[bucket.instanceId] || {}
      const currentTask = String(instance?.current_task_id || '').trim()
      const instanceStatus = String(instance?.status || '').toUpperCase()
      const movedOn = Boolean(currentTask) && currentTask !== bucket.taskId
      const isCompleted = instanceStatus === 'COMPLETED'
      const pending = !isCompleted && !movedOn && approved < required
      const progressText = isCompleted ? '流程已完成' : (movedOn ? '已流转' : (pending ? '待会签' : '可推进'))
      const approvedActors = Array.from(bucket.approvedActorSet)
      const actorApproved = approvedActors.includes(String(currentActor.value?.username || '').trim())
      const actorCanExecute = canActorExecuteByAssignment(assignment)
      const myPending = pending && actorCanExecute && !actorApproved
      const myRelated = actorCanExecute || actorApproved

      return {
        key: bucket.key,
        instanceId: bucket.instanceId,
        definitionId: bucket.definitionId,
        definitionName: definitionNameMap.value[bucket.definitionId] || `流程定义#${bucket.definitionId}`,
        taskId: bucket.taskId,
        taskName: bucket.taskId,
        businessKey: String(instance?.business_key || '').trim() || '-',
        approvalMode: mode,
        approvalModeLabel: APPROVAL_MODE_LABEL_MAP[mode] || mode,
        approvedCount: approved,
        requiredApprovals: required,
        pending,
        myPending,
        myRelated,
        approvedActors,
        progressText,
        latestAt: bucket.latestAt,
        latestActor: bucket.latestActor
      }
    })
    .sort((a, b) => Date.parse(b.latestAt || '') - Date.parse(a.latestAt || ''))
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
    taskName: taskId,
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
  if (row?.pending) return 'warning'
  if (String(row?.progressText || '') === '流程已完成') return 'info'
  return 'success'
}

const goBack = () => router.push('/')

const loadData = async () => {
  loading.value = true
  try {
    const token = localStorage.getItem('auth_token')
    const headers = getWorkflowHeaders(token)
    const [definitionRes, instanceRes, assignmentRes, approvalRes] = await Promise.all([
      axios.get('/api/definitions?select=id,name,app_id,updated_at&order=id.desc&limit=500', { headers }),
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

@media (max-width: 960px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
