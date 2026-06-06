<template>
  <div ref="rootRef" class="production-cockpit" :class="{ fullscreen: isFullscreen }" :style="dashboardScaleVars">
    <div class="cockpit-bg"></div>
    <div class="steel-layer"></div>

    <div class="screen-stage">
      <main ref="screenRef" class="screen">
        <header class="screen-header">
        <div class="header-left">
          <div class="title"><span class="title-mark"></span>生产驾驶舱</div>
          <div class="subtitle">PRODUCTION COMMAND CENTER</div>
        </div>
        <div class="header-center">
          <div class="live-badge">
            <span class="pulse-dot"></span>
            <span>计划 · 工单 · 齐套 · 缺料</span>
            <span class="refresh-text">{{ loading ? '同步中' : '实时监控' }}</span>
          </div>
        </div>
        <div class="header-right">
          <div class="clock">{{ clock }}</div>
          <button class="hud-btn" type="button" @click="goApps">应用</button>
          <button class="hud-btn" type="button" :disabled="loading" @click="loadAll">
            {{ loading ? '刷新中' : '刷新' }}
          </button>
          <button
            class="hud-btn primary"
            type="button"
            :disabled="creating || !workOrderCandidatePlanRows.length"
            @click="createWorkOrders"
          >
            {{ creating ? '生成中' : '生成工单' }}
          </button>
          <button class="hud-btn" type="button" @click="toggleFullscreen">{{ isFullscreen ? '退出' : '全屏' }}</button>
        </div>
      </header>

      <section class="screen-body">
        <aside class="side-col left-col">
          <section class="panel kpi-panel">
            <div class="panel-hd">核心指标</div>
            <div class="kpi-grid">
              <div v-for="item in kpiList" :key="item.label" class="kpi-card">
                <div class="kpi-value" :style="{ color: item.color }">{{ item.value }}</div>
                <div class="kpi-label">{{ item.label }}</div>
              </div>
            </div>
          </section>

          <section class="panel status-panel">
            <div class="panel-hd">
              工单结构饼图
              <span class="panel-sub">ORDER MIX</span>
            </div>
            <div class="pie-grid">
              <div class="pie-card">
                <div class="pie-chart" :style="statusPieStyle">
                  <div class="pie-hole">
                    <strong>{{ workOrders.length }}</strong>
                    <span>工单</span>
                  </div>
                </div>
                <div class="pie-legend">
                  <div v-for="item in statusPieRows" :key="item.label" class="legend-row">
                    <span class="legend-dot" :style="{ background: item.color }"></span>
                    <span>{{ item.label }}</span>
                    <strong>{{ item.value }}</strong>
                  </div>
                </div>
              </div>
              <div class="pie-card">
                <div class="pie-chart priority" :style="priorityPieStyle">
                  <div class="pie-hole">
                    <strong>{{ urgentPriorityCount }}</strong>
                    <span>高优</span>
                  </div>
                </div>
                <div class="pie-legend">
                  <div v-for="item in priorityPieRows" :key="item.label" class="legend-row">
                    <span class="legend-dot" :style="{ background: item.color }"></span>
                    <span>{{ item.label }}</span>
                    <strong>{{ item.value }}</strong>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="panel priority-panel">
            <div class="panel-hd">
              计划缺口柱状图
              <span class="panel-sub">{{ numberText(totalPlannedQty) }}</span>
            </div>
            <div class="gap-bars">
              <div v-for="item in productLoadBars.slice(0, 5)" :key="item.key" class="gap-row">
                <span class="gap-name">{{ item.label }}</span>
                <div class="gap-track">
                  <div class="gap-fill" :style="{ width: item.pct + '%' }"></div>
                </div>
                <strong>{{ item.valueText }}</strong>
              </div>
              <div v-if="productLoadBars.length === 0" class="empty-state">暂无生产缺口</div>
            </div>
          </section>
        </aside>

        <section class="center-col">
          <section class="panel load-panel">
            <div class="panel-hd">
              产品生产负荷柱状图
              <span class="panel-sub">TOP {{ productLoadBars.length }}</span>
            </div>
            <div class="load-board">
              <div class="load-summary">
                <div class="core-tile">
                  <span>齐套率</span>
                  <strong>{{ kitRate }}%</strong>
                </div>
                <div class="core-tile warn">
                  <span>缺料工单</span>
                  <strong>{{ shortageWorkOrderCount }}</strong>
                </div>
                <div class="core-tile">
                  <span>生产中</span>
                  <strong>{{ runningWorkOrderCount }}</strong>
                </div>
              </div>
              <div class="column-chart">
                <div v-for="item in productLoadBars" :key="item.key" class="load-column">
                  <div class="column-value">{{ item.valueText }}</div>
                  <div class="column-track">
                    <div class="column-fill" :style="{ height: item.pct + '%' }"></div>
                  </div>
                  <div class="column-label" :title="item.fullLabel">{{ item.shortLabel }}</div>
                </div>
                <div v-if="productLoadBars.length === 0" class="empty-state">暂无生产负荷</div>
              </div>
              <div class="process-strip">
                <div v-for="(node, index) in flowNodes" :key="node.label" class="process-step">
                  <span class="step-no">{{ String(index + 1).padStart(2, '0') }}</span>
                  <strong>{{ node.value }}</strong>
                  <span>{{ node.label }}</span>
                </div>
              </div>
            </div>
          </section>

          <section class="panel plan-panel">
            <div class="panel-hd">
              计划队列
              <span class="panel-sub">{{ planRows.length }} 条计划</span>
            </div>
            <div class="plan-list">
              <button
                v-for="plan in planQueueRows"
                :key="plan.row_no || plan.product_material_id"
                class="plan-row"
                type="button"
                @click="selectWorkOrderByPlan(plan)"
              >
                <span class="plan-date">{{ formatShortDate(plan.earliest_delivery_date) }}</span>
                <span class="plan-main">
                  <strong>{{ plan.product_material_name || plan.product_material_code }}</strong>
                  <span>{{ plan.product_material_code }} · {{ plan.source_order_nos || '无来源订单' }}</span>
                </span>
                <span class="plan-qty">{{ numberText(plan.planned_qty) }} {{ plan.unit }}</span>
                <span class="mini-tag" :class="getPlanStatusClass(plan.plan_status)">{{ plan.plan_status }}</span>
              </button>
              <div v-if="planQueueRows.length === 0" class="empty-state">暂无生产计划</div>
            </div>
          </section>

          <section class="panel trend-panel">
            <div class="panel-hd">计划完工节奏</div>
            <div class="trend-bars">
              <div v-for="item in finishBuckets" :key="item.label" class="trend-item">
                <div class="trend-bar">
                  <div class="trend-fill" :class="{ danger: item.danger }" :style="{ height: item.pct + '%' }"></div>
                </div>
                <div class="trend-label">{{ item.label }}</div>
                <div class="trend-value">{{ item.count }}</div>
              </div>
            </div>
          </section>
        </section>

        <aside class="side-col right-col">
          <section class="panel alert-panel">
            <div class="panel-hd">风险预警</div>
            <div class="alert-list">
              <div v-for="alert in alertList" :key="alert.id" class="alert-row" :class="`alert-${alert.level}`">
                <span class="alert-type">{{ alert.type }}</span>
                <span class="alert-msg">{{ alert.message }}</span>
              </div>
              <div v-if="alertList.length === 0" class="empty-state">暂无风险</div>
            </div>
          </section>

          <section class="panel order-panel">
            <div class="panel-hd">
              工单看板
              <span class="panel-sub">{{ workOrders.length }} 张</span>
            </div>
            <div class="order-list">
              <div
                v-for="order in visibleWorkOrders"
                :key="order.id"
                class="order-row"
                :class="{ active: order.id === selectedWorkOrderId }"
                role="button"
                tabindex="0"
                @click="selectWorkOrder(order)"
                @keydown.enter.prevent="selectWorkOrder(order)"
                @keydown.space.prevent="selectWorkOrder(order)"
              >
                <span class="order-main">
                  <strong>{{ order.work_order_no }}</strong>
                  <span>{{ order.product_material_name || order.product_material_code }}</span>
                </span>
                <span class="order-meta">{{ numberText(order.planned_qty) }} {{ order.unit }}</span>
                <select
                  class="status-select"
                  :value="order.work_order_status"
                  @click.stop
                  @change="updateWorkOrderStatus(order, $event.target.value)"
                >
                  <option v-for="status in workOrderStatuses" :key="status" :value="status">{{ status }}</option>
                </select>
              </div>
              <div v-if="visibleWorkOrders.length === 0" class="empty-state">暂无生产工单</div>
            </div>
          </section>

          <section class="panel material-panel">
            <div class="panel-hd">
              工单用料
              <span class="panel-sub" :class="{ danger: selectedWorkOrder?.shortage_item_count > 0 }">
                {{ selectedWorkOrder ? (selectedWorkOrder.shortage_item_count > 0 ? '存在缺料' : '齐套') : '未选择' }}
              </span>
            </div>
            <div class="material-list">
              <div v-if="selectedWorkOrder" class="selected-order">
                <strong>{{ selectedWorkOrder.product_material_name }}</strong>
                <span>{{ selectedWorkOrder.work_order_no }} · {{ formatDate(selectedWorkOrder.planned_finish_date) }}</span>
              </div>
              <div v-if="itemsLoading" class="empty-state">用料同步中</div>
              <div v-for="item in selectedMaterialRows" :key="item.id" class="material-row">
                <span class="material-main">
                  <strong>{{ item.component_material_name || item.component_material_code }}</strong>
                  <span>{{ item.component_material_code }} · 需 {{ numberText(item.required_qty) }} {{ item.unit }}</span>
                </span>
                <span class="shortage-value" :class="{ danger: numberValue(item.shortage_qty) > 0 }">
                  缺 {{ numberText(item.shortage_qty) }}
                </span>
              </div>
              <div v-if="!itemsLoading && selectedMaterialRows.length === 0" class="empty-state">暂无用料明细</div>
            </div>
          </section>

          <section class="panel shortage-panel">
            <div class="panel-hd">缺料 TOP</div>
            <div class="rank-list">
              <div v-for="(item, index) in topShortageMaterials" :key="item.code" class="rank-row">
                <span class="rank-no">{{ index + 1 }}</span>
                <span class="rank-name">{{ item.name }}</span>
                <span class="rank-amount">{{ numberText(item.qty) }} {{ item.unit }}</span>
              </div>
              <div v-if="topShortageMaterials.length === 0" class="empty-state">暂无缺料</div>
            </div>
          </section>
        </aside>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

