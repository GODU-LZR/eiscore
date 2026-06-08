<template>
  <div class="production-apps" data-guide="app-list-page">
    <div class="apps-header" data-guide="app-list-header">
      <div class="header-text">
        <h2>生产应用</h2>
        <p>选择一个应用进入管理</p>
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
        <router-link :to="app.route" custom v-slot="{ href, navigate }">
          <a class="app-card-link" :href="href" @click="handleNavigate($event, navigate, app)">
            <el-card
              class="app-card"
              data-guide="app-card"
              :data-guide-key="app.key"
              :class="`attention-${app.card.attentionLevel || 'normal'}`"
              shadow="hover"
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
          </a>
        </router-link>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, nextTick, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Calendar, Connection, DataBoard, List, Tickets } from '@element-plus/icons-vue'
import { PRODUCTION_APPS } from '@/utils/production-apps'
import { hasPerm } from '@/utils/permission'
import request from '@/utils/request'
import {
  appendQuery,
  buildGenericCard,
  cardFromScore,
  daysBetween,
  numberValue,
  sortByAttention
} from '@shared/app-card-attention'

const router = useRouter()
const iconMap = { Calendar, Connection, DataBoard, List, Tickets }
const appRows = ref(Object.fromEntries(PRODUCTION_APPS.map((app) => [app.key, []])))
const cardLoading = ref(false)

const rowsOf = (key) => appRows.value[key] || []
const sourceKeyOf = (app) => {
  if (['bom', 'process_templates'].includes(app.key)) return 'bom_list'
  if (app.key === 'work_reports') return 'work_orders'
  if (app.key === 'picking_orders') return 'work_order_items'
  return app.sourceAppKey || app.key
}
const isClosedWorkOrder = (row) => ['已完工', '已取消'].includes(String(row.work_order_status || '').trim())

const loadCardData = async () => {
  if (cardLoading.value) return
  cardLoading.value = true
  try {
    const apps = PRODUCTION_APPS.filter((app) => app.apiUrl)
    const results = await Promise.allSettled(apps.map((app) => request({
      url: appendQuery(app.apiUrl, { limit: 200 }),
      method: 'get',
      headers: { 'Accept-Profile': 'scm' },
      silentError: true,
      suppressErrorMessage: true
    })))
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
  const boms = rowsOf('bom_list')
  const plans = rowsOf('plans')
  const workOrders = rowsOf('work_orders')
  const items = rowsOf('work_order_items')

  const activeBoms = boms.filter((row) => row.status === '启用').length
  const draftBoms = boms.filter((row) => row.status === '草稿').length
  const inactiveBoms = boms.filter((row) => ['停用', '作废'].includes(row.status)).length
  const pendingPlans = plans.filter((row) => numberValue(row.planned_qty) > 0 && row.plan_status === '待生成工单').length
  const openPlanWorkOrders = plans.reduce((sum, row) => sum + numberValue(row.open_work_order_count), 0)
  const overduePlans = plans.filter((row) => {
    const delta = daysBetween(row.earliest_delivery_date)
    return delta !== null && delta < 0 && numberValue(row.planned_qty) > 0 && row.plan_status !== '成品库存满足'
  }).length
  const activeWorkOrders = workOrders.filter((row) => !isClosedWorkOrder(row)).length
  const urgentWorkOrders = workOrders.filter((row) => !isClosedWorkOrder(row) && row.priority === '紧急').length
  const shortageWorkOrders = workOrders.filter((row) => !isClosedWorkOrder(row) && numberValue(row.shortage_item_count) > 0).length
  const dueWorkOrders = workOrders.filter((row) => {
    const delta = daysBetween(row.planned_finish_date)
    return delta !== null && delta >= 0 && delta <= 2 && !isClosedWorkOrder(row)
  }).length
  const overdueWorkOrders = workOrders.filter((row) => {
    const delta = daysBetween(row.planned_finish_date)
    return delta !== null && delta < 0 && !isClosedWorkOrder(row)
  }).length
  const shortageItems = items.filter((row) => numberValue(row.shortage_qty) > 0).length
  const unissuedItems = items.filter((row) => row.issue_status === '未领料').length
  const partialItems = items.filter((row) => row.issue_status === '部分领料').length

  const bomCard = cardFromScore({
    score: activeBoms ? (draftBoms > 0 ? 40 : 28) : 62,
    metrics: [
      { label: '启用配方', value: `${activeBoms}` },
      { label: '草稿/停用', value: `${draftBoms}/${inactiveBoms}` }
    ],
    brief: activeBoms ? '维护配方版本' : '先启用生产配方'
  })
  const workOrderCard = cardFromScore({
    score: shortageWorkOrders > 0 ? 90 : (overdueWorkOrders > 0 ? 84 : (urgentWorkOrders > 0 ? 70 : (dueWorkOrders > 0 ? 58 : 32))),
    metrics: [
      { label: '在制工单', value: `${activeWorkOrders}` },
      { label: '缺料/逾期', value: `${shortageWorkOrders}/${overdueWorkOrders}` }
    ],
    brief: shortageWorkOrders > 0 ? '优先处理缺料工单' : (overdueWorkOrders > 0 ? '跟进逾期完工' : (urgentWorkOrders > 0 ? '处理紧急工单' : '跟进生产进度'))
  })
  const itemCard = cardFromScore({
    score: shortageItems > 0 ? 88 : (partialItems > 0 || unissuedItems > 0 ? 58 : 28),
    metrics: [
      { label: '缺料项', value: `${shortageItems}` },
      { label: '未/部分领', value: `${unissuedItems}/${partialItems}` }
    ],
    brief: shortageItems > 0 ? '先补齐缺料物料' : (unissuedItems > 0 ? '安排生产领料' : '查看齐套状态')
  })

  return {
    bom: bomCard,
    process_templates: bomCard,
    bom_list: bomCard,
    plans: cardFromScore({
      score: overduePlans > 0 ? 82 : (pendingPlans > 0 ? 64 : (openPlanWorkOrders > 0 ? 42 : 26)),
      metrics: [
        { label: '待生成', value: `${pendingPlans}` },
        { label: '逾期建议', value: `${overduePlans}` }
      ],
      brief: overduePlans > 0 ? '先处理逾期生产建议' : (pendingPlans > 0 ? '生成生产工单' : '查看生产建议')
    }),
    work_orders: workOrderCard,
    work_reports: workOrderCard,
    picking_orders: itemCard,
    work_order_items: itemCard
  }
})

