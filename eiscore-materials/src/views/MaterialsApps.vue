<template>
  <div class="materials-apps" data-guide="app-list-page">
    <div class="apps-header" data-guide="app-list-header">
      <div class="header-text">
        <h2>仓储管理</h2>
        <p>选择一个仓储应用进入管理</p>
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
import { Box, Connection, Setting, OfficeBuilding, Notebook, Search, Monitor, Upload, Download } from '@element-plus/icons-vue'
import { MATERIAL_APPS } from '@/utils/material-apps'
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
import {
  combineQueryParts,
  countStat,
  filterPart,
  loadAppCardStats,
  statNumber
} from '@shared/app-card-server-stats'
import { isAppVisible, useDisplayVisibility } from '@shared/eis-display-control'

const router = useRouter()
const apps = MATERIAL_APPS
const { visibility: displayVisibility } = useDisplayVisibility()
const iconMap = {
  Box,
  Connection,
  Setting,
  OfficeBuilding,
  Notebook,
  Search,
  Monitor,
  Upload,
  Download
}

const appRows = ref({
  a: [],
  'batch-rules': [],
  warehouses: [],
  'inventory-ledger': [],
  'inventory-stock-in': [],
  'inventory-stock-out': [],
  'inventory-current': []
})
const serverStats = ref({})
const cardLoading = ref(false)

const rowsOf = (key) => appRows.value[key] || []
const statsOf = (key) => serverStats.value[key] || {}
const sourceKeyOf = (app) => app.sourceAppKey || app.key
const today = () => new Date().toISOString().slice(0, 10)
const offsetDate = (days) => {
  const next = new Date()
  next.setDate(next.getDate() + days)
  return next.toISOString().slice(0, 10)
}

const requestList = async (key, url, schema = 'public') => {
  try {
    const rows = await request({
      url: appendQuery(url, { limit: 200 }),
      method: 'get',
      headers: { 'Accept-Profile': schema },
      silentError: true,
      suppressErrorMessage: true
    })
    return [key, Array.isArray(rows) ? rows : []]
  } catch (e) {
    return [key, rowsOf(key)]
  }
}

const loadCardData = async () => {
  if (cardLoading.value) return
  cardLoading.value = true
  try {
    const [statsResult, results] = await Promise.all([
      loadMaterialCardStats().catch(() => ({})),
      Promise.all([
      requestList('a', '/raw_materials?order=id.desc', 'public'),
      requestList('batch-rules', '/batch_no_rules?order=created_at.desc', 'scm'),
      requestList('warehouses', '/warehouses?order=code.asc', 'scm'),
      requestList('inventory-ledger', '/v_inventory_transactions?order=transaction_date.desc', 'scm'),
      requestList('inventory-stock-in', '/v_inventory_drafts?draft_type=eq.in&order=created_at.desc', 'scm'),
      requestList('inventory-stock-out', '/v_inventory_drafts?draft_type=eq.out&order=created_at.desc', 'scm'),
      requestList('inventory-current', '/v_inventory_current?order=last_transaction_at.desc', 'scm')
      ])
    ])
    appRows.value = results.reduce((acc, [key, rows]) => {
      acc[key] = rows
      return acc
    }, { ...appRows.value })
    serverStats.value = { ...serverStats.value, ...statsResult }
  } finally {
    cardLoading.value = false
  }
}

const normalizeDraftStatus = (row) => String(row?.status || 'created').trim().toLowerCase()
const isOpenDraft = (row) => ![
  'active',
  'locked',
  'completed',
  'done',
  'void',
  'deleted',
  'cancelled',
  'canceled',
  '已完成',
  '已生效',
  '已取消'
].includes(normalizeDraftStatus(row))
const hasNumericValue = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value))