const API_BASE = (() => {
  if (typeof window === 'undefined') return '/api'
  if (window.location.port === '8087') return 'http://127.0.0.1:8080/api'
  return '/api'
})()

const router = useRouter()
const workOrderStatuses = ['待排产', '已排产', '生产中', '已完工', '已取消']

const rootRef = ref(null)
const screenRef = ref(null)
const loading = ref(false)
const creating = ref(false)
const itemsLoading = ref(false)
const isFullscreen = ref(false)
const clock = ref('')
const planRows = ref([])
const workOrders = ref([])
const workOrderItems = ref([])
const allWorkOrderItems = ref([])
const selectedWorkOrderId = ref('')

let clockTimer = null
let refreshTimer = null
let resizeObserver = null
let resizeFrame = 0

const dashboardDesignWidth = 1600
const dashboardDesignHeight = 900
const dashboardFrame = ref({
  scale: 1,
  width: dashboardDesignWidth,
  height: dashboardDesignHeight
})

const dashboardScaleVars = computed(() => ({
  '--screen-width': `${dashboardDesignWidth}px`,
  '--screen-height': `${dashboardDesignHeight}px`,
  '--stage-width': `${dashboardFrame.value.width}px`,
  '--stage-height': `${dashboardFrame.value.height}px`,
  '--dashboard-scale': dashboardFrame.value.scale
}))