const visibleApps = computed(() => PRODUCTION_APPS
  .filter((app) => app.key !== 'overview' && (!app.perm || hasPerm(app.perm)))
  .map((app) => ({
    ...app,
    card: cardLoading.value && !rowsOf(sourceKeyOf(app)).length
      ? buildGenericCard(app, rowsOf(sourceKeyOf(app)), true)
      : (cardMap.value[app.key] || cardMap.value[sourceKeyOf(app)] || buildGenericCard(app, rowsOf(sourceKeyOf(app)), cardLoading.value))
  }))
  .sort(sortByAttention))

const openApp = async (app) => {
  if (!app?.route) return
  await router.push(app.route)
}

const handleNavigate = async (event, navigate, app) => {
  if (!app?.route) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  if (typeof navigate === 'function') {
    navigate(event)
  } else {
    await openApp(app)
  }
  await nextTick()
  if (router.currentRoute.value.path !== app.route) {
    await router.push(app.route)
  }
}

onMounted(() => {
  loadCardData()
})
</script>

<style scoped>
.production-apps {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 20px;
  background: #f5f7fa;
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

.app-card-link {
  display: flex;
  color: inherit;
  text-decoration: none;
  height: 100%;
}

.app-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 168px;
  margin-bottom: 20px;
  cursor: pointer;
  border-radius: 8px;
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

.tone-blue { background: #409eff; }
.tone-green { background: #67c23a; }
.tone-orange { background: #e6a23c; }
.tone-dark { background: #111827; }
.tone-slate { background: #475569; }

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
  color: #909399;
  font-size: 12px;
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

.attention-critical {
  border-color: rgba(239, 68, 68, 0.45);
}

.attention-warning {
  border-color: rgba(245, 158, 11, 0.42);
}

.attention-focus {
  border-color: rgba(14, 165, 233, 0.36);
}

:global(#app.dark) .production-apps {
  background-color: #0b0f14;
}

:global(#app.dark) .header-text h2,
:global(#app.dark) .app-name {
  color: #f3f4f6;
}

:global(#app.dark) .header-text p,
:global(#app.dark) .app-desc,
:global(#app.dark) .app-enter {
  color: #cbd5e1;
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
