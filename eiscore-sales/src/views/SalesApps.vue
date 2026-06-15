<template>
  <div class="sales-apps" data-guide="app-list-page">
    <div class="apps-header" data-guide="app-list-header">
      <div class="header-text">
        <h2>销售应用</h2>
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
          <a
            class="app-card-link"
            :href="href"
            @click="handleNavigate($event, navigate, app)"
          >
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

import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ChatLineSquare, DataAnalysis, DataBoard, Money, Tickets, TrendCharts, User } from '@element-plus/icons-vue'
import { SALES_APPS } from '@/utils/sales-apps'
import { hasPerm } from '@/utils/permission'
import request from '@/utils/request'
import { pushAiContext } from '@/utils/ai-context'
import {
  appendQuery,
  buildGenericCard,
  cardFromScore,
  daysBetween,
  moneyText,
  numberValue,
  percentText,
  sortByAttention
} from '@shared/app-card-attention'
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
const iconMap = { ChatLineSquare, DataAnalysis, DataBoard, Money, Tickets, TrendCharts, User }
const appRows = ref(Object.fromEntries(SALES_APPS.map((app) => [app.key, []])))
const serverStats = ref({})
const cardLoading = ref(false)

const rowsOf = (key) => appRows.value[key] || []
const statsOf = (key) => serverStats.value[key] || {}
const sourceKeyOf = (app) => app.sourceAppKey || (app.key === 'shipment_requests' ? 'orders' : app.key)
const isClosedOrder = (row) => ['已完成', '已取消'].includes(String(row.order_status || '').trim())
const isClosedOpportunity = (row) => ['赢单', '输单', '搁置'].includes(String(row.stage || '').trim())
const today = () => new Date().toISOString().slice(0, 10)
const offsetDate = (days) => {
  const next = new Date()
  next.setDate(next.getDate() + days)
  return next.toISOString().slice(0, 10)
}

const salesCardStatsSpec = (app) => {
  if (app.key === 'customers') {
    return {
      stats: [
        countStat('total'),
        countStat('paused', filterPart('customer_status', 'eq', '暂停合作')),
        sumStat('receivable', 'receivable_balance')
      ]
    }
  }
  if (app.key === 'follow_ups') {
    const closed = filterPart('follow_result', 'in', ['已成交', '无效', '暂缓'])
    return {
      stats: [
        countStat('total'),
        countStat('due', combineQueryParts(filterPart('next_follow_at', 'gte', today()), filterPart('next_follow_at', 'lte', offsetDate(1)), filterPart('follow_result', 'neq', '已成交'))),
        countStat('overdue', combineQueryParts(filterPart('next_follow_at', 'lt', today()), filterPart('follow_result', 'neq', '已成交'))),
        countStat('closed', closed)
      ]
    }
  }
  if (app.key === 'opportunities') {
    return {
      stats: [
        countStat('total'),
        countStat('active', filterPart('stage', 'not.in', ['赢单', '输单', '搁置'])),
        countStat('won', filterPart('stage', 'eq', '赢单')),
        countStat('overdue', combineQueryParts(filterPart('expected_close_date', 'lt', today()), filterPart('stage', 'not.in', ['赢单', '输单', '搁置']))),
        countStat('highValue', combineQueryParts(filterPart('expected_amount', 'gte', 100000), filterPart('stage', 'not.in', ['赢单', '输单', '搁置']))),
        sumStat('expectedAmount', 'expected_amount')
      ]
    }
  }
  if (app.key === 'orders') {
    return {
      stats: [
        countStat('total'),
        countStat('open', filterPart('order_status', 'not.in', ['已完成', '已取消'])),
        countStat('overdue', combineQueryParts(filterPart('delivery_date', 'lt', today()), filterPart('order_status', 'not.in', ['已完成', '已取消']))),
        countStat('due', combineQueryParts(filterPart('delivery_date', 'gte', today()), filterPart('delivery_date', 'lte', offsetDate(3)), filterPart('order_status', 'not.in', ['已完成', '已取消']))),
        sumStat('orderAmount', 'total_amount')
      ]
    }
  }
  if (app.key === 'payments') {
    return {
      stats: [
        countStat('total'),
        countStat('unverified', filterPart('verify_status', 'neq', '已核销')),
        sumStat('paymentAmount', 'amount')
      ]
    }
  }
  return { stats: [countStat('total')] }
}