const statusColors = {
  ok: 'var(--c-green)',
  warn: 'var(--c-amber)',
  danger: 'var(--c-red)',
  info: 'var(--c-primary)',
  accent: 'var(--c-accent)'
}

const numberValue = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const numberText = (value) => {
  const num = numberValue(value)
  if (Math.abs(num) >= 10000) return `${(num / 10000).toFixed(1)}万`
  if (Math.abs(num) >= 1000) return `${(num / 1000).toFixed(1)}k`
  return Number.isInteger(num) ? String(num) : num.toFixed(2)
}

const formatDate = (value) => value ? String(value).slice(0, 10) : '-'

const formatShortDate = (value) => {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return `${date.getMonth() + 1}/${date.getDate()}`
}

const todayStart = () => {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date
}

const dateValue = (value) => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

const daysFromToday = (value) => {
  const date = dateValue(value)
  if (!date) return null
  return Math.floor((date.getTime() - todayStart().getTime()) / 86400000)
}

const selectedWorkOrder = computed(() => workOrders.value.find(row => row.id === selectedWorkOrderId.value) || null)
const pendingPlanRows = computed(() => planRows.value.filter(row => row.plan_status === '待生成工单' && numberValue(row.planned_qty) > 0))
const workOrderCandidatePlanRows = computed(() => planRows.value.filter(row => numberValue(row.planned_qty) > 0))
const totalPlannedQty = computed(() => planRows.value.reduce((sum, row) => sum + numberValue(row.planned_qty), 0))
const totalSalesQty = computed(() => planRows.value.reduce((sum, row) => sum + numberValue(row.sales_qty), 0))
const openWorkOrderCount = computed(() => workOrders.value.filter(row => !['已完工', '已取消'].includes(row.work_order_status)).length)
const shortageWorkOrderCount = computed(() => workOrders.value.filter(row => numberValue(row.shortage_item_count) > 0).length)
const runningWorkOrderCount = computed(() => workOrders.value.filter(row => row.work_order_status === '生产中').length)
const completedWorkOrderCount = computed(() => workOrders.value.filter(row => row.work_order_status === '已完工').length)
const kitRate = computed(() => {
  if (!workOrders.value.length) return 0
  const ready = workOrders.value.filter(row => numberValue(row.shortage_item_count) <= 0).length
  return Math.round((ready / workOrders.value.length) * 100)
})

const kpiList = computed(() => [
  { label: '待生成计划', value: pendingPlanRows.value.length, color: statusColors.warn },
  { label: '建议生产量', value: numberText(totalPlannedQty.value), color: statusColors.info },
  { label: '未关闭工单', value: openWorkOrderCount.value, color: statusColors.accent },
  { label: '缺料工单', value: shortageWorkOrderCount.value, color: statusColors.danger },
  { label: '生产中', value: runningWorkOrderCount.value, color: statusColors.ok },
  { label: '已完工', value: completedWorkOrderCount.value, color: statusColors.ok }
])

const workOrderStatusRows = computed(() => {
  const palette = {
    待排产: statusColors.warn,
    已排产: statusColors.info,
    生产中: statusColors.ok,
    已完工: statusColors.accent,
    已取消: statusColors.danger
  }
  const rows = workOrderStatuses.map(label => ({
    label,
    value: workOrders.value.filter(row => row.work_order_status === label).length,
    color: palette[label] || statusColors.info
  }))
  const max = Math.max(...rows.map(row => row.value), 1)
  return rows.map(row => ({ ...row, pct: Math.max(row.value ? 8 : 0, Math.round(row.value / max * 100)) }))
})

const statusPieRows = computed(() => workOrderStatusRows.value.filter(row => row.value > 0 || workOrders.value.length === 0))

const priorityPieRows = computed(() => {
  const priorities = [
    { label: '紧急', color: statusColors.danger },
    { label: '高', color: statusColors.warn },
    { label: '普通', color: statusColors.info },
    { label: '低', color: statusColors.accent }
  ]
  const total = Math.max(workOrders.value.length, 1)
  return priorities.map(item => {
    const value = workOrders.value.filter(row => row.priority === item.label).length
    return { ...item, value, pct: Math.round(value / total * 100) }
  })
})

const urgentPriorityCount = computed(() => {
  return workOrders.value.filter(row => ['紧急', '高'].includes(row.priority)).length
})

const buildPieStyle = (rows) => {
  const total = rows.reduce((sum, row) => sum + numberValue(row.value), 0)
  if (total <= 0) {
    return { background: 'conic-gradient(rgba(148, 163, 184, 0.24) 0deg 360deg)' }
  }
  let cursor = 0
  const segments = rows
    .filter(row => numberValue(row.value) > 0)
    .map((row) => {
      const next = cursor + numberValue(row.value) / total * 360
      const segment = `${row.color} ${cursor.toFixed(2)}deg ${next.toFixed(2)}deg`
      cursor = next
      return segment
    })
  return { background: `conic-gradient(${segments.join(', ')})` }
}

const statusPieStyle = computed(() => buildPieStyle(statusPieRows.value))
const priorityPieStyle = computed(() => buildPieStyle(priorityPieRows.value))