const loadMaterialCardStats = async () => {
  const entries = await Promise.allSettled([
    loadAppCardStats({
      request,
      profile: 'public',
      apiUrl: '/raw_materials',
      viewId: 'materials_list',
      stats: [countStat('total')]
    }).then((value) => ['a', value]),
    loadAppCardStats({
      request,
      profile: 'scm',
      apiUrl: '/batch_no_rules',
      viewId: 'batch_no_rules',
      stats: [
        countStat('total'),
        countStat('active', filterPart('status', 'eq', '启用'))
      ]
    }).then((value) => ['batch-rules', value]),
    loadAppCardStats({
      request,
      profile: 'scm',
      apiUrl: '/warehouses',
      viewId: 'warehouses',
      stats: [
        countStat('total'),
        countStat('top', filterPart('level', 'eq', 1))
      ]
    }).then((value) => ['warehouses', value]),
    loadAppCardStats({
      request,
      profile: 'scm',
      apiUrl: '/v_inventory_transactions',
      viewId: 'inventory-ledger',
      stats: [
        countStat('total'),
        countStat('todayMoves', combineQueryParts(filterPart('transaction_date', 'gte', today()), filterPart('transaction_date', 'lte', today())))
      ]
    }).then((value) => ['inventory-ledger', value]),
    loadAppCardStats({
      request,
      profile: 'scm',
      apiUrl: '/v_inventory_drafts?draft_type=eq.in',
      viewId: 'inventory-stock-in',
      stats: [
        countStat('total'),
        countStat('open', filterPart('status', 'not.in', ['active', 'locked', 'completed', 'done', 'void', 'deleted', 'cancelled', 'canceled', '已完成', '已生效', '已取消']))
      ]
    }).then((value) => ['inventory-stock-in', value]),
    loadAppCardStats({
      request,
      profile: 'scm',
      apiUrl: '/v_inventory_drafts?draft_type=eq.out',
      viewId: 'inventory-stock-out',
      stats: [
        countStat('total'),
        countStat('open', filterPart('status', 'not.in', ['active', 'locked', 'completed', 'done', 'void', 'deleted', 'cancelled', 'canceled', '已完成', '已生效', '已取消']))
      ]
    }).then((value) => ['inventory-stock-out', value]),
    loadAppCardStats({
      request,
      profile: 'scm',
      apiUrl: '/v_inventory_current',
      viewId: 'inventory-current',
      stats: [
        countStat('total'),
        countStat('zeroStock', filterPart('available_qty', 'lte', 0)),
        countStat('lowStock', combineQueryParts(filterPart('available_qty', 'gt', 0), filterPart('available_qty', 'lte', 10))),
        countStat('expiring', combineQueryParts(filterPart('expiry_date', 'gte', today()), filterPart('expiry_date', 'lte', offsetDate(30)))),
        countStat('expired', filterPart('expiry_date', 'lt', today()))
      ]
    }).then((value) => ['inventory-current', value])
  ])

  return entries.reduce((acc, item) => {
    if (item.status === 'fulfilled') {
      const [key, value] = item.value
      acc[key] = value || {}
    }
    return acc
  }, {})
}