const loadCardData = async () => {
  if (cardLoading.value) return
  cardLoading.value = true
  try {
    const apps = SALES_APPS.filter((app) => app.apiUrl)
    const [statsResult, results] = await Promise.all([
      loadAppsCardStats({
        request,
        apps,
        profile: 'public',
        getStats: salesCardStatsSpec
      }).catch(() => ({})),
      Promise.allSettled(apps.map((app) => request({
        url: appendQuery(app.apiUrl, { limit: 200 }),
        method: 'get',
        silentError: true,
        suppressErrorMessage: true
      })))
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
  const customers = rowsOf('customers')
  const followUps = rowsOf('follow_ups')
  const opportunities = rowsOf('opportunities')
  const orders = rowsOf('orders')
  const payments = rowsOf('payments')
  const customerStats = statsOf('customers')
  const followStats = statsOf('follow_ups')
  const oppStats = statsOf('opportunities')
  const orderStats = statsOf('orders')
  const paymentStats = statsOf('payments')

  const pausedCustomers = statNumber(customerStats, 'paused', customers.filter((row) => row.customer_status === '暂停合作').length)
  const customerTotal = statNumber(customerStats, 'total', customers.length)
  const receivable = statNumber(customerStats, 'receivable', customers.reduce((sum, row) => sum + numberValue(row.receivable_balance), 0))
  const overCredit = customers.filter((row) => numberValue(row.receivable_balance) > numberValue(row.credit_limit) && numberValue(row.credit_limit) > 0).length
  const overdueFollowFallback = followUps.filter((row) => {
    const delta = daysBetween(row.next_follow_at)
    return delta !== null && delta < 0 && !['已成交', '无效', '暂缓'].includes(row.follow_result)
  }).length
  const dueFollowFallback = followUps.filter((row) => {
    const delta = daysBetween(row.next_follow_at)
    return delta !== null && delta >= 0 && delta <= 1 && !['已成交', '无效', '暂缓'].includes(row.follow_result)
  }).length
  const overdueFollow = statNumber(followStats, 'overdue', overdueFollowFallback)
  const dueFollow = statNumber(followStats, 'due', dueFollowFallback)
  const activeOppFallback = opportunities.filter((row) => !isClosedOpportunity(row)).length
  const activeOpp = statNumber(oppStats, 'active', activeOppFallback)
  const overdueOppFallback = opportunities.filter((row) => {
    const delta = daysBetween(row.expected_close_date)
    return delta !== null && delta < 0 && !isClosedOpportunity(row)
  }).length
  const highValueOppFallback = opportunities.filter((row) => !isClosedOpportunity(row) && numberValue(row.expected_amount) >= 100000).length
  const overdueOpp = statNumber(oppStats, 'overdue', overdueOppFallback)
  const highValueOpp = statNumber(oppStats, 'highValue', highValueOppFallback)
  const oppTotal = statNumber(oppStats, 'total', opportunities.length)
  const wonOpp = statNumber(oppStats, 'won', opportunities.filter((row) => row.stage === '赢单').length)
  const winRate = oppTotal
    ? (wonOpp / oppTotal) * 100
    : 0
  const openOrdersFallback = orders.filter((row) => !isClosedOrder(row)).length
  const overdueOrdersFallback = orders.filter((row) => {
    const delta = daysBetween(row.delivery_date)
    return delta !== null && delta < 0 && !isClosedOrder(row)
  }).length
  const dueOrdersFallback = orders.filter((row) => {
    const delta = daysBetween(row.delivery_date)
    return delta !== null && delta >= 0 && delta <= 3 && !isClosedOrder(row)
  }).length
  const openOrders = statNumber(orderStats, 'open', openOrdersFallback)
  const overdueOrders = statNumber(orderStats, 'overdue', overdueOrdersFallback)
  const dueOrders = statNumber(orderStats, 'due', dueOrdersFallback)
  const orderAmount = statNumber(orderStats, 'orderAmount', orders.reduce((sum, row) => sum + numberValue(row.total_amount), 0))
  const unverifiedPayments = statNumber(paymentStats, 'unverified', payments.filter((row) => row.verify_status !== '已核销').length)
  const paymentAmount = statNumber(paymentStats, 'paymentAmount', payments.reduce((sum, row) => sum + numberValue(row.amount), 0))

  return {
    customers: cardFromScore({
      score: overCredit > 0 ? 78 : (pausedCustomers > 0 ? 50 : 28),
      metrics: [
        { label: '客户数', value: `${customerTotal}` },
        { label: '应收', value: moneyText(receivable) }
      ],
      brief: overCredit > 0 ? `${overCredit} 个客户超信用` : (pausedCustomers > 0 ? `${pausedCustomers} 个暂停合作` : '维护客户与信用')
    }),
    follow_ups: cardFromScore({
      score: overdueFollow > 0 ? 70 : (dueFollow > 0 ? 52 : 26),
      metrics: [
        { label: '今日/明日', value: `${dueFollow}` },
        { label: '逾期跟进', value: `${overdueFollow}` }
      ],
      brief: overdueFollow > 0 ? '优先补跟进动作' : (dueFollow > 0 ? '处理近期跟进' : '沉淀客户沟通')
    }),
    opportunities: cardFromScore({
      score: overdueOpp > 0 ? 68 : (highValueOpp > 0 ? 48 : 28),
      metrics: [
        { label: '活跃商机', value: `${activeOpp}` },
        { label: '赢率', value: percentText(winRate) }
      ],
      brief: overdueOpp > 0 ? '跟进逾期成交节点' : (highValueOpp > 0 ? `${highValueOpp} 个高额商机` : '推进销售漏斗')
    }),
    orders: cardFromScore({
      score: overdueOrders > 0 ? 88 : (dueOrders > 0 ? 66 : (openOrders > 0 ? 42 : 26)),
      metrics: [
        { label: '未完成', value: `${openOrders}` },
        { label: '临/逾交付', value: `${dueOrders}/${overdueOrders}` }
      ],
      brief: overdueOrders > 0 ? '优先处理逾期交付' : (dueOrders > 0 ? '关注近期交付' : `订单金额 ${moneyText(orderAmount)}`)
    }),
    shipment_requests: cardFromScore({
      score: overdueOrders > 0 ? 86 : (dueOrders > 0 ? 64 : 30),
      metrics: [
        { label: '待交付', value: `${openOrders}` },
        { label: '临/逾期', value: `${dueOrders}/${overdueOrders}` }
      ],
      brief: overdueOrders > 0 ? '先处理出货阻塞' : '按订单发起出货'
    }),
    payments: cardFromScore({
      score: unverifiedPayments > 0 ? 58 : 28,
      metrics: [
        { label: '待核销', value: `${unverifiedPayments}` },
        { label: '回款额', value: moneyText(paymentAmount) }
      ],
      brief: unverifiedPayments > 0 ? '跟进回款核销' : '查看资金到账'
    })
  }
})

const visibleApps = computed(() => SALES_APPS
  .filter((app) => isAppVisible(displayVisibility.value, 'sales', app.key))
  .filter((app) => !app.perm || hasPerm(app.perm))
  .map((app) => ({
    ...app,
    card: cardLoading.value && !rowsOf(sourceKeyOf(app)).length
      ? buildGenericCard(app, rowsOf(sourceKeyOf(app)), true)
      : (cardMap.value[app.key] || cardMap.value[sourceKeyOf(app)] || buildGenericCard(app, rowsOf(sourceKeyOf(app)), cardLoading.value))
  }))
  .sort(sortByAttention))

const buildSalesAppsContext = () => {
  const apps = visibleApps.value.map((app) => ({
    key: app.key,
    name: app.name,
    desc: app.desc,
    route: `/sales${app.route}`,
    viewId: app.viewId || app.key,
    apiUrl: app.apiUrl || '',
    columns: (app.staticColumns || []).map((col) => ({
      label: col.label,
      prop: col.prop,
      type: col.type || 'text',
      options: col.options || []
    }))
  }))

  return {
    app: 'sales',
    view: 'sales_apps',
    viewId: 'sales_apps',
    profile: 'public',
    aiScene: 'sales_apps',
    allowImport: false,
    allowFormula: false,
    apps,
    dataStats: {
      totalCount: apps.length,
      appNames: apps.map((app) => app.name)
    },
    moduleTips: [
      '销售驾驶舱用于查看经营指标、销售漏斗、回款进度和风险预警。',
      '客户档案用于维护客户基础资料、信用额度、应收余额和销售负责人。',
      '客户跟进用于维护客户沟通纪要、跟进结果和下次行动计划。',
      '销售商机用于维护客户需求、预计金额、销售阶段和成交概率。',
      '销售订单用于维护订单明细、交付计划、订单状态和销售金额。',
      '回款记录用于维护回款金额、到账日期、核销状态和经办人。'
    ]
  }
}

const syncSalesAppsContext = () => {
  pushAiContext(buildSalesAppsContext())
}

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

onMounted(syncSalesAppsContext)
onMounted(loadCardData)
watch(visibleApps, syncSalesAppsContext)
</script>

<style scoped>
.sales-apps {
  position: relative;
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
  position: relative;
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

.tone-blue { background: var(--el-color-primary); }
.tone-cyan { background: #14b8a6; }
.tone-green { background: #67c23a; }
.tone-indigo { background: #6366f1; }
.tone-orange { background: #e6a23c; }
.tone-purple { background: #8b5cf6; }
.tone-dark { background: #111827; }

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

:global(#app.dark) .sales-apps {
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

@media (max-width: 760px) {
  .sales-apps {
    padding: 14px;
  }

  .apps-header {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }
}
</style>