const flowNodes = computed(() => [
  { label: '销售需求', value: numberText(totalSalesQty.value) },
  { label: 'BOM/MRP', value: planRows.value.length },
  { label: '生产工单', value: workOrders.value.length },
  { label: '齐套领料', value: `${kitRate.value}%` },
  { label: '完工入库', value: completedWorkOrderCount.value }
])

const productLoadBars = computed(() => {
  const map = new Map()
  const add = (row, qty) => {
    const key = row.product_material_id || row.product_material_code || row.id
    if (!key) return
    const current = map.get(key) || {
      key,
      label: row.product_material_name || row.product_material_code || '未命名产品',
      code: row.product_material_code || '',
      qty: 0,
      unit: row.unit || ''
    }
    current.qty += numberValue(qty)
    if (!current.unit && row.unit) current.unit = row.unit
    map.set(key, current)
  }

  planRows.value.forEach(row => add(row, row.planned_qty))
  if (map.size === 0) {
    workOrders.value.forEach(row => add(row, row.planned_qty))
  }

  const rows = Array.from(map.values())
    .filter(row => row.qty > 0)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 8)
  const max = Math.max(...rows.map(row => row.qty), 1)
  return rows.map((row) => ({
    ...row,
    pct: Math.max(8, Math.round(row.qty / max * 100)),
    valueText: `${numberText(row.qty)}${row.unit || ''}`,
    fullLabel: row.code ? `${row.code} ${row.label}` : row.label,
    shortLabel: row.label.length > 5 ? row.label.slice(0, 5) : row.label
  }))
})

const planQueueRows = computed(() => {
  return [...planRows.value]
    .sort((a, b) => {
      const statusA = a.plan_status === '待生成工单' ? 0 : 1
      const statusB = b.plan_status === '待生成工单' ? 0 : 1
      if (statusA !== statusB) return statusA - statusB
      return String(a.earliest_delivery_date || '9999').localeCompare(String(b.earliest_delivery_date || '9999'))
    })
    .slice(0, 6)
})

const finishBuckets = computed(() => {
  const today = todayStart()
  const buckets = [
    { label: '逾期', count: 0, pct: 0, danger: true, dateKey: '' },
    ...Array.from({ length: 6 }).map((_, index) => {
      const date = new Date(today)
      date.setDate(today.getDate() + index)
      return {
        label: index === 0 ? '今日' : `${date.getMonth() + 1}/${date.getDate()}`,
        count: 0,
        pct: 0,
        danger: false,
        dateKey: date.toISOString().slice(0, 10)
      }
    })
  ]

  workOrders.value.forEach((order) => {
    if (!order.planned_finish_date || ['已完工', '已取消'].includes(order.work_order_status)) return
    const days = daysFromToday(order.planned_finish_date)
    if (days === null) return
    if (days < 0) {
      buckets[0].count += 1
      return
    }
    const target = buckets[days + 1]
    if (target) target.count += 1
  })

  const max = Math.max(...buckets.map(item => item.count), 1)
  return buckets.map(item => ({ ...item, pct: item.count ? Math.max(8, Math.round(item.count / max * 100)) : 4 }))
})

const alertList = computed(() => {
  const rows = []
  if (pendingPlanRows.value.length > 0) {
    rows.push({ id: 'pending-plan', level: 'warning', type: '计划', message: `${pendingPlanRows.value.length} 条销售 BOM 计划待生成工单` })
  }
  if (shortageWorkOrderCount.value > 0) {
    rows.push({ id: 'shortage-order', level: 'danger', type: '缺料', message: `${shortageWorkOrderCount.value} 张工单存在缺料项` })
  }

  workOrders.value.forEach((order) => {
    if (['已完工', '已取消'].includes(order.work_order_status)) return
    const days = daysFromToday(order.planned_finish_date)
    if (days !== null && days < 0) {
      rows.push({ id: `late-${order.id}`, level: 'danger', type: '交期', message: `${order.work_order_no} 计划完工已逾期` })
    } else if (days !== null && days <= 2) {
      rows.push({ id: `near-${order.id}`, level: 'warning', type: '交期', message: `${order.work_order_no} ${days === 0 ? '今日' : `${days}天后`}完工` })
    }
    if (['紧急', '高'].includes(order.priority)) {
      rows.push({ id: `priority-${order.id}`, level: 'warning', type: '优先级', message: `${order.work_order_no} 为${order.priority}优先级` })
    }
  })

  if (!workOrders.value.length && planRows.value.length > 0) {
    rows.push({ id: 'no-work-orders', level: 'warning', type: '工单', message: '已有生产计划但尚未生成生产工单' })
  }

  return rows.slice(0, 8)
})

const visibleWorkOrders = computed(() => {
  return [...workOrders.value]
    .sort((a, b) => {
      const shortageA = numberValue(a.shortage_item_count) > 0 ? 0 : 1
      const shortageB = numberValue(b.shortage_item_count) > 0 ? 0 : 1
      if (shortageA !== shortageB) return shortageA - shortageB
      return String(b.created_at || '').localeCompare(String(a.created_at || ''))
    })
    .slice(0, 7)
})

const selectedMaterialRows = computed(() => {
  return [...workOrderItems.value]
    .sort((a, b) => numberValue(b.shortage_qty) - numberValue(a.shortage_qty))
    .slice(0, 6)
})

const topShortageMaterials = computed(() => {
  const source = allWorkOrderItems.value.length ? allWorkOrderItems.value : workOrderItems.value
  const map = new Map()
  source.forEach((item) => {
    const qty = numberValue(item.shortage_qty)
    if (qty <= 0) return
    const code = item.component_material_code || item.id
    const current = map.get(code) || {
      code,
      name: item.component_material_name || item.component_material_code || '未知物料',
      qty: 0,
      unit: item.unit || ''
    }
    current.qty += qty
    if (!current.unit && item.unit) current.unit = item.unit
    map.set(code, current)
  })
  return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 5)
})

