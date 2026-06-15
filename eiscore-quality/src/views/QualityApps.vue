<template>
  <div class="quality-apps" data-guide="app-list-page">
    <div class="apps-header" data-guide="app-list-header">
      <div class="header-text">
        <h2>质量应用</h2>
        <p>选择一个质量应用进入管理</p>
      </div>
    </div>

    <el-row :gutter="20">
      <el-col
        v-for="app in visibleApps"
        :key="app.key"
        :xs="24"
        :sm="12"
        :md="12"
        :lg="8"
        :xl="8"
      >
        <el-card
          class="app-card"
          data-guide="app-card"
          :data-guide-key="app.key"
          :class="`attention-${app.card.attentionLevel || 'normal'}`"
          shadow="hover"
          @click="openApp(app)"
        >
          <div class="app-card-body">
            <div class="app-icon" :class="`tone-${app.tone}`">
              <el-icon size="20">
                <component :is="iconMap[app.icon]" />
              </el-icon>
            </div>
            <div class="app-info">
              <div class="app-title-line">
                <div class="app-name">{{ app.name }}</div>
                <span class="app-status" data-guide="app-card-status" :class="`status-${app.card.status}`">{{ app.card.statusText }}</span>
              </div>
              <div class="app-desc">{{ app.desc }}</div>
            </div>
          </div>
          <div class="app-metrics" data-guide="app-card-metrics">
            <div v-for="metric in app.card.metrics" :key="metric.label" class="metric-item">
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
            </div>
          </div>
          <div class="app-enter" data-guide="app-card-enter">
            <span>{{ app.card.brief }}</span>
            <span>进入</span>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { CircleCheck, DataBoard, DocumentChecked, Search, Tickets, Warning } from '@element-plus/icons-vue'
import { QUALITY_APPS } from '@/utils/quality-apps'
import { hasPerm } from '@/utils/permission'
import request from '@/utils/request'
import {
  daysBetween,
  formatShortDate,
  getQualityAppAttention,
  numberValue,
  percentText
} from '@/utils/quality-attention'
import { sortByAttention } from '@shared/app-card-attention'
import {
  combineQueryParts,
  countStat,
  filterPart,
  loadAppsCardStats,
  statNumber,
  sumStat
} from '@shared/app-card-server-stats'
import { isAppVisible, useDisplayVisibility } from '@shared/eis-display-control'

const router = useRouter()
const { visibility: displayVisibility } = useDisplayVisibility()
const iconMap = { CircleCheck, DataBoard, DocumentChecked, Search, Tickets, Warning }

const appRows = ref(Object.fromEntries(QUALITY_APPS.map((app) => [app.key, app.fallbackRows || []])))
const serverStats = ref({})
const cardLoading = ref(false)

const rowsOf = (key) => appRows.value[key] || []
const statsOf = (key) => serverStats.value[key] || {}
const sourceKeyOf = (app) => app.sourceAppKey || app.key

const appendLimit = (url, limit = 200) => `${url}${url.includes('?') ? '&' : '?'}limit=${limit}`
const today = () => new Date().toISOString().slice(0, 10)
const offsetDate = (days) => {
  const next = new Date()
  next.setDate(next.getDate() + days)
  return next.toISOString().slice(0, 10)
}

const ratio = (part, total) => {
  const denominator = numberValue(total)
  if (denominator <= 0) return 0
  return Math.max(0, Math.min(100, (numberValue(part) / denominator) * 100))
}

