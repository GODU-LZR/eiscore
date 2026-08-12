<template>
  <div class="payroll-precheck-review">
    <header class="page-header">
      <div>
        <h2>薪资复核</h2>
        <p>读取已确认的月度考勤快照，作为薪资试算与复核的只读依据</p>
      </div>
      <div class="header-actions">
        <el-tag effect="plain">{{ lastLoadedAtText }}</el-tag>
        <el-button :icon="Refresh" :loading="queue.loading || results.loading || readyResults.loading" @click="loadAll">刷新</el-button>
      </div>
    </header>

    <section class="metric-row">
      <article class="metric-card">
        <span>待复核快照</span>
        <strong>{{ queue.unavailable ? '-' : queue.total }}</strong>
        <small>已确认并提交前置</small>
      </article>
      <article class="metric-card">
        <span>考勤记录</span>
        <strong>{{ summary.recordCount }}</strong>
        <small>当前列表合计</small>
      </article>
      <article class="metric-card">
        <span>请假/缺勤</span>
        <strong>{{ summary.leaveCount }} / {{ summary.absentCount }}</strong>
        <small>当前列表合计</small>
      </article>
      <article class="metric-card">
        <span>加班</span>
        <strong>{{ formatMinutes(summary.overtimeMinutes) }}</strong>
        <small>当前列表合计</small>
      </article>
      <article class="metric-card">
        <span>试算结果</span>
        <strong>{{ results.unavailable ? '-' : results.total }}</strong>
        <small>独立结果表</small>
      </article>
      <article class="metric-card">
        <span>薪资引用</span>
        <strong>{{ readyResults.unavailable ? '-' : readyResults.total }}</strong>
        <small>已通过只读结果</small>
      </article>
    </section>

    <section class="review-panel">
      <div class="panel-head">
        <div>
          <h3>考勤只读引用</h3>
          <p>薪资核算只引用这里的快照，不直接修改 AI 入库记录或薪资结果</p>
        </div>
        <el-tag type="info" effect="plain">no_payroll_mutation=true</el-tag>
      </div>

      <el-alert
        v-if="queue.unavailable"
        type="warning"
        show-icon
        :closable="false"
        class="inline-alert"
        :title="queue.unavailableReason || '薪资前置考勤快照视图尚未部署'"
      />

      <div class="filter-strip">
        <el-input v-model="filters.month" clearable placeholder="月份 2026-06" class="filter-small" />
        <el-input v-model="filters.employeeNo" clearable placeholder="员工编号" class="filter-small" />
        <el-input v-model="filters.employeeName" clearable placeholder="员工姓名" class="filter-small" />
        <el-input v-model="filters.deptName" clearable placeholder="部门" class="filter-small" />
        <el-input v-model="filters.uploadedBy" clearable placeholder="上传人" class="filter-small" />
        <el-input v-model="filters.uploadedByRole" clearable placeholder="岗位 / 角色" class="filter-small" />
        <el-select v-model="filters.uploadSource" clearable placeholder="上传来源" class="filter-small">
          <el-option label="桌面端" value="collector_desktop" />
          <el-option label="桌面端分片" value="collector_desktop_chunked" />
          <el-option label="监听目录" value="watch_folder" />
          <el-option label="网页拖拽" value="web_drag_drop" />
          <el-option label="手动上传" value="manual_upload" />
        </el-select>
        <el-select v-model="filters.operatorSource" clearable placeholder="归属来源" class="filter-small">
          <el-option label="网页登录用户" value="web_login_user" />
          <el-option label="设备默认用户" value="device_default_user" />
          <el-option label="手动指定用户" value="manual_selected_user" />
          <el-option label="目录默认用户" value="folder_binding_user" />
          <el-option label="未知上传人" value="unknown" />
        </el-select>
        <el-select v-model="filters.duplicateBusinessSource" clearable placeholder="业务重复" class="filter-small">
          <el-option label="重复业务来源" value="true" />
          <el-option label="正式业务来源" value="false" />
        </el-select>
        <el-input v-model="filters.sourceFolder" clearable placeholder="来源目录" class="filter-small" />
        <el-input v-model="filters.search" clearable placeholder="员工 / 文件 / hash" class="filter-grow">
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" :loading="queue.loading || results.loading || readyResults.loading" @click="loadAll">查询</el-button>
        <el-button :disabled="queue.loading || results.loading || readyResults.loading" @click="resetFiltersAndLoad">重置</el-button>
      </div>

      <el-table
        v-loading="queue.loading"
        :data="queue.items"
        size="small"
        border
        empty-text="暂无薪资前置考勤快照"
      >
        <el-table-column label="员工月份" min-width="210" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="main-cell">
              <span>{{ row.employeeName || '-' }}</span>
              <small>{{ row.employeeNo || row.employeeId || '-' }} / {{ row.month || '-' }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="部门" min-width="130" show-overflow-tooltip>
          <template #default="{ row }">{{ row.deptName || '-' }}</template>
        </el-table-column>
        <el-table-column prop="recordCount" label="记录" width="78" align="right" />
        <el-table-column prop="leaveCount" label="请假" width="78" align="right" />
        <el-table-column prop="absentCount" label="缺勤" width="78" align="right" />
        <el-table-column prop="lateCount" label="迟到" width="78" align="right" />
        <el-table-column prop="earlyCount" label="早退" width="78" align="right" />
        <el-table-column label="加班" width="92" align="right">
          <template #default="{ row }">{{ formatMinutes(row.overtimeMinutes) }}</template>
        </el-table-column>
        <el-table-column label="确认/提交" min-width="230" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="main-cell">
              <span>{{ row.confirmedBy || '-' }} / {{ formatDateTime(row.confirmedAt) }}</span>
              <small>{{ row.payrollPrecheckRequestedBy || '-' }} / {{ formatDateTime(row.payrollPrecheckRequestedAt) }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="来源文件" min-width="230" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="main-cell">
              <span>{{ row.sourceFilename || '-' }}</span>
              <small>{{ sourceFileTraceText(row) }}</small>
              <el-tag
                v-if="hasBusinessSourceTrace(row)"
                size="small"
                :type="row.duplicateBusinessSource ? 'warning' : 'success'"
                effect="plain"
              >
                {{ row.duplicateBusinessSource ? '重复业务来源' : '正式业务来源' }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="上传归属" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="main-cell">
              <span>{{ uploadOwnerText(row) }}</span>
              <small>{{ uploadOwnerSubText(row) }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="来源设备" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="main-cell">
              <span>{{ row.deviceName || row.deviceCode || '-' }}</span>
              <small>{{ uploadSourceText(row.uploadSource) }} / {{ row.batchStatus || '-' }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="薪资引用键" min-width="230" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="main-cell">
              <span>{{ row.employeeMonthKey || '-' }}</span>
              <small>{{ row.snapshotId || '-' }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="边界" width="120">
          <template #default="{ row }">
            <el-tag :type="row.payrollMutationAllowed ? 'danger' : 'info'" effect="plain" size="small">
              {{ row.payrollMutationAllowed ? '可写薪资' : '只读引用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              plain
              :loading="Boolean(generatingSnapshotIds[row.snapshotId || row.id])"
              @click="generateTrial(row)"
            >
              生成试算
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager-row">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[20, 50, 100, 200]"
          :total="queue.total"
          @current-change="loadQueue"
          @size-change="loadQueue"
        />
      </div>
    </section>

    <section class="review-panel result-panel">
      <div class="panel-head">
        <div>
          <h3>试算/复核结果</h3>
          <p>结果保存到独立前置表，仅用于复核与后续薪资流程引用</p>
        </div>
        <el-tag type="success" effect="plain">正式薪资未写入</el-tag>
      </div>

      <el-alert
        v-if="results.unavailable"
        type="warning"
        show-icon
        :closable="false"
        class="inline-alert"
        :title="results.unavailableReason || '薪资前置试算结果表尚未部署'"
      />

      <el-table
        v-loading="results.loading"
        :data="results.items"
        size="small"
        border
        empty-text="暂无试算结果"
      >
        <el-table-column label="员工月份" min-width="210" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="main-cell">
              <span>{{ row.employeeName || '-' }}</span>
              <small>{{ row.employeeNo || row.employeeId || '-' }} / {{ row.month || '-' }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="trialStatusType(row.trialStatus)" effect="plain" size="small">
              {{ trialStatusText(row.trialStatus) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="考勤摘要" min-width="180">
          <template #default="{ row }">
            <div class="main-cell">
              <span>记录 {{ row.recordCount }} / 请假 {{ row.leaveCount }} / 缺勤 {{ row.absentCount }}</span>
              <small>迟到 {{ row.lateCount }} / 早退 {{ row.earlyCount }} / 加班 {{ formatMinutes(row.overtimeMinutes) }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="生成信息" min-width="210" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="main-cell">
              <span>{{ row.generatedBy || '-' }}</span>
              <small>{{ formatDateTime(row.generatedAt) }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="来源文件" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="main-cell">
              <span>{{ row.sourceFilename || '-' }}</span>
              <small>{{ sourceFileTraceText(row) }}</small>
              <el-tag
                v-if="hasBusinessSourceTrace(row)"
                size="small"
                :type="row.duplicateBusinessSource ? 'warning' : 'success'"
                effect="plain"
              >
                {{ row.duplicateBusinessSource ? '重复业务来源' : '正式业务来源' }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="上传归属" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="main-cell">
              <span>{{ uploadOwnerText(row) }}</span>
              <small>{{ uploadOwnerSubText(row) }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="引用键" min-width="230" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="main-cell">
              <span>{{ row.employeeMonthKey || '-' }}</span>
              <small>{{ row.snapshotId || '-' }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="边界" width="128">
          <template #default="{ row }">
            <el-tag :type="row.noPayrollMutation ? 'success' : 'danger'" effect="plain" size="small">
              {{ row.noPayrollMutation ? '不写薪资' : '需阻断' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="230" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button
                size="small"
                type="primary"
                plain
                :loading="sourceTrace.loading && sourceTrace.activeResultId === row.id"
                @click="traceResultSource(row)"
              >
                来源
              </el-button>
              <el-button
                v-if="canApproveResult(row)"
                size="small"
                type="success"
                plain
                :loading="Boolean(resultActionKeys[`${row.id}:approved`])"
                @click="updateTrialResult(row, 'approved')"
              >
                复核通过
              </el-button>
              <el-button
                v-if="canRejectResult(row)"
                size="small"
                type="danger"
                plain
                :loading="Boolean(resultActionKeys[`${row.id}:rejected`])"
                @click="updateTrialResult(row, 'rejected')"
              >
                退回
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager-row">
        <el-pagination
          v-model:current-page="resultPage"
          v-model:page-size="resultPageSize"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[20, 50, 100, 200]"
          :total="results.total"
          @current-change="loadResults"
          @size-change="loadResults"
        />
      </div>
    </section>

    <section class="review-panel result-panel">
      <div class="panel-head">
        <div>
          <h3>薪资模块只读引用</h3>
          <p>仅展示已复核通过的试算结果，正式薪资模块可从这里读取依据</p>
        </div>
        <el-tag type="success" effect="plain">payroll_mutation_allowed=false</el-tag>
      </div>

      <el-alert
        v-if="readyResults.unavailable"
        type="warning"
        show-icon
        :closable="false"
        class="inline-alert"
        :title="readyResults.unavailableReason || '薪资模块只读引用视图尚未部署'"
      />

      <el-table
        v-loading="readyResults.loading"
        :data="readyResults.items"
        size="small"
        border
        empty-text="暂无已通过薪资前置结果"
      >
        <el-table-column label="员工月份" min-width="210" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="main-cell">
              <span>{{ row.employeeName || '-' }}</span>
              <small>{{ row.employeeNo || row.employeeId || '-' }} / {{ row.month || '-' }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="考勤摘要" min-width="180">
          <template #default="{ row }">
            <div class="main-cell">
              <span>记录 {{ row.recordCount }} / 请假 {{ row.leaveCount }} / 缺勤 {{ row.absentCount }}</span>
              <small>加班 {{ formatMinutes(row.overtimeMinutes) }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="复核信息" min-width="210" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="main-cell">
              <span>{{ row.reviewedBy || '-' }}</span>
              <small>{{ formatDateTime(row.reviewedAt) }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="来源文件" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="main-cell">
              <span>{{ row.sourceFilename || '-' }}</span>
              <small>{{ sourceFileTraceText(row) }}</small>
              <el-tag
                v-if="hasBusinessSourceTrace(row)"
                size="small"
                :type="row.duplicateBusinessSource ? 'warning' : 'success'"
                effect="plain"
              >
                {{ row.duplicateBusinessSource ? '重复业务来源' : '正式业务来源' }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="上传归属" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="main-cell">
              <span>{{ uploadOwnerText(row) }}</span>
              <small>{{ uploadOwnerSubText(row) }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="薪资引用键" min-width="230" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="main-cell">
              <span>{{ row.employeeMonthKey || '-' }}</span>
              <small>{{ row.payrollReference?.reference_table || 'hr.v_payroll_ready_precheck_results' }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="边界" width="128">
          <template #default="{ row }">
            <el-tag :type="row.payrollMutationAllowed ? 'danger' : 'success'" effect="plain" size="small">
              {{ row.payrollMutationAllowed ? '可写薪资' : '只读引用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="86" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              plain
              :loading="sourceTrace.loading && sourceTrace.activeResultId === row.id"
              @click="traceResultSource(row)"
            >
              来源
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pager-row">
        <el-pagination
          v-model:current-page="readyPage"
          v-model:page-size="readyPageSize"
          layout="total, sizes, prev, pager, next"
          :page-sizes="[20, 50, 100, 200]"
          :total="readyResults.total"
          @current-change="loadReadyResults"
          @size-change="loadReadyResults"
        />
      </div>
    </section>

    <el-dialog v-model="sourceTrace.visible" title="来源追溯" width="860px" class="source-trace-dialog">
      <div class="source-trace-head">
        <div>
          <strong>{{ sourceTrace.title || '-' }}</strong>
          <small>{{ sourceTrace.total }} 条来源记录</small>
        </div>
        <el-tag effect="plain">{{ sourceTrace.filters.duplicateBusinessSource === 'true' ? '重复业务来源' : '正式业务来源' }}</el-tag>
      </div>
      <el-table
        v-loading="sourceTrace.loading"
        :data="sourceTrace.items"
        size="small"
        border
        empty-text="暂无来源记录"
      >
        <el-table-column label="业务记录" min-width="220" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="main-cell">
              <span>{{ row.businessLink?.targetRecordId || '-' }}</span>
              <small>{{ row.businessLink?.targetSchema || row.businessLink?.targetAppId || '-' }} / {{ row.businessLink?.targetTable || '-' }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="来源文件" min-width="240" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="main-cell">
              <span>{{ row.asset?.originalFilename || '-' }}</span>
              <small>{{ row.asset?.fileHash || '-' }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="上传归属" min-width="150" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="main-cell">
              <span>{{ uploadOwnerText(row.asset) }}</span>
              <small>{{ uploadOwnerSubText(row.asset) }}</small>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="批次" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="main-cell">
              <span>{{ row.asset?.batchNo || '-' }}</span>
              <small>{{ uploadSourceText(row.asset?.uploadSource) }} / {{ row.asset?.batchStatus || '-' }}</small>
            </div>
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, Search } from '@element-plus/icons-vue'
import { getToken } from '@/utils/auth'

const queue = reactive({
  loading: false,
  total: 0,
  items: [],
  unavailable: false,
  unavailableReason: ''
})
const results = reactive({
  loading: false,
  total: 0,
  items: [],
  unavailable: false,
  unavailableReason: ''
})
const readyResults = reactive({
  loading: false,
  total: 0,
  items: [],
  unavailable: false,
  unavailableReason: ''
})
const sourceTrace = reactive({
  visible: false,
  loading: false,
  activeResultId: '',
  title: '',
  total: 0,
  items: [],
  filters: {}
})
const generatingSnapshotIds = reactive({})
const resultActionKeys = reactive({})
const filters = reactive({
  month: '',
  employeeNo: '',
  employeeName: '',
  deptName: '',
  uploadedBy: '',
  uploadedByRole: '',
  uploadSource: '',
  operatorSource: '',
  duplicateBusinessSource: '',
  sourceFolder: '',
  search: ''
})
const page = ref(1)
const pageSize = ref(50)
const resultPage = ref(1)
const resultPageSize = ref(50)
const readyPage = ref(1)
const readyPageSize = ref(50)
const lastLoadedAt = ref('')

const lastLoadedAtText = computed(() => lastLoadedAt.value ? `刷新于 ${formatTimeOnly(lastLoadedAt.value)}` : '尚未刷新')

const summary = computed(() => queue.items.reduce((acc, row) => {
  acc.recordCount += Number(row.recordCount || 0)
  acc.leaveCount += Number(row.leaveCount || 0)
  acc.absentCount += Number(row.absentCount || 0)
  acc.overtimeMinutes += Number(row.overtimeMinutes || 0)
  return acc
}, {
  recordCount: 0,
  leaveCount: 0,
  absentCount: 0,
  overtimeMinutes: 0
}))

const agentRequest = async (path, options = {}) => {
  const token = getToken()
  const method = options.method || 'GET'
  const hasBody = options.body !== undefined
  const response = await fetch(`/agent${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    ...(hasBody ? { body: JSON.stringify(options.body) } : {})
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload?.message || payload?.code || `请求失败(${response.status})`)
  }
  return payload
}

const toQuery = (params) => {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    query.set(key, String(value))
  })
  const text = query.toString()
  return text ? `?${text}` : ''
}

const loadQueue = async () => {
  queue.loading = true
  try {
    const query = toQuery({
      month: filters.month,
      employeeNo: filters.employeeNo,
      employeeName: filters.employeeName,
      deptName: filters.deptName,
      uploadedBy: filters.uploadedBy,
      uploadedByRole: filters.uploadedByRole,
      uploadSource: filters.uploadSource,
      operatorSource: filters.operatorSource,
      duplicateBusinessSource: filters.duplicateBusinessSource,
      sourceFolder: filters.sourceFolder,
      search: filters.search,
      limit: pageSize.value,
      offset: (page.value - 1) * pageSize.value
    })
    const payload = await agentRequest(`/document-intake/admin/hr-payroll-precheck-snapshots${query}`)
    queue.total = payload.total || 0
    queue.items = payload.items || []
    queue.unavailable = Boolean(payload.unavailable)
    queue.unavailableReason = payload.unavailableReason || ''
    lastLoadedAt.value = new Date().toISOString()
  } catch (error) {
    ElMessage.error(`薪资前置快照加载失败：${error.message}`)
  } finally {
    queue.loading = false
  }
}

const loadResults = async () => {
  results.loading = true
  try {
    const query = toQuery({
      month: filters.month,
      employeeNo: filters.employeeNo,
      employeeName: filters.employeeName,
      deptName: filters.deptName,
      uploadedBy: filters.uploadedBy,
      uploadedByRole: filters.uploadedByRole,
      uploadSource: filters.uploadSource,
      operatorSource: filters.operatorSource,
      duplicateBusinessSource: filters.duplicateBusinessSource,
      sourceFolder: filters.sourceFolder,
      search: filters.search,
      limit: resultPageSize.value,
      offset: (resultPage.value - 1) * resultPageSize.value
    })
    const payload = await agentRequest(`/document-intake/admin/hr-payroll-precheck-results${query}`)
    results.total = payload.total || 0
    results.items = payload.items || []
    results.unavailable = Boolean(payload.unavailable)
    results.unavailableReason = payload.unavailableReason || ''
    lastLoadedAt.value = new Date().toISOString()
  } catch (error) {
    ElMessage.error(`薪资试算结果加载失败：${error.message}`)
  } finally {
    results.loading = false
  }
}

const loadReadyResults = async () => {
  readyResults.loading = true
  try {
    const query = toQuery({
      month: filters.month,
      employeeNo: filters.employeeNo,
      employeeName: filters.employeeName,
      deptName: filters.deptName,
      uploadedBy: filters.uploadedBy,
      uploadedByRole: filters.uploadedByRole,
      uploadSource: filters.uploadSource,
      operatorSource: filters.operatorSource,
      duplicateBusinessSource: filters.duplicateBusinessSource,
      sourceFolder: filters.sourceFolder,
      search: filters.search,
      limit: readyPageSize.value,
      offset: (readyPage.value - 1) * readyPageSize.value
    })
    const payload = await agentRequest(`/document-intake/admin/hr-payroll-ready-precheck-results${query}`)
    readyResults.total = payload.total || 0
    readyResults.items = payload.items || []
    readyResults.unavailable = Boolean(payload.unavailable)
    readyResults.unavailableReason = payload.unavailableReason || ''
    lastLoadedAt.value = new Date().toISOString()
  } catch (error) {
    ElMessage.error(`薪资只读引用加载失败：${error.message}`)
  } finally {
    readyResults.loading = false
  }
}

const loadAll = async () => {
  await Promise.all([loadQueue(), loadResults(), loadReadyResults()])
}

const resetFilters = (values = {}) => {
  Object.assign(filters, {
    month: '',
    employeeNo: '',
    employeeName: '',
    deptName: '',
    uploadedBy: '',
    uploadedByRole: '',
    uploadSource: '',
    operatorSource: '',
    duplicateBusinessSource: '',
    sourceFolder: '',
    search: '',
    ...values
  })
}

const resetFiltersAndLoad = async () => {
  resetFilters()
  page.value = 1
  resultPage.value = 1
  readyPage.value = 1
  await loadAll()
}

const generateTrial = async (row) => {
  const snapshotId = row.snapshotId || row.id
  if (!snapshotId) return
  generatingSnapshotIds[snapshotId] = true
  try {
    await agentRequest(`/document-intake/admin/hr-payroll-precheck-snapshots/${encodeURIComponent(snapshotId)}/trial`, {
      method: 'POST',
      body: {
        action: 'generate_trial',
        note: '由薪资复核页生成试算'
      }
    })
    ElMessage.success('已生成薪资试算结果')
    await Promise.all([loadResults(), loadReadyResults()])
  } catch (error) {
    ElMessage.error(`生成试算失败：${error.message}`)
  } finally {
    delete generatingSnapshotIds[snapshotId]
  }
}

const canApproveResult = (row) => ['draft', 'reviewed'].includes(row?.trialStatus || '')
const canRejectResult = (row) => ['draft', 'reviewed'].includes(row?.trialStatus || '')

const cleanValue = (value) => String(value || '').trim()

const hasBusinessSourceTrace = (row = {}) => {
  const reference = row.sourceSnapshotReference || {}
  return Boolean(
    row.lastBusinessLinkId ||
      row.businessLinkId ||
      reference.last_business_link_id ||
      reference.lastBusinessLinkId
  )
}

const buildResultSourceFilters = (row = {}) => {
  const reference = row.sourceSnapshotReference || {}
  const filters = {
    businessLinkId: cleanValue(row.lastBusinessLinkId || row.businessLinkId || reference.last_business_link_id || reference.lastBusinessLinkId),
    targetSchema: cleanValue(row.sourceTargetSchema || row.targetSchema || reference.source_target_schema || reference.targetSchema),
    targetTable: cleanValue(row.sourceTargetTable || row.targetTable || reference.source_target_table || reference.targetTable),
    targetRecordId: cleanValue(row.sourceTargetRecordId || row.targetRecordId || reference.source_target_record_id || reference.targetRecordId),
    uploadedBy: cleanValue(row.uploadedByUsername || row.uploadedByUserId || reference.uploaded_by_username || reference.uploadedByUsername || reference.uploaded_by_user_id || reference.uploadedByUserId),
    uploadedByRole: cleanValue(row.uploadedByRole || reference.uploaded_by_role || reference.uploadedByRole),
    uploadSource: cleanValue(row.uploadSource || reference.upload_source || reference.uploadSource),
    operatorSource: cleanValue(row.operatorSource || reference.operator_source || reference.operatorSource),
    sourceFolder: cleanValue(row.sourceFolder || reference.source_folder || reference.sourceFolder)
  }
  if (typeof row.duplicateBusinessSource === 'boolean') {
    filters.duplicateBusinessSource = row.duplicateBusinessSource ? 'true' : 'false'
  } else if (typeof reference.duplicate_business_source === 'boolean') {
    filters.duplicateBusinessSource = reference.duplicate_business_source ? 'true' : 'false'
  } else if (typeof reference.duplicateBusinessSource === 'boolean') {
    filters.duplicateBusinessSource = reference.duplicateBusinessSource ? 'true' : 'false'
  }
  return filters
}

const hasResultSourceLocator = (filters) => {
  if (filters.businessLinkId) return true
  return Boolean(filters.targetSchema && filters.targetTable && filters.targetRecordId)
}

const traceResultSource = async (row = {}) => {
  const filters = buildResultSourceFilters(row)
  if (!hasResultSourceLocator(filters)) {
    ElMessage.warning('该试算结果缺少可追溯来源')
    return
  }
  sourceTrace.visible = true
  sourceTrace.loading = true
  sourceTrace.activeResultId = row.id || ''
  sourceTrace.title = `${row.employeeName || row.employeeNo || '试算结果'} / ${row.month || '-'}`
  sourceTrace.items = []
  sourceTrace.total = 0
  sourceTrace.filters = filters
  try {
    const query = toQuery({
      ...filters,
      limit: 50,
      offset: 0
    })
    const payload = await agentRequest(`/document-intake/admin/business-sources${query}`)
    sourceTrace.items = payload.items || []
    sourceTrace.total = payload.total || sourceTrace.items.length
  } catch (error) {
    ElMessage.error(`来源追溯失败：${error.message}`)
  } finally {
    sourceTrace.loading = false
    sourceTrace.activeResultId = ''
  }
}

const updateTrialResult = async (row, status) => {
  const resultId = row?.id || ''
  if (!resultId) return
  const actionKey = `${resultId}:${status}`
  let note = '薪资复核页复核通过'
  try {
    if (status === 'rejected') {
      const promptResult = await ElMessageBox.prompt('请输入退回原因', '退回薪资试算', {
        confirmButtonText: '退回',
        cancelButtonText: '取消',
        inputType: 'textarea',
        inputValidator: (value) => Boolean(String(value || '').trim()),
        inputErrorMessage: '需要填写退回原因'
      })
      note = String(promptResult.value || '').trim()
    } else {
      await ElMessageBox.confirm('确认该试算结果复核通过？通过后将进入薪资模块只读引用视图。', '复核通过', {
        confirmButtonText: '通过',
        cancelButtonText: '取消',
        type: 'warning'
      })
    }

    resultActionKeys[actionKey] = true
    await agentRequest(`/document-intake/admin/hr-payroll-precheck-results/${encodeURIComponent(resultId)}/action`, {
      method: 'POST',
      body: {
        action: status === 'rejected' ? 'reject' : 'approve',
        note
      }
    })
    ElMessage.success(status === 'rejected' ? '已退回薪资试算结果' : '薪资试算结果已复核通过')
    await Promise.all([loadResults(), loadReadyResults()])
  } catch (error) {
    if (error === 'cancel' || error === 'close') return
    ElMessage.error(`试算结果复核失败：${error.message || error}`)
  } finally {
    delete resultActionKeys[actionKey]
  }
}

const trialStatusText = (status) => ({
  draft: '待复核',
  reviewed: '已复核',
  approved: '已通过',
  rejected: '已退回'
})[status] || status || '-'

const trialStatusType = (status) => ({
  draft: 'warning',
  reviewed: 'info',
  approved: 'success',
  rejected: 'danger'
})[status] || 'info'

const formatMinutes = (value) => {
  const numeric = Number(value)
  if (!Number.isFinite(numeric) || numeric <= 0) return '0h'
  const hours = Math.round((numeric / 60) * 10) / 10
  return `${hours}h`
}

const uploadSourceText = (source) => ({
  collector_desktop: '桌面端',
  collector_desktop_chunked: '桌面端分片',
  watch_folder: '监听目录',
  web_drag_drop: '网页拖拽',
  manual_upload: '手动上传'
})[source] || source || '-'

const operatorSourceText = (source) => ({
  web_login_user: '网页登录用户',
  device_default_user: '设备默认用户',
  manual_selected_user: '手动指定用户',
  folder_binding_user: '目录默认用户',
  unknown: '未知上传人'
})[source] || source || '-'

const uploadOwnerText = (row) => row?.uploadedByUsername || row?.uploadedByUserId || '-'
const uploadOwnerSubText = (row) => {
  const role = row?.uploadedByRole || '-'
  return `${role} / ${operatorSourceText(row?.operatorSource)}`
}

const sourceFileTraceText = (row) => {
  const folder = String(row?.sourceFolder || '').trim()
  const trace = String(row?.fileHash || row?.batchNo || '').trim()
  return [folder, trace].filter(Boolean).join(' / ') || '-'
}

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('zh-CN', { hour12: false })
}

const formatTimeOnly = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

onMounted(() => {
  loadAll()
})
</script>

<style scoped>
.payroll-precheck-review {
  min-height: 100vh;
  padding: 20px;
  box-sizing: border-box;
  background: #f6f7fb;
  color: #1f2937;
}

.page-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  margin-bottom: 16px;
}

.page-header h2 {
  margin: 0 0 6px;
  font-size: 22px;
  line-height: 28px;
}

.page-header p,
.panel-head p {
  margin: 0;
  color: #64748b;
  font-size: 13px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.metric-row {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 10px;
  margin-bottom: 14px;
}

.metric-card {
  min-width: 0;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  box-sizing: border-box;
}

.metric-card span,
.metric-card small {
  display: block;
  color: #64748b;
  font-size: 12px;
}

.metric-card strong {
  display: block;
  margin: 8px 0 4px;
  font-size: 24px;
  line-height: 30px;
  color: #111827;
}

.review-panel {
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.result-panel {
  margin-top: 14px;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
}

.panel-head h3 {
  margin: 0 0 5px;
  font-size: 16px;
  line-height: 22px;
}

.inline-alert {
  margin-bottom: 12px;
}

.filter-strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.filter-small {
  width: 160px;
  flex: 0 0 160px;
}

.filter-grow {
  min-width: 200px;
  flex: 1;
}

.main-cell {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.main-cell span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.main-cell small {
  color: #909399;
  font-size: 12px;
}

.table-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.pager-row {
  display: flex;
  justify-content: flex-end;
  margin-top: 12px;
}

@media (max-width: 960px) {
  .metric-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .page-header {
    flex-direction: column;
  }
}
</style>