const parseStoredToken = (raw) => {
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.token) return String(parsed.token)
  } catch {
    // localStorage may contain a plain token.
  }
  return String(raw)
}

const getAuthHeader = () => {
  if (typeof localStorage === 'undefined') return {}
  const token = parseStoredToken(localStorage.getItem('auth_token'))
  if (token && token.length > 8192) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_info')
    return {}
  }
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const getCurrentUserName = () => {
  if (typeof localStorage === 'undefined') return 'BOM-MRP'
  try {
    const info = JSON.parse(localStorage.getItem('user_info') || '{}')
    return info.username || info.name || info.id || 'BOM-MRP'
  } catch {
    return 'BOM-MRP'
  }
}

const apiRequest = async (path, options = {}) => {
  const headers = {
    Accept: 'application/json',
    'Accept-Profile': 'scm',
    ...getAuthHeader(),
    ...(options.headers || {})
  }
  const method = String(options.method || 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json'
    headers['Content-Profile'] = headers['Content-Profile'] || 'scm'
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    method,
    headers,
    body: options.body !== undefined ? options.body : (options.data ? JSON.stringify(options.data) : undefined)
  })

  if (response.status === 204) return null

  const text = await response.text()
  const data = text ? JSON.parse(text) : null
  if (!response.ok) {
    throw new Error(data?.message || data?.hint || data?.details || response.statusText || '请求失败')
  }
  return data
}

const loadPlans = async () => {
  const rows = await apiRequest('/v_sales_bom_production_plan?select=*&order=product_material_code.asc')
  planRows.value = Array.isArray(rows) ? rows : []
}

const loadWorkOrders = async () => {
  const rows = await apiRequest('/v_production_work_orders?select=*&order=created_at.desc')
  workOrders.value = Array.isArray(rows) ? rows : []
  if (!selectedWorkOrderId.value && workOrders.value.length) {
    selectedWorkOrderId.value = workOrders.value[0].id
  }
  if (selectedWorkOrderId.value && !workOrders.value.some(row => row.id === selectedWorkOrderId.value)) {
    selectedWorkOrderId.value = workOrders.value[0]?.id || ''
  }
}

const loadAllWorkOrderItems = async () => {
  const rows = await apiRequest('/v_production_work_order_items?select=*&order=shortage_qty.desc,line_no.asc&limit=2000')
  allWorkOrderItems.value = Array.isArray(rows) ? rows : []
}

const loadWorkOrderItems = async () => {
  if (!selectedWorkOrderId.value) {
    workOrderItems.value = []
    return
  }
  itemsLoading.value = true
  try {
    const rows = await apiRequest(`/v_production_work_order_items?work_order_id=eq.${encodeURIComponent(selectedWorkOrderId.value)}&order=line_no.asc`)
    workOrderItems.value = Array.isArray(rows) ? rows : []
  } finally {
    itemsLoading.value = false
  }
}

const loadAll = async () => {
  loading.value = true
  try {
    await Promise.all([loadPlans(), loadWorkOrders(), loadAllWorkOrderItems()])
    await loadWorkOrderItems()
  } catch (error) {
    ElMessage.error(error.message || '生产数据加载失败')
  } finally {
    loading.value = false
  }
}

const selectWorkOrder = async (row) => {
  if (!row?.id || selectedWorkOrderId.value === row.id) return
  selectedWorkOrderId.value = row.id
  await loadWorkOrderItems()
}

const selectWorkOrderByPlan = async (plan) => {
  const target = workOrders.value.find(row => Number(row.product_material_id) === Number(plan.product_material_id))
  if (!target) return
  await selectWorkOrder(target)
}

const createWorkOrders = async () => {
  creating.value = true
  try {
    const rows = await apiRequest('/rpc/create_work_orders_from_sales_bom', {
      method: 'POST',
      data: { p_created_by: getCurrentUserName() || 'BOM-MRP' }
    })
    ElMessage.success(`已生成/更新 ${Array.isArray(rows) ? rows.length : 0} 张生产工单`)
    await loadAll()
  } catch (error) {
    ElMessage.error(error.message || '生成生产工单失败')
  } finally {
    creating.value = false
  }
}

