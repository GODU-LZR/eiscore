<template>
  <div class="equipment-apps">
    <div class="apps-header">
      <div class="header-text">
        <h2>设备应用</h2>
        <p>选择一个设备应用进入管理</p>
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
                <span class="app-status" :class="`status-${app.card.status}`">{{ app.card.statusText }}</span>
              </div>
              <div class="app-desc">{{ app.desc }}</div>
            </div>
          </div>
          <div class="app-metrics">
            <div v-for="metric in app.card.metrics" :key="metric.label" class="metric-item">
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
            </div>
          </div>
          <div class="app-enter">
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
import { Calendar, DataBoard, DocumentChecked, Monitor, Search, Tools, Warning } from '@element-plus/icons-vue'
import { EQUIPMENT_APPS } from '@/utils/equipment-apps'
import { hasPerm } from '@/utils/permission'
import request from '@/utils/request'
import {
  daysBetween,
  formatShortDate,
  getEquipmentAppAttention,
  numberValue
} from '@/utils/equipment-attention'

const router = useRouter()
const iconMap = { Calendar, DataBoard, DocumentChecked, Monitor, Search, Tools, Warning }

const appRows = ref(Object.fromEntries(EQUIPMENT_APPS.map((app) => [app.key, app.fallbackRows || []])))
const cardLoading = ref(false)

const numberText = (value) => {
  const num = numberValue(value)
  if (Math.abs(num) >= 10000) return `${(num / 10000).toFixed(1)}万`
  return Number.isInteger(num) ? String(num) : num.toFixed(1)
}

const avg = (rows, key) => {
  if (!rows.length) return 0
  return Math.round(rows.reduce((sum, row) => sum + numberValue(row[key]), 0) / rows.length)
}

const rowsOf = (key) => appRows.value[key] || []

const appendLimit = (url, limit = 200) => `${url}${url.includes('?') ? '&' : '?'}limit=${limit}`

const loadCardData = async () => {
  if (cardLoading.value) return
  cardLoading.value = true
  try {
    const apps = EQUIPMENT_APPS.filter((app) => app.apiUrl)
    const results = await Promise.allSettled(apps.map((app) => request({ url: appendLimit(app.apiUrl), method: 'get' })))
    const next = { ...appRows.value }
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        next[apps[index].key] = result.value
      }
    })
    appRows.value = next
  } finally {
    cardLoading.value = false
  }
}