const cardMap = computed(() => {
  const materials = rowsOf('a')
  const batchRules = rowsOf('batch-rules')
  const warehouses = rowsOf('warehouses')
  const ledger = rowsOf('inventory-ledger')
  const stockIn = rowsOf('inventory-stock-in')
  const stockOut = rowsOf('inventory-stock-out')
  const current = rowsOf('inventory-current')
  const materialStats = statsOf('a')
  const batchRuleStats = statsOf('batch-rules')
  const warehouseStats = statsOf('warehouses')
  const ledgerStats = statsOf('inventory-ledger')
  const stockInStats = statsOf('inventory-stock-in')
  const stockOutStats = statsOf('inventory-stock-out')
  const currentStats = statsOf('inventory-current')

  const materialTotal = statNumber(materialStats, 'total', materials.length)
  const zeroStock = statNumber(currentStats, 'zeroStock', current.filter((row) => numberValue(row.available_qty) <= 0).length)
  const lowStockFallback = current.filter((row) => {
    const qty = numberValue(row.available_qty)
    return qty > 0 && qty <= 10
  }).length
  const lowStock = statNumber(currentStats, 'lowStock', lowStockFallback)
  const expiringFallback = current.filter((row) => {
    const delta = daysBetween(row.expiry_date)
    return delta !== null && delta >= 0 && delta <= 30
  }).length
  const expiredFallback = current.filter((row) => {
    const delta = daysBetween(row.expiry_date)
    return delta !== null && delta < 0
  }).length
  const expiring = statNumber(currentStats, 'expiring', expiringFallback)
  const expired = statNumber(currentStats, 'expired', expiredFallback)
  const openIn = statNumber(stockInStats, 'open', stockIn.filter(isOpenDraft).length)
  const openOut = statNumber(stockOutStats, 'open', stockOut.filter(isOpenDraft).length)
  const outShortage = stockOut.filter((row) => (
    isOpenDraft(row)
    && hasNumericValue(row.available_qty)
    && numberValue(row.quantity) > numberValue(row.available_qty)
  )).length
  const activeRules = statNumber(batchRuleStats, 'active', batchRules.filter((row) => String(row.status || '') === '启用').length)
  const batchRuleTotal = statNumber(batchRuleStats, 'total', batchRules.length)
  const topWarehouses = statNumber(warehouseStats, 'top', warehouses.filter((row) => Number(row.level) === 1).length)
  const warehouseTotal = statNumber(warehouseStats, 'total', warehouses.length)
  const ledgerTotal = statNumber(ledgerStats, 'total', ledger.length)
  const todayMoves = statNumber(ledgerStats, 'todayMoves', ledger.filter((row) => daysBetween(row.transaction_date || row.created_at || row.updated_at) === 0).length)
  const stockInTotal = statNumber(stockInStats, 'total', stockIn.length)

  return {
    a: cardFromScore({
      score: materialTotal ? 25 : 18,
      metrics: [
        { label: '物料数', value: `${materialTotal}` },
        { label: '分类数', value: `${new Set(materials.map((row) => row.category).filter(Boolean)).size}` }
      ],
      brief: materialTotal ? '维护物料主数据' : '先建立物料档案'
    }),
    'batch-rules': cardFromScore({
      score: activeRules ? 25 : 42,
      metrics: [
        { label: '启用规则', value: `${activeRules}` },
        { label: '规则总数', value: `${batchRuleTotal}` }
      ],
      brief: activeRules ? '批次规则可用' : '需要配置批次规则'
    }),
    warehouses: cardFromScore({
      score: warehouseTotal ? 25 : 45,
      metrics: [
        { label: '仓库', value: `${topWarehouses || warehouseTotal}` },
        { label: '库位节点', value: `${warehouseTotal}` }
      ],
      brief: warehouseTotal ? '维护仓库库区库位' : '先建立仓库结构'
    }),
    'inventory-ledger': cardFromScore({
      score: todayMoves > 0 ? 35 : 22,
      metrics: [
        { label: '流水数', value: `${ledgerTotal}` },
        { label: '今日流转', value: `${todayMoves}` }
      ],
      brief: todayMoves > 0 ? '关注今日库存流转' : '查看库存流水'
    }),
    'inventory-stock-in': cardFromScore({
      score: openIn > 0 ? 48 : 24,
      metrics: [
        { label: '待入库', value: `${openIn}` },
        { label: '草稿数', value: `${stockInTotal}` }
      ],
      brief: openIn > 0 ? '处理待完成入库单' : '登记物料入库'
    }),
    'production-stock-in': cardFromScore({
      score: openIn > 0 ? 45 : 24,
      metrics: [
        { label: '待入库', value: `${openIn}` },
        { label: '今日流转', value: `${todayMoves}` }
      ],
      brief: '完工成品入库'
    }),
    'inventory-stock-out': cardFromScore({
      score: outShortage > 0 ? 86 : (openOut > 0 ? 56 : 24),
      metrics: [
        { label: '待出库', value: `${openOut}` },
        { label: '库存不足', value: `${outShortage}` }
      ],
      brief: outShortage > 0 ? '先处理出库库存不足' : (openOut > 0 ? '处理待完成出库单' : '登记批次出库')
    }),
    'production-picking': cardFromScore({
      score: outShortage > 0 ? 82 : (openOut > 0 ? 52 : 24),
      metrics: [
        { label: '待领料', value: `${openOut}` },
        { label: '库存不足', value: `${outShortage}` }
      ],
      brief: outShortage > 0 ? '领料前先补齐库存' : '按工单领料出库'
    }),
    'sales-stock-out': cardFromScore({
      score: outShortage > 0 ? 82 : (openOut > 0 ? 52 : 24),
      metrics: [
        { label: '待发货', value: `${openOut}` },
        { label: '库存不足', value: `${outShortage}` }
      ],
      brief: outShortage > 0 ? '发货前先处理库存不足' : '销售出库执行'
    }),
    'inventory-current': cardFromScore({
      score: zeroStock > 0 || expired > 0 ? 88 : (lowStock > 0 || expiring > 0 ? 68 : 30),
      metrics: [
        { label: '低/零库存', value: `${lowStock}/${zeroStock}` },
        { label: '临/过期', value: `${expiring}/${expired}` }
      ],
      brief: zeroStock > 0 ? '优先处理零库存物料' : (expired > 0 ? '先处理过期批次' : '查看实时库存')
    })
  }
})

const visibleApps = computed(() => apps
  .filter((app) => isAppVisible(displayVisibility.value, 'materials', app.key))
  .filter((app) => app.key !== 'inventory-dashboard' && (!app.perm || hasPerm(app.perm)))
  .map((app) => ({
    ...app,
    card: cardLoading.value && !rowsOf(sourceKeyOf(app)).length
      ? buildGenericCard(app, rowsOf(sourceKeyOf(app)), true)
      : (cardMap.value[sourceKeyOf(app)] || buildGenericCard(app, rowsOf(sourceKeyOf(app)), cardLoading.value))
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
.materials-apps {
  position: relative;
  padding: 20px;
  min-height: 100vh;
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
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  margin-bottom: 20px;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
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
.tone-orange { background: #e6a23c; }
.tone-green { background: #67c23a; }
.tone-purple { background: #9c27b0; }
.tone-cyan { background: #00bcd4; }
.tone-indigo { background: #3f51b5; }
.tone-teal { background: #26a69a; }
.tone-red { background: #ef5350; }
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
  .materials-apps {
    max-width: 1480px;
    margin: 0 auto;
  }
}

@media (max-width: 640px) {
  .materials-apps {
    padding: 14px;
  }

  .metric-item strong {
    min-width: 44px;
    font-size: 15px;
  }
}
</style>