const qualityCardStatsSpec = (app) => {
  if (app.key === 'inspections') {
    return {
      stats: [
        countStat('total'),
        countStat('pending', filterPart('result', 'eq', '待判定')),
        countStat('pass', filterPart('result', 'in', ['合格', '让步接收'])),
        sumStat('sampleQty', 'sample_qty'),
        sumStat('defectQty', 'defect_qty')
      ]
    }
  }
  if (app.key === 'ncr') {
    return {
      stats: [
        countStat('total'),
        countStat('open', filterPart('ncr_status', 'neq', '已关闭')),
        countStat('severe', combineQueryParts(filterPart('ncr_status', 'neq', '已关闭'), filterPart('severity', 'in', ['关键', '严重']))),
        countStat('overdue', combineQueryParts(filterPart('ncr_status', 'neq', '已关闭'), filterPart('deadline', 'lt', today())))
      ]
    }
  }
  if (app.key === 'actions') {
    return {
      stats: [
        countStat('total'),
        countStat('active', filterPart('action_status', 'neq', '已完成')),
        countStat('overdue', combineQueryParts(filterPart('action_status', 'neq', '已完成'), filterPart('due_date', 'lt', today()))),
        countStat('due', combineQueryParts(filterPart('action_status', 'neq', '已完成'), filterPart('due_date', 'gte', today()), filterPart('due_date', 'lte', offsetDate(1))))
      ]
    }
  }
  if (app.key === 'audits') {
    return {
      stats: [
        countStat('total'),
        countStat('open', filterPart('audit_status', 'neq', '已关闭')),
        sumStat('findings', 'finding_count')
      ]
    }
  }
  if (app.key === 'standards') {
    return {
      stats: [
        countStat('total'),
        countStat('active', filterPart('standard_status', 'eq', '生效')),
        countStat('draft', filterPart('standard_status', 'in', ['草稿', '修订中']))
      ]
    }
  }
  return { stats: [countStat('total')] }
}

const loadCardData = async () => {
  if (cardLoading.value) return
  cardLoading.value = true
  try {
    const apps = QUALITY_APPS.filter((app) => app.apiUrl)
    const [statsResult, results] = await Promise.all([
      loadAppsCardStats({
        request,
        apps,
        profile: 'public',
        getStats: qualityCardStatsSpec
      }).catch(() => ({})),
      Promise.allSettled(apps.map((app) => request({ url: appendLimit(app.apiUrl), method: 'get' })))
    ])
    const next = { ...appRows.value }
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        next[apps[index].key] = result.value
      }
    })
    appRows.value = next
    serverStats.value = { ...serverStats.value, ...statsResult }
  } finally {
    cardLoading.value = false
  }
}