const cardMap = computed(() => {
  const assets = rowsOf('assets')
  const checks = rowsOf('checks')
  const issues = rowsOf('issues')
  const workOrders = rowsOf('work_orders')
  const plans = rowsOf('plans')
  const standards = rowsOf('standards')
  const assetAttention = getEquipmentAppAttention('assets', assets)
  const checkAttention = getEquipmentAppAttention('checks', checks)
  const issueAttention = getEquipmentAppAttention('issues', issues)
  const workAttention = getEquipmentAppAttention('work_orders', workOrders)
  const planAttention = getEquipmentAppAttention('plans', plans)
  const standardAttention = getEquipmentAppAttention('standards', standards)

  const running = assets.filter((row) => row.run_status === '运行').length
  const down = assets.filter((row) => ['停机', '维修中'].includes(row.run_status)).length
  const health = avg(assets, 'health_score')
  const abnormalChecks = checks.filter((row) => row.check_result === '异常' || row.check_result === '停机' || numberValue(row.abnormal_count) > 0).length
  const openIssues = issues.filter((row) => row.issue_status !== '已关闭').length
  const urgentIssues = issues.filter((row) => row.issue_status !== '已关闭' && ['紧急', '严重'].includes(row.issue_level)).length
  const activeWork = workOrders.filter((row) => row.work_status !== '已完成').length
  const downtime = workOrders.reduce((sum, row) => sum + numberValue(row.downtime_hours), 0)
  const completedWork = workOrders.filter((row) => row.work_status === '已完成').length
  const avgCompletion = avg(plans, 'completion_rate')
  const overduePlans = plans.filter((row) => row.plan_status !== '已完成' && daysBetween(row.next_execute_date) < 0).length
  const duePlans = plans.filter((row) => {
    const delta = daysBetween(row.next_execute_date)
    return row.plan_status !== '已完成' && delta !== null && delta >= 0 && delta <= 3
  }).length
  const effectiveStandards = standards.filter((row) => row.standard_status === '生效').length
  const latestCheck = checks.slice().sort((a, b) => String(b.check_date || '').localeCompare(String(a.check_date || '')))[0]
  const latestStandard = standards.slice().sort((a, b) => String(b.effective_date || '').localeCompare(String(a.effective_date || '')))[0]
  const riskIndex = Math.min(99, down * 16 + openIssues * 12 + urgentIssues * 10 + activeWork * 8 + overduePlans * 14 + abnormalChecks * 6)

  return {
    dashboard: {
      status: riskIndex > 70 ? 'danger' : (riskIndex > 45 ? 'warn' : 'ok'),
      statusText: cardLoading.value ? '同步中' : '实时',
      attentionLevel: riskIndex > 70 ? 'critical' : (riskIndex > 45 ? 'warning' : 'normal'),
      metrics: [
        { label: '健康评分', value: `${health}` },
        { label: '风险指数', value: `${riskIndex}` }
      ],
      brief: `设备 ${assets.length} 台 · 工单 ${activeWork} 个`
    },
    assets: {
      status: assetAttention.status,
      statusText: assetAttention.statusText,
      attentionLevel: assetAttention.level,
      metrics: [
        { label: '设备总数', value: `${assets.length}` },
        { label: '运行设备', value: `${running}` }
      ],
      brief: assetAttention.primary.reason || `停机/维修 ${down} 台`
    },
    checks: {
      status: checkAttention.status,
      statusText: checkAttention.statusText,
      attentionLevel: checkAttention.level,
      metrics: [
        { label: '点检单', value: `${checks.length}` },
        { label: '异常单', value: `${abnormalChecks}` }
      ],
      brief: checkAttention.primary.reason || `最近 ${formatShortDate(latestCheck?.check_date)}`
    },
    issues: {
      status: issueAttention.status,
      statusText: issueAttention.statusText,
      attentionLevel: issueAttention.level,
      metrics: [
        { label: '未关闭', value: `${openIssues}` },
        { label: '严重紧急', value: `${urgentIssues}` }
      ],
      brief: issueAttention.primary.reason || (openIssues > 0 ? '跟踪责任人与期限' : '暂无未关闭异常')
    },
    work_orders: {
      status: workAttention.status,
      statusText: workAttention.statusText,
      attentionLevel: workAttention.level,
      metrics: [
        { label: '处理中', value: `${activeWork}` },
        { label: '停机', value: `${numberText(downtime)}h` }
      ],
      brief: workAttention.primary.reason || `已完成 ${completedWork} 单`
    },
    plans: {
      status: planAttention.status,
      statusText: planAttention.statusText,
      attentionLevel: planAttention.level,
      metrics: [
        { label: '完成率', value: `${avgCompletion}%` },
        { label: '临/逾', value: `${duePlans}/${overduePlans}` }
      ],
      brief: planAttention.primary.reason || `${plans.length} 个巡检保养计划`
    },
    standards: {
      status: standardAttention.status,
      statusText: standardAttention.statusText,
      attentionLevel: standardAttention.level,
      metrics: [
        { label: '生效标准', value: `${effectiveStandards}` },
        { label: '标准总数', value: `${standards.length}` }
      ],
      brief: standardAttention.primary.reason || `最新 ${latestStandard?.version || latestStandard?.standard_no || '--'}`
    }
  }
})

const visibleApps = computed(() => EQUIPMENT_APPS
  .filter((app) => app.key !== 'dashboard' && (!app.perm || hasPerm(app.perm)))
  .map((app) => ({
    ...app,
    card: cardMap.value[app.key] || {
      status: 'info',
      statusText: '应用',
      metrics: [
        { label: '记录数', value: `${rowsOf(app.key).length}` },
        { label: '状态', value: '可用' }
      ],
      brief: app.desc
    }
  })))

const openApp = (app) => {
  if (!app?.route) return
  router.push(app.route)
}

onMounted(() => {
  loadCardData()
})
</script>

<style scoped>
.equipment-apps {
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
  box-shadow: 0 8px 18px rgba(64, 158, 255, 0.15);
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
  background: #0ea5e9;
}

.tone-red {
  background: #ef4444;
}

.tone-cyan {
  background: #14b8a6;
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
  color: #409eff;
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

@media (min-width: 1500px) {
  .equipment-apps {
    max-width: 1480px;
    margin: 0 auto;
  }
}

@media (max-width: 640px) {
  .equipment-apps {
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

:global(#app.dark) .equipment-apps {
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
