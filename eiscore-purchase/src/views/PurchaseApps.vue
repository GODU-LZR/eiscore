<template>
  <div class="purchase-apps" data-guide="app-list-page">
    <div class="apps-header" data-guide="app-list-header">
      <div class="header-text">
        <h2>采购应用</h2>
        <p>选择一个应用进入管理</p>
      </div>
    </div>

    <el-row :gutter="20" class="apps-grid">
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
import { Box, Memo, Monitor, OfficeBuilding, Tickets } from '@element-plus/icons-vue'
import { PURCHASE_APPS } from '@/utils/purchase-apps'
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
  sortByAttention
} from '@shared/app-card-attention'

const router = useRouter()
const iconMap = { Box, Memo, Monitor, OfficeBuilding, Tickets }
const appRows = ref(Object.fromEntries(PURCHASE_APPS.map((app) => [app.key, []])))
const cardLoading = ref(false)

const rowsOf = (key) => appRows.value[key] || []
const sourceKeyOf = (app) => app.sourceAppKey || app.key
const isClosedOrder = (row) => ['已完成', '已取消'].includes(String(row.order_status || '').trim())
const isClosedDemand = (row) => ['已下单', '已关闭'].includes(String(row.demand_status || '').trim())

const moduleTips = [
  '供应商档案用于维护供应商等级、联系人、付款条件和交期。',
  '采购需求用于维护物料需求、需求日期、来源部门和建议供应商。',
  '采购订单用于维护下单数量、单价、金额、预计到货和执行状态。',
  '到货跟踪用于维护到货数量、IQC结果、入库单号和异常处理。'
]

const buildPurchaseOverviewContext = () => {
  const apps = visibleApps.value.map((app) => ({
    key: app.key,
    name: app.name,
    desc: app.desc,
    route: `/purchase${app.route}`,
    viewId: app.viewId,
    apiUrl: app.apiUrl,
    recordCount: rowsOf(sourceKeyOf(app)).length,
    attention: app.card || null,
    columns: (app.staticColumns || []).map((col) => ({
      label: col.label,
      prop: col.prop,
      type: col.type || 'text',
      options: col.options || []
    }))
  }))

  return {
    app: 'purchase',
    view: 'purchase_apps',
    viewId: 'purchase_apps',
    profile: 'public',
    aiScene: 'purchase_overview',
    allowImport: false,
    allowFormula: false,
    apps,
    dataStats: {
      totalCount: apps.length,
      appNames: apps.map((app) => app.name),
      recordCounts: apps.reduce((acc, app) => {
        acc[app.key] = app.recordCount
        return acc
      }, {})
    },
    moduleTips
  }
}

const syncPurchaseOverviewContext = () => {
  pushAiContext(buildPurchaseOverviewContext())
}