const cardMap = computed(() => {
  const inspections = rowsOf('inspections')
  const ncrs = rowsOf('ncr')
  const actions = rowsOf('actions')
  const audits = rowsOf('audits')
  const standards = rowsOf('standards')
  const inspectionStats = statsOf('inspections')
  const ncrStats = statsOf('ncr')
  const actionStats = statsOf('actions')
  const auditStats = statsOf('audits')
  const standardStats = statsOf('standards')
  const inspectionAttention = getQualityAppAttention('inspections', inspections)
  const ncrAttention = getQualityAppAttention('ncr', ncrs)
  const actionAttention = getQualityAppAttention('actions', actions)
  const auditAttention = getQualityAppAttention('audits', audits)
  const standardAttention = getQualityAppAttention('standards', standards)

  const sampleQty = statNumber(inspectionStats, 'sampleQty', inspections.reduce((sum, row) => sum + numberValue(row.sample_qty), 0))
  const defectQty = statNumber(inspectionStats, 'defectQty', inspections.reduce((sum, row) => sum + numberValue(row.defect_qty), 0))
  const inspectionTotal = statNumber(inspectionStats, 'total', inspections.length)
  const passCount = statNumber(inspectionStats, 'pass', inspections.filter((row) => ['合格', '让步接收'].includes(row.result)).length)
  const pendingInspections = statNumber(inspectionStats, 'pending', inspections.filter((row) => row.result === '待判定').length)
  const defectRate = ratio(defectQty, sampleQty)
  const passRate = ratio(passCount, inspectionTotal)
  const openNcrs = statNumber(ncrStats, 'open', ncrs.filter((row) => row.ncr_status !== '已关闭').length)
  const severeNcrs = statNumber(ncrStats, 'severe', ncrs.filter((row) => row.ncr_status !== '已关闭' && ['关键', '严重'].includes(row.severity)).length)
  const overdueNcrs = statNumber(ncrStats, 'overdue', ncrs.filter((row) => row.ncr_status !== '已关闭' && daysBetween(row.deadline) < 0).length)
  const activeActions = statNumber(actionStats, 'active', actions.filter((row) => row.action_status !== '已完成').length)
  const overdueActions = statNumber(actionStats, 'overdue', actions.filter((row) => row.action_status !== '已完成' && daysBetween(row.due_date) < 0).length)
  const dueActionsFallback = actions.filter((row) => {
    const delta = daysBetween(row.due_date)
    return row.action_status !== '已完成' && delta !== null && delta >= 0 && delta <= 1
  }).length
  const dueActions = statNumber(actionStats, 'due', dueActionsFallback)
  const openAudits = statNumber(auditStats, 'open', audits.filter((row) => row.audit_status !== '已关闭').length)
  const auditFindings = statNumber(auditStats, 'findings', audits.reduce((sum, row) => sum + numberValue(row.finding_count), 0))
  const activeStandards = statNumber(standardStats, 'active', standards.filter((row) => row.standard_status === '生效').length)
  const draftStandards = statNumber(standardStats, 'draft', standards.filter((row) => ['草稿', '修订中'].includes(row.standard_status)).length)
  const latestInspection = inspections.slice().sort((a, b) => String(b.inspection_date || '').localeCompare(String(a.inspection_date || '')))[0]
  const latestStandard = standards.slice().sort((a, b) => String(b.effective_date || '').localeCompare(String(a.effective_date || '')))[0]

  return {
    inspections: {
      status: inspectionAttention.status,
      statusText: cardLoading.value ? '同步中' : inspectionAttention.statusText,
      attentionLevel: inspectionAttention.level,
      metrics: [
        { label: '待判定', value: `${pendingInspections}` },
        { label: '不良率', value: percentText(defectRate) }
      ],
      brief: inspectionAttention.primary.reason || `最近 ${formatShortDate(latestInspection?.inspection_date)}`
    },
    ncr: {
      status: ncrAttention.status,
      statusText: cardLoading.value ? '同步中' : ncrAttention.statusText,
      attentionLevel: ncrAttention.level,
      metrics: [
        { label: '未关闭', value: `${openNcrs}` },
        { label: '严/逾', value: `${severeNcrs}/${overdueNcrs}` }
      ],
      brief: ncrAttention.primary.reason || (openNcrs > 0 ? '跟踪责任人与期限' : '暂无未关闭异常')
    },
    actions: {
      status: actionAttention.status,
      statusText: cardLoading.value ? '同步中' : actionAttention.statusText,
      attentionLevel: actionAttention.level,
      metrics: [
        { label: '处理中', value: `${activeActions}` },
        { label: '临/逾', value: `${dueActions}/${overdueActions}` }
      ],
      brief: actionAttention.primary.reason || '跟踪整改闭环'
    },
    audits: {
      status: auditAttention.status,
      statusText: cardLoading.value ? '同步中' : auditAttention.statusText,
      attentionLevel: auditAttention.level,
      metrics: [
        { label: '进行中', value: `${openAudits}` },
        { label: '发现项', value: `${auditFindings}` }
      ],
      brief: auditAttention.primary.reason || '按计划推进审核'
    },
    standards: {
      status: standardAttention.status,
      statusText: cardLoading.value ? '同步中' : standardAttention.statusText,
      attentionLevel: standardAttention.level,
      metrics: [
        { label: '生效标准', value: `${activeStandards}` },
        { label: '草稿/修订', value: `${draftStandards}` }
      ],
      brief: standardAttention.primary.reason || `最新 ${latestStandard?.version || latestStandard?.standard_no || '--'}`
    }
  }
})

const visibleApps = computed(() => QUALITY_APPS
  .filter((app) => isAppVisible(displayVisibility.value, 'quality', app.key))
  .filter((app) => app.key !== 'dashboard' && (!app.perm || hasPerm(app.perm)))
  .map((app) => ({
    ...app,
    card: cardMap.value[sourceKeyOf(app)] || {
      status: 'info',
      statusText: '应用',
      attentionLevel: 'normal',
      metrics: [
        { label: '记录数', value: `${rowsOf(sourceKeyOf(app)).length}` },
        { label: '状态', value: '可用' }
      ],
      brief: app.desc
    }
  }))
  .sort(sortByAttention))