const updateWorkOrderStatus = async (row, status) => {
  if (!row?.id) return
  try {
    await apiRequest(`/production_work_orders?id=eq.${encodeURIComponent(row.id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      data: { work_order_status: status }
    })
    ElMessage.success('工单状态已更新')
    await loadWorkOrders()
  } catch (error) {
    ElMessage.error(error.message || '工单状态更新失败')
    await loadWorkOrders()
  }
}

const getPlanStatusClass = (status) => {
  if (status === '待生成工单') return 'warn'
  if (status === '已有工单') return 'ok'
  return 'info'
}

const updateClock = () => {
  clock.value = new Date().toLocaleString('zh-CN', { hour12: false })
}

const updateDashboardScale = () => {
  const root = rootRef.value
  if (!root || typeof window === 'undefined') return
  const style = window.getComputedStyle(root)
  const paddingX = parseFloat(style.paddingLeft || 0) + parseFloat(style.paddingRight || 0)
  const paddingY = parseFloat(style.paddingTop || 0) + parseFloat(style.paddingBottom || 0)
  const availableWidth = Math.max(root.clientWidth - paddingX, 320)
  const availableHeight = Math.max(root.clientHeight - paddingY, 180)
  const scale = Math.min(availableWidth / dashboardDesignWidth, availableHeight / dashboardDesignHeight)
  const nextScale = Math.max(0.2, Number(scale.toFixed(4)))
  dashboardFrame.value = {
    scale: nextScale,
    width: Math.round(dashboardDesignWidth * nextScale),
    height: Math.round(dashboardDesignHeight * nextScale)
  }
}

const scheduleDashboardScale = () => {
  if (typeof window === 'undefined') return
  if (resizeFrame) cancelAnimationFrame(resizeFrame)
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0
    updateDashboardScale()
  })
}

const toggleFullscreen = () => {
  if (typeof document === 'undefined') return
  const target = rootRef.value || screenRef.value || document.documentElement
  try {
    if (!document.fullscreenElement) {
      const result = target.requestFullscreen?.()
      if (result?.catch) result.catch(() => {})
    } else {
      const result = document.exitFullscreen?.()
      if (result?.catch) result.catch(() => {})
    }
  } catch {
    // 浏览器或嵌入容器拒绝全屏时保持大屏布局，不打断页面操作。
  } finally {
    isFullscreen.value = Boolean(document.fullscreenElement)
    scheduleDashboardScale()
  }
}

const syncFullscreenState = () => {
  isFullscreen.value = !!document.fullscreenElement
  scheduleDashboardScale()
}

const goApps = () => {
  router.push('/apps')
}

onMounted(() => {
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
  loadAll()
  refreshTimer = setInterval(loadAll, 30000)
  document.addEventListener('fullscreenchange', syncFullscreenState)
  window.addEventListener('resize', scheduleDashboardScale)
  if (window.ResizeObserver && rootRef.value) {
    resizeObserver = new ResizeObserver(scheduleDashboardScale)
    resizeObserver.observe(rootRef.value)
  }
  scheduleDashboardScale()
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
  if (refreshTimer) clearInterval(refreshTimer)
  if (resizeObserver) resizeObserver.disconnect()
  if (resizeFrame) cancelAnimationFrame(resizeFrame)
  window.removeEventListener('resize', scheduleDashboardScale)
  document.removeEventListener('fullscreenchange', syncFullscreenState)
})
</script>

<style scoped>
.production-cockpit {
  --bg: #15181a;
  --panel: rgba(31, 35, 36, 0.9);
  --panel-soft: rgba(43, 48, 47, 0.74);
  --border: rgba(255, 176, 32, 0.36);
  --line: rgba(255, 255, 255, 0.08);
  --text1: #f5f7f2;
  --text2: #c7cabd;
  --text3: #818779;
  --c-primary: #ffb020;
  --c-accent: #4fb3ff;
  --c-green: #36d17c;
  --c-amber: #ffb020;
  --c-red: #ff5c5c;
  --screen-width: 1600px;
  --screen-height: 900px;
  --stage-width: 1600px;
  --stage-height: 900px;
  --dashboard-scale: 1;
  position: relative;
  width: 100%;
  min-width: 0;
  height: 100%;
  min-height: min(720px, 100vh);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  box-sizing: border-box;
  color: var(--text1);
  background: var(--bg);
  container-type: size;
  font-family: "DIN Alternate", "Helvetica Neue", "PingFang SC", sans-serif;
}

.production-cockpit.fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  width: 100vw;
  height: 100vh;
  min-height: 0;
  padding: 0;
}

.production-cockpit:fullscreen {
  width: 100vw;
  height: 100vh;
  min-height: 0;
  padding: 12px;
  background: var(--bg);
}

.cockpit-bg,
.steel-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.cockpit-bg {
  background:
    linear-gradient(115deg, rgba(255, 176, 32, 0.1) 0 11%, transparent 11% 100%),
    linear-gradient(245deg, rgba(54, 209, 124, 0.08) 0 10%, transparent 10% 100%),
    linear-gradient(180deg, #181b1d 0%, #101213 100%);
}

.steel-layer {
  opacity: 0.78;
  background:
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.04) 0 1px, transparent 1px 14px),
    linear-gradient(90deg, transparent 0 31%, rgba(255, 176, 32, 0.08) 31% 31.3%, transparent 31.3% 68%, rgba(54, 209, 124, 0.06) 68% 68.3%, transparent 68.3%);
}

.screen-stage {
  position: relative;
  z-index: 2;
  width: var(--stage-width);
  height: var(--stage-height);
  flex: 0 0 auto;
  overflow: visible;
}

.screen {
  position: relative;
  width: var(--screen-width);
  height: var(--screen-height);
  aspect-ratio: 16 / 9;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: scale(var(--dashboard-scale));
  transform-origin: top left;
  border: 1px solid rgba(255, 176, 32, 0.28);
  background: linear-gradient(180deg, rgba(28, 32, 32, 0.94), rgba(18, 21, 21, 0.92));
  box-shadow: 0 18px 44px rgba(0, 0, 0, 0.32);
}

.screen-header {
  height: 58px;
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr 1.05fr 1.25fr;
  align-items: center;
  padding: 0 18px;
  border-bottom: 2px solid rgba(255, 176, 32, 0.36);
  background:
    linear-gradient(90deg, rgba(255, 176, 32, 0.18), transparent 42%),
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0 1px, transparent 1px 10px),
    rgba(28, 31, 31, 0.9);
}

.title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text1);
  font-size: 21px;
  font-weight: 900;
  letter-spacing: 1px;
}

.title-mark {
  width: 18px;
  height: 18px;
  border: 3px solid var(--c-primary);
  border-left-color: transparent;
  transform: skewX(-16deg);
  box-shadow: 5px 0 0 rgba(255, 176, 32, 0.24);
}

.subtitle {
  margin-top: 2px;
  color: var(--text3);
  font-size: 10px;
  letter-spacing: 3px;
}

.header-center {
  display: flex;
  justify-content: center;
  min-width: 0;
}

.live-badge {
  max-width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 18px;
  clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
  background: rgba(255, 176, 32, 0.12);
  border: 1px solid rgba(255, 176, 32, 0.32);
  color: var(--c-primary);
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--c-green);
  animation: pulse 1.8s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(54, 209, 124, 0.65); }
  70% { box-shadow: 0 0 0 8px rgba(54, 209, 124, 0); }
  100% { box-shadow: 0 0 0 0 rgba(54, 209, 124, 0); }
}

.refresh-text {
  color: var(--text2);
  font-size: 11px;
}

.header-right {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.clock {
  min-width: 166px;
  color: var(--text1);
  font-size: 15px;
  font-weight: 800;
  text-align: right;
}

.hud-btn {
  height: 30px;
  padding: 0 10px;
  border: 1px solid rgba(255, 176, 32, 0.4);
  background: rgba(255, 176, 32, 0.08);
  color: var(--c-primary);
  cursor: pointer;
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
  clip-path: polygon(7px 0, 100% 0, calc(100% - 7px) 100%, 0 100%);
}

.hud-btn.primary {
  border-color: rgba(54, 209, 124, 0.5);
  background: rgba(54, 209, 124, 0.1);
  color: var(--c-green);
}

.hud-btn:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.hud-btn:not(:disabled):hover {
  background: rgba(255, 176, 32, 0.18);
}

.screen-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 24% 1fr 29%;
  gap: 12px;
  padding: 12px;
}

.side-col,
.center-col {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid rgba(255, 176, 32, 0.26);
  background:
    linear-gradient(180deg, rgba(42, 47, 46, 0.86), rgba(24, 28, 27, 0.88)),
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0 1px, transparent 1px 12px);
  clip-path: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

.panel-hd {
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 12px;
  border-bottom: 1px solid rgba(255, 176, 32, 0.26);
  background: linear-gradient(90deg, rgba(255, 176, 32, 0.16), rgba(255, 176, 32, 0.02));
  color: var(--c-primary);
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 1px;
}

.panel-sub {
  min-width: 0;
  overflow: hidden;
  color: var(--text3);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-sub.danger {
  color: var(--c-red);
}

.kpi-panel {
  flex: 1.12;
}

.status-panel {
  flex: 1.28;
}

.priority-panel {
  flex: 0.92;
}

.kpi-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 10px;
}

.kpi-card {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  padding: 8px 10px;
  border-left: 3px solid rgba(255, 176, 32, 0.62);
  background: rgba(255, 255, 255, 0.045);
}

.kpi-value {
  max-width: 100%;
  overflow: hidden;
  font-size: 22px;
  font-weight: 900;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kpi-label {
  margin-top: 5px;
  color: var(--text2);
  font-size: 11px;
}

.pie-grid {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 10px;
}

.pie-card {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: minmax(76px, 1fr) auto;
  gap: 7px;
  align-items: center;
  justify-items: center;
  background: rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.pie-chart {
  position: relative;
  width: min(112px, 76%);
  aspect-ratio: 1;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.1);
}

.pie-chart.priority {
  transform: rotate(8deg);
}

.pie-hole {
  position: absolute;
  inset: 22%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #202423;
}

.pie-hole strong {
  color: var(--text1);
  font-size: 21px;
  line-height: 1;
}

.pie-hole span {
  margin-top: 4px;
  color: var(--text3);
  font-size: 10px;
}

.pie-legend {
  width: 100%;
  min-width: 0;
  padding: 0 7px 7px;
  box-sizing: border-box;
}

.legend-row {
  min-width: 0;
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  gap: 5px;
  align-items: center;
  margin-top: 4px;
  color: var(--text2);
  font-size: 10px;
}

.legend-row span:nth-child(2) {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-row strong {
  color: var(--text1);
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 2px;
}

.gap-bars {
  flex: 1;
  min-height: 0;
  padding: 10px;
}

.gap-row {
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr) 54px;
  gap: 8px;
  align-items: center;
  margin-bottom: 9px;
  font-size: 11px;
}

.gap-name {
  min-width: 0;
  overflow: hidden;
  color: var(--text2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gap-track {
  height: 9px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
}

.gap-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--c-primary), var(--c-green));
}

.gap-row strong {
  color: var(--text1);
  font-size: 10px;
  text-align: right;
  white-space: nowrap;
}

.load-panel {
  flex: 1;
}

.load-board {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-rows: 54px minmax(0, 1fr) 64px;
  gap: 10px;
  padding: 12px;
}

.load-summary {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.core-tile {
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 12px;
  background: rgba(54, 209, 124, 0.09);
  border-left: 4px solid var(--c-green);
}

.core-tile.warn {
  background: rgba(255, 92, 92, 0.09);
  border-left-color: var(--c-red);
}

.core-tile span {
  color: var(--text2);
  font-size: 12px;
}

.core-tile strong {
  color: var(--text1);
  font-size: 26px;
  line-height: 1;
}

.column-chart {
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 12px;
  align-items: end;
  padding: 10px 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  background:
    linear-gradient(rgba(255, 255, 255, 0.06) 1px, transparent 1px),
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent);
  background-size: 100% 25%;
}

.load-column {
  min-width: 0;
  height: 100%;
  display: grid;
  grid-template-rows: 18px minmax(0, 1fr) 28px;
  justify-items: center;
  align-items: end;
}

.column-value {
  max-width: 100%;
  overflow: hidden;
  color: var(--c-primary);
  font-size: 11px;
  font-weight: 900;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.column-track {
  width: 42%;
  height: 100%;
  min-height: 64px;
  display: flex;
  align-items: end;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.column-fill {
  width: 100%;
  min-height: 7px;
  background:
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.22) 0 2px, transparent 2px 7px),
    linear-gradient(180deg, var(--c-primary), #fb7a24);
}

.column-label {
  max-width: 100%;
  overflow: hidden;
  color: var(--text2);
  font-size: 11px;
  line-height: 1.2;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.process-strip {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.process-step {
  min-width: 0;
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  grid-template-rows: 1fr 1fr;
  align-items: center;
  column-gap: 8px;
  padding: 8px;
  background: rgba(255, 255, 255, 0.045);
  border-top: 2px solid rgba(255, 176, 32, 0.38);
}

.step-no {
  grid-row: 1 / 3;
  color: var(--c-primary);
  font-size: 15px;
  font-weight: 900;
}

.process-step strong {
  min-width: 0;
  overflow: hidden;
  color: var(--text1);
  font-size: 18px;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.process-step span:last-child {
  min-width: 0;
  overflow: hidden;
  color: var(--text3);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plan-panel {
  height: 25%;
  flex-shrink: 0;
}

.trend-panel {
  height: 22%;
  flex-shrink: 0;
}

.plan-list,
.alert-list,
.order-list,
.material-list,
.rank-list {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 10px;
}

.plan-list,
.order-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.plan-row,
.order-row {
  min-width: 0;
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.045);
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.plan-row {
  height: 30px;
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 74px 76px;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
}

.plan-row:hover,
.order-row:hover,
.order-row.active {
  border-color: rgba(255, 176, 32, 0.46);
  background: rgba(255, 176, 32, 0.1);
}

.plan-date {
  color: var(--c-primary);
  font-size: 11px;
  font-weight: 900;
}

.plan-main,
.order-main,
.material-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.plan-main strong,
.order-main strong,
.material-main strong,
.selected-order strong {
  min-width: 0;
  overflow: hidden;
  color: var(--text1);
  font-size: 12px;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plan-main span,
.order-main span,
.material-main span,
.selected-order span {
  min-width: 0;
  overflow: hidden;
  color: var(--text3);
  font-size: 10px;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.plan-qty {
  color: var(--text2);
  font-size: 11px;
  font-weight: 900;
  text-align: right;
  white-space: nowrap;
}

.mini-tag {
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  border: 1px solid rgba(79, 179, 255, 0.3);
  color: var(--c-accent);
  font-size: 10px;
  font-weight: 900;
  white-space: nowrap;
}

.mini-tag.warn {
  border-color: rgba(255, 176, 32, 0.38);
  color: var(--c-primary);
}

.mini-tag.ok {
  border-color: rgba(54, 209, 124, 0.38);
  color: var(--c-green);
}

.trend-bars {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 10px;
  align-items: end;
  padding: 10px 14px;
}

.trend-item {
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.trend-bar {
  flex: 1;
  width: 20px;
  min-height: 44px;
  display: flex;
  align-items: end;
  background: rgba(255, 255, 255, 0.08);
}

.trend-fill {
  width: 100%;
  min-height: 4px;
  background: linear-gradient(180deg, var(--c-green), #168f57);
}

.trend-fill.danger {
  background: linear-gradient(180deg, var(--c-red), #b91c1c);
}

.trend-label,
.trend-value {
  color: var(--text2);
  font-size: 10px;
  line-height: 1;
}

.alert-panel {
  flex: 1.05;
}

.order-panel {
  flex: 1.1;
}

.material-panel {
  flex: 1.15;
}

.shortage-panel {
  flex: 0.9;
}

.alert-row,
.material-row,
.rank-row,
.selected-order {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
  padding: 7px 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.045);
  font-size: 12px;
}

.alert-row {
  display: grid;
  grid-template-columns: 40px 1fr;
  border-left: 3px solid var(--c-primary);
  background: rgba(255, 176, 32, 0.08);
}

.alert-danger {
  border-left-color: var(--c-red);
  background: rgba(255, 92, 92, 0.1);
}

.alert-type {
  color: var(--c-primary);
  font-weight: 900;
}

.alert-msg,
.rank-name {
  min-width: 0;
  overflow: hidden;
  color: var(--text2);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.order-row {
  height: 36px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 62px 82px;
  align-items: center;
  gap: 7px;
  padding: 0 7px;
}

.order-meta {
  color: var(--text2);
  font-size: 11px;
  font-weight: 900;
  text-align: right;
  white-space: nowrap;
}

.status-select {
  width: 82px;
  height: 24px;
  min-width: 0;
  border: 1px solid rgba(255, 176, 32, 0.3);
  outline: none;
  background: rgba(22, 25, 24, 0.95);
  color: var(--text1);
  font-size: 11px;
}

.selected-order {
  align-items: flex-start;
  flex-direction: column;
  gap: 3px;
  border-color: rgba(54, 209, 124, 0.24);
  background: rgba(54, 209, 124, 0.07);
}

.material-row {
  min-height: 32px;
  margin-bottom: 5px;
}

.material-main {
  flex: 1;
}

.shortage-value {
  color: var(--c-green);
  font-size: 11px;
  font-weight: 900;
  white-space: nowrap;
}

.shortage-value.danger {
  color: var(--c-red);
}

.rank-no {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 176, 32, 0.12);
  color: var(--c-primary);
  font-weight: 900;
}

.rank-name {
  flex: 1;
}

.rank-amount {
  margin-left: auto;
  color: var(--c-primary);
  font-size: 11px;
  white-space: nowrap;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  color: var(--text3);
  font-size: 12px;
}

@media (max-width: 1100px) {
  .screen-header {
    grid-template-columns: 1fr auto;
  }

  .header-center {
    display: none;
  }

  .clock {
    min-width: 0;
    display: none;
  }
}

@media (max-width: 760px) {
  .production-cockpit {
    align-items: center;
    justify-content: center;
    padding: 8px;
  }

  .screen-header {
    grid-template-columns: 1fr 1.05fr 1.25fr;
  }

  .header-right {
    justify-content: flex-end;
    flex-wrap: nowrap;
  }

  .screen-body {
    grid-template-columns: 24% 1fr 29%;
  }
}
</style>