const loadCardData = async () => {
  if (cardLoading.value) return
  cardLoading.value = true
  try {
    const apps = PURCHASE_APPS.filter((app) => app.apiUrl)
    const results = await Promise.allSettled(apps.map((app) => request({
      url: appendQuery(app.apiUrl, { status: app.apiUrl.includes('status=') ? undefined : 'neq.deleted', limit: 200 }),
      method: 'get',
      headers: { 'Accept-Profile': 'public' },
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
    syncPurchaseOverviewContext()
  } finally {
    cardLoading.value = false
  }
}

const cardMap = computed(() => {
  const suppliers = rowsOf('suppliers')
  const demands = rowsOf('demands')
  const orders = rowsOf('orders')
  const arrivals = rowsOf('arrivals')

  const pendingSuppliers = suppliers.filter((row) => row.supplier_status === '待评审').length
  const pausedSuppliers = suppliers.filter((row) => row.supplier_status === '暂停合作').length
  const longLeadSuppliers = suppliers.filter((row) => numberValue(row.lead_time_days) >= 15).length
  const pendingDemands = demands.filter((row) => row.demand_status === '待采购').length
  const overdueDemands = demands.filter((row) => {
    const delta = daysBetween(row.required_date)
    return delta !== null && delta < 0 && !isClosedDemand(row)
  }).length
  const dueDemands = demands.filter((row) => {
    const delta = daysBetween(row.required_date)
    return delta !== null && delta >= 0 && delta <= 2 && !isClosedDemand(row)
  }).length
  const openOrders = orders.filter((row) => !isClosedOrder(row)).length
  const overdueOrders = orders.filter((row) => {
    const delta = daysBetween(row.expected_arrival_date)
    return delta !== null && delta < 0 && !isClosedOrder(row) && numberValue(row.pending_quantity || row.quantity) > 0
  }).length
  const dueOrders = orders.filter((row) => {
    const delta = daysBetween(row.expected_arrival_date)
    return delta !== null && delta >= 0 && delta <= 3 && !isClosedOrder(row) && numberValue(row.pending_quantity || row.quantity) > 0
  }).length
  const orderAmount = orders.reduce((sum, row) => sum + numberValue(row.total_amount), 0)
  const rejectedArrivals = arrivals.filter((row) => row.iqc_status === '不合格' || row.arrival_status === '异常').length
  const pendingIqc = arrivals.filter((row) => ['待检', '待检验'].includes(row.iqc_status) || row.arrival_status === '待检验').length
  const inboundPending = arrivals.filter((row) => !row.inbound_no && ['合格', '让步接收'].includes(row.iqc_status)).length

  return {
    suppliers: cardFromScore({
      score: pausedSuppliers > 0 ? 66 : (pendingSuppliers > 0 ? 48 : 26),
      metrics: [
        { label: '待评审', value: `${pendingSuppliers}` },
        { label: '长交期', value: `${longLeadSuppliers}` }
      ],
      brief: pausedSuppliers > 0 ? `${pausedSuppliers} 个暂停合作` : (pendingSuppliers > 0 ? '先完成供应商评审' : '维护供应商健康')
    }),
    demands: cardFromScore({
      score: overdueDemands > 0 ? 78 : (pendingDemands > 0 || dueDemands > 0 ? 56 : 26),
      metrics: [
        { label: '待采购', value: `${pendingDemands}` },
        { label: '临/逾需求', value: `${dueDemands}/${overdueDemands}` }
      ],
      brief: overdueDemands > 0 ? '优先处理逾期需求' : (pendingDemands > 0 ? '下推采购订单' : '维护采购需求')
    }),
    orders: cardFromScore({
      score: overdueOrders > 0 ? 86 : (dueOrders > 0 ? 66 : (openOrders > 0 ? 42 : 26)),
      metrics: [
        { label: '未完成', value: `${openOrders}` },
        { label: '临/逾到货', value: `${dueOrders}/${overdueOrders}` }
      ],
      brief: overdueOrders > 0 ? '催办延期采购订单' : (dueOrders > 0 ? '跟进近期到货' : `采购额 ${moneyText(orderAmount)}`)
    }),
    arrivals: cardFromScore({
      score: rejectedArrivals > 0 ? 88 : (pendingIqc > 0 ? 64 : (inboundPending > 0 ? 46 : 26)),
      metrics: [
        { label: '待检', value: `${pendingIqc}` },
        { label: '异常', value: `${rejectedArrivals}` }
      ],
      brief: rejectedArrivals > 0 ? '先处理到货异常/IQC' : (pendingIqc > 0 ? '安排来料检验' : `${inboundPending} 单待入库`)
    })
  }
})

const visibleApps = computed(() => PURCHASE_APPS
  .filter((app) => app.key !== 'dashboard' && (!app.perm || hasPerm(app.perm)))
  .map((app) => ({
    ...app,
    card: cardLoading.value && !rowsOf(sourceKeyOf(app)).length
      ? buildGenericCard(app, rowsOf(sourceKeyOf(app)), true)
      : (cardMap.value[sourceKeyOf(app)] || buildGenericCard(app, rowsOf(sourceKeyOf(app)), cardLoading.value))
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
  syncPurchaseOverviewContext()
  loadCardData()
})

watch(visibleApps, () => {
  syncPurchaseOverviewContext()
})
</script>

<style scoped>
.purchase-apps {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 20px;
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
.tone-teal { background: #14b8a6; }
.tone-indigo { background: #6366f1; }

.app-info {
  display: flex;
  min-width: 0;
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

.attention-critical {
  border-color: rgba(239, 68, 68, 0.45);
}

.attention-warning {
  border-color: rgba(245, 158, 11, 0.42);
}

.attention-focus {
  border-color: rgba(14, 165, 233, 0.36);
}

:global(#app.dark) .purchase-apps {
  background-color: #0b0f14;
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