const openApp = (app) => {
  if (!app?.route) return
  router.push(app.route)
}

onMounted(() => {
  loadCardData()
})
</script>

<style scoped>
.quality-apps {
  position: relative;
  min-height: 100vh;
  padding: 20px;
  box-sizing: border-box;
  background: #f5f7fb;
}

.apps-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 16px;
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

.app-card {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 168px;
  margin-bottom: 20px;
  border-radius: 10px;
  cursor: pointer;
  overflow: hidden;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.app-card :deep(.el-card__body) {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  padding: 14px;
}

.app-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(var(--el-color-primary-rgb), 0.15);
}

.app-card-body {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-height: 48px;
}

.app-icon {
  width: 42px;
  height: 42px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
}

.tone-blue {
  background: var(--el-color-primary);
}

.tone-red {
  background: #ef4444;
}

.tone-green {
  background: #22c55e;
}

.tone-orange {
  background: #f59e0b;
}

.tone-purple {
  background: #8b5cf6;
}

.tone-slate {
  background: #475569;
}

.app-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
}

.app-title-line {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.app-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.app-desc {
  display: -webkit-box;
  overflow: hidden;
  font-size: 12px;
  color: #909399;
  line-height: 18px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
}

.app-status {
  flex: 0 0 auto;
  min-width: 48px;
  max-width: 58px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  line-height: 1;
  white-space: nowrap;
  background: #eef2ff;
  color: #475569;
}

.status-ok {
  background: #dcfce7;
  color: #16a34a;
}

.status-warn {
  background: #fef3c7;
  color: #d97706;
}

.status-danger {
  background: #fee2e2;
  color: #dc2626;
}

.status-info {
  background: #e0f2fe;
  color: #0284c7;
}

.app-metrics {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.metric-item {
  min-width: 0;
  height: 42px;
  padding: 0 10px;
  box-sizing: border-box;
  border-radius: 8px;
  background: #f6f8fb;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.metric-item strong {
  min-width: 52px;
  overflow: visible;
  color: #303133;
  font-size: 17px;
  line-height: 1;
  font-weight: 800;
  text-align: right;
  white-space: nowrap;
}

.metric-item span {
  min-width: 0;
  flex: 1;
  color: #909399;
  font-size: 11px;
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-enter {
  margin-top: auto;
  padding-top: 10px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--el-color-primary);
}

.app-enter span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #909399;
}

.app-enter span:last-child {
  flex: 0 0 auto;
}

.attention-critical {
  border-color: rgba(239, 68, 68, 0.45);
}

.attention-warning {
  border-color: rgba(245, 158, 11, 0.42);
}

.attention-focus {
  border-color: rgba(14, 165, 233, 0.36);
}

@media (min-width: 1500px) {
  .quality-apps {
    max-width: 1480px;
    margin: 0 auto;
  }
}

@media (max-width: 640px) {
  .quality-apps {
    padding: 14px;
  }

  .app-card {
    height: 168px;
    min-height: 0;
  }

  .app-card-body {
    min-height: 0;
  }

  .app-title-line {
    align-items: flex-start;
  }

  .metric-item strong {
    min-width: 44px;
    font-size: 15px;
  }
}

:global(#app.dark) .quality-apps {
  background: #0b0f14;
}

:global(#app.dark) .header-text h2,
:global(#app.dark) .header-text p,
:global(#app.dark) .app-name,
:global(#app.dark) .app-desc,
:global(#app.dark) .app-enter {
  color: #f3f4f6;
}

:global(#app.dark) .app-card {
  background-color: #111827;
  border-color: #1f2937;
}

:global(#app.dark) .metric-item {
  background: #0f172a;
}

:global(#app.dark) .metric-item strong,
:global(#app.dark) .app-enter span:first-child {
  color: #f3f4f6;
}

:global(#app.dark) .metric-item span {
  color: #9ca3af;
}
</style>
