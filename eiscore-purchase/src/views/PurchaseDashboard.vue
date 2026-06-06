<template>
  <div ref="rootRef" class="purchase-cockpit" :class="{ fullscreen: isFullscreen }" :style="dashboardScaleVars">
    <div class="cockpit-bg"></div>
    <div class="scan-layer"></div>

    <div class="screen-stage">
      <main ref="screenRef" class="screen">
        <header class="screen-header">
        <div class="header-left">
          <div class="title"><span class="title-mark"></span>采购驾驶舱</div>
          <div class="subtitle">PURCHASE COMMAND CENTER</div>
        </div>
        <div class="header-center">
          <div class="live-badge">
            <span class="pulse-dot"></span>
            <span>供应 · 需求 · 订单 · 到货</span>
            <span class="refresh-text">{{ loading ? '同步中' : '实时监控' }}</span>
          </div>
        </div>
        <div class="header-right">
          <div class="clock">{{ clock }}</div>
          <button class="hud-btn" @click="goApps">应用</button>
          <button class="hud-btn" @click="toggleFullscreen">{{ isFullscreen ? '退出' : '全屏' }}</button>
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

          <section class="panel">
            <div class="panel-hd">需求状态</div>
            <div class="funnel">
              <div v-for="item in demandStatusRows" :key="item.label" class="bar-row">
                <span class="bar-label">{{ item.label }}</span>
                <div class="bar-track">
                  <div class="bar-fill" :style="{ width: item.pct + '%', background: item.color }"></div>
                </div>
                <span class="bar-value">{{ item.value }}</span>
              </div>
            </div>
          </section>

          <section class="panel">
            <div class="panel-hd">供应商结构</div>
            <div class="supplier-ring">
              <svg viewBox="0 0 140 140" class="ring-svg">
                <circle cx="70" cy="70" r="52" class="ring-track" />
                <circle
                  cx="70"
                  cy="70"
                  r="52"
                  class="ring-fill"
                  :stroke-dasharray="supplierRingDash"
                />
                <text x="70" y="66" text-anchor="middle" class="ring-value">{{ supplierHealth }}%</text>
                <text x="70" y="86" text-anchor="middle" class="ring-label">合作可用</text>
              </svg>
              <div class="status-list">
                <div v-for="item in supplierStatusRows" :key="item.label" class="status-row">
                  <span class="status-dot" :style="{ background: item.color }"></span>
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </div>
              </div>
            </div>
          </section>
        </aside>

        <section class="center-col">
          <section class="panel flow-panel">
            <div class="panel-hd">
              采购履约态势
              <span class="panel-sub">16:9 COMMAND VIEW</span>
            </div>
            <div class="flow-map">
              <div class="flow-orbit"></div>
              <div v-for="(node, index) in flowNodes" :key="node.label" class="flow-node" :class="`flow-${index}`">
                <div class="flow-value">{{ node.value }}</div>
                <div class="flow-label">{{ node.label }}</div>
              </div>
              <svg viewBox="0 0 720 300" class="flow-lines">
                <path d="M105 150 C210 54 300 54 382 144 C460 230 555 230 626 150" />
                <path d="M105 150 C218 242 320 244 382 144 C442 45 548 45 626 150" />
              </svg>
              <div class="center-core">
                <div class="core-value">{{ fulfillmentRate }}%</div>
                <div class="core-label">订单到货率</div>
                <div class="core-sub">已到货 / 采购数量</div>
              </div>
            </div>
          </section>

          <section class="panel trend-panel">
            <div class="panel-hd">预计到货节奏</div>
            <div class="trend-bars">
              <div v-for="item in arrivalBuckets" :key="item.label" class="trend-item">
                <div class="trend-bar">
                  <div class="trend-fill" :style="{ height: item.pct + '%' }"></div>
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

          <section class="panel">
            <div class="panel-hd">供应商采购额 TOP</div>
            <div class="rank-list">
              <div v-for="(item, index) in topSuppliers" :key="item.name" class="rank-row">
                <span class="rank-no">{{ index + 1 }}</span>
                <span class="rank-name">{{ item.name }}</span>
                <span class="rank-amount">{{ formatMoney(item.amount) }}</span>
              </div>
              <div v-if="topSuppliers.length === 0" class="empty-state">暂无订单</div>
            </div>
          </section>

          <section class="panel activity-panel">
            <div class="panel-hd">到货动态</div>
            <div class="activity-list" :class="{ scrolling: arrivalActivity.length > 5 }">
              <div v-for="item in arrivalActivity" :key="item.id" class="activity-row">
                <span class="activity-date">{{ formatShortDate(item.arrival_date) }}</span>
                <span class="activity-name">{{ item.material_name || item.arrival_no }}</span>
                <span class="activity-qty">{{ numberText(item.arrival_quantity) }}</span>
              </div>
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
import request from '@/utils/request'

const router = useRouter()

const rootRef = ref(null)
const screenRef = ref(null)
const loading = ref(false)
const isFullscreen = ref(false)
const clock = ref('')
const suppliers = ref([])
const demands = ref([])
const orders = ref([])
const arrivals = ref([])

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
  info: 'var(--c-primary)'
}

const numberValue = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const numberText = (value) => {
  const num = numberValue(value)
  if (Math.abs(num) >= 10000) return `${(num / 10000).toFixed(1)}万`
  return Number.isInteger(num) ? String(num) : num.toFixed(2)
}

const formatMoney = (value) => {
  const num = numberValue(value)
  if (Math.abs(num) >= 10000) return `${(num / 10000).toFixed(1)}万`
  return num.toFixed(0)
}

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

const loadData = async () => {
  loading.value = true
  try {
    const [supplierRows, demandRows, orderRows, arrivalRows] = await Promise.all([
      request({
        url: '/purchase_suppliers?select=id,name,supplier_status,status,level,lead_time_days,buyer_name&limit=1000',
        method: 'get',
        headers: { 'Accept-Profile': 'public' }
      }),
      request({
        url: '/purchase_demands?status=neq.deleted&select=id,demand_no,material_name,quantity,required_date,demand_status,status,preferred_supplier&order=required_date.asc&limit=1000',
        method: 'get',
        headers: { 'Accept-Profile': 'public' }
      }),
      request({
        url: '/v_purchase_order_progress?status=neq.deleted&select=id,order_no,supplier_name,material_name,quantity,total_amount,expected_arrival_date,order_status,status,arrived_quantity,pending_quantity,arrival_progress&order=expected_arrival_date.asc&limit=1000',
        method: 'get',
        headers: { 'Accept-Profile': 'public' }
      }),
      request({
        url: '/purchase_arrivals?status=neq.deleted&select=id,arrival_no,order_no,supplier_name,material_name,arrival_quantity,accepted_quantity,arrival_date,iqc_status,arrival_status,inbound_no,status&order=arrival_date.desc&limit=1000',
        method: 'get',
        headers: { 'Accept-Profile': 'public' }
      })
    ])
    suppliers.value = Array.isArray(supplierRows) ? supplierRows : []
    demands.value = Array.isArray(demandRows) ? demandRows : []
    orders.value = Array.isArray(orderRows) ? orderRows : []
    arrivals.value = Array.isArray(arrivalRows) ? arrivalRows : []
  } finally {
    loading.value = false
  }
}

const supplierStatusRows = computed(() => {
  const rows = [
    { label: '合作中', color: statusColors.ok, value: 0 },
    { label: '待评审', color: statusColors.warn, value: 0 },
    { label: '暂停合作', color: statusColors.danger, value: 0 }
  ]
  suppliers.value.forEach((item) => {
    const target = rows.find(row => row.label === item.supplier_status)
    if (target) target.value += 1
  })
  return rows
})

const supplierHealth = computed(() => {
  const total = suppliers.value.length
  if (!total) return 0
  const active = suppliers.value.filter(item => item.supplier_status === '合作中' && item.status === 'active').length
  return Math.round((active / total) * 100)
})

const supplierRingDash = computed(() => {
  const total = 326.73
  const filled = total * supplierHealth.value / 100
  return `${filled} ${total - filled}`
})

const demandStatusRows = computed(() => {
  const rows = [
    { label: '草稿', color: statusColors.info, value: 0 },
    { label: '待采购', color: statusColors.warn, value: 0 },
    { label: '已下单', color: statusColors.ok, value: 0 },
    { label: '已关闭', color: statusColors.danger, value: 0 }
  ]
  demands.value.forEach((item) => {
    const target = rows.find(row => row.label === item.demand_status)
    if (target) target.value += 1
  })
  const max = Math.max(...rows.map(row => row.value), 1)
  return rows.map(row => ({ ...row, pct: Math.round(row.value / max * 100) }))
})

const openOrders = computed(() => orders.value.filter(item => !['已完成', '已取消'].includes(item.order_status)))
const executableOrders = computed(() => orders.value.filter(item => ['已下单', '部分到货'].includes(item.order_status) && item.status === 'active'))

const totalOrderQty = computed(() => orders.value.reduce((sum, item) => sum + numberValue(item.quantity), 0))
const totalArrivedQty = computed(() => orders.value.reduce((sum, item) => sum + numberValue(item.arrived_quantity), 0))
const fulfillmentRate = computed(() => {
  if (totalOrderQty.value <= 0) return 0
  return Math.min(Math.round(totalArrivedQty.value / totalOrderQty.value * 100), 100)
})

const kpiList = computed(() => [
  { label: '合作供应商', value: suppliers.value.filter(item => item.supplier_status === '合作中' && item.status === 'active').length, color: statusColors.ok },
  { label: '待采购需求', value: demands.value.filter(item => item.demand_status === '待采购').length, color: statusColors.warn },
  { label: '执行订单', value: executableOrders.value.length, color: statusColors.info },
  { label: '采购金额', value: formatMoney(orders.value.reduce((sum, item) => sum + numberValue(item.total_amount), 0)), color: 'var(--c-accent)' },
  { label: '待到货量', value: numberText(orders.value.reduce((sum, item) => sum + numberValue(item.pending_quantity), 0)), color: statusColors.warn },
  { label: '异常到货', value: arrivals.value.filter(item => item.arrival_status === '异常' || item.iqc_status === '不合格').length, color: statusColors.danger }
])

const flowNodes = computed(() => [
  { label: '需求池', value: demands.value.filter(item => !['已关闭'].includes(item.demand_status)).length },
  { label: '采购订单', value: openOrders.value.length },
  { label: '到货跟踪', value: arrivals.value.filter(item => item.arrival_status !== '已入库').length },
  { label: '确认入库', value: arrivals.value.filter(item => item.arrival_status === '已入库').length }
])

const arrivalBuckets = computed(() => {
  const base = todayStart()
  const list = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(base)
    date.setDate(base.getDate() + index)
    return {
      label: index === 0 ? '今日' : `${date.getMonth() + 1}/${date.getDate()}`,
      dateKey: date.toISOString().slice(0, 10),
      count: 0,
      pct: 0
    }
  })
  orders.value.forEach((order) => {
    if (!order.expected_arrival_date || ['已完成', '已取消'].includes(order.order_status)) return
    const key = String(order.expected_arrival_date).slice(0, 10)
    const target = list.find(item => item.dateKey === key)
    if (target) target.count += 1
  })
  const max = Math.max(...list.map(item => item.count), 1)
  return list.map(item => ({ ...item, pct: Math.max(6, Math.round(item.count / max * 100)) }))
})

const alertList = computed(() => {
  const today = todayStart()
  const rows = []
  demands.value.forEach((item) => {
    if (!item.required_date || ['已下单', '已关闭'].includes(item.demand_status)) return
    const due = new Date(item.required_date)
    if (due < today) {
      rows.push({ id: `d-${item.id}`, level: 'danger', type: '需求', message: `${item.material_name || item.demand_no} 已逾期` })
    }
  })
  orders.value.forEach((item) => {
    if (!item.expected_arrival_date || ['已完成', '已取消'].includes(item.order_status)) return
    const due = new Date(item.expected_arrival_date)
    if (due < today) {
      rows.push({ id: `o-${item.id}`, level: 'warning', type: '订单', message: `${item.order_no} 预计到货逾期` })
    }
  })
  arrivals.value.forEach((item) => {
    if (item.arrival_status === '异常' || item.iqc_status === '不合格') {
      rows.push({ id: `a-${item.id}`, level: 'danger', type: '到货', message: `${item.arrival_no} IQC异常` })
    }
  })
  suppliers.value.forEach((item) => {
    if (item.supplier_status === '暂停合作') {
      rows.push({ id: `s-${item.id}`, level: 'warning', type: '供应', message: `${item.name} 暂停合作` })
    }
  })
  return rows.slice(0, 8)
})

const topSuppliers = computed(() => {
  const map = new Map()
  orders.value.forEach((item) => {
    const name = item.supplier_name || '未指定'
    const current = map.get(name) || { name, amount: 0 }
    current.amount += numberValue(item.total_amount)
    map.set(name, current)
  })
  return Array.from(map.values()).sort((a, b) => b.amount - a.amount).slice(0, 6)
})

const arrivalActivity = computed(() => arrivals.value.slice(0, 8))

const updateClock = () => {
  clock.value = new Date().toLocaleString('zh-CN', { hour12: false })
}

const updateDashboardScale = () => {
  const root = rootRef.value
  if (!root) return
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
  if (resizeFrame) cancelAnimationFrame(resizeFrame)
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0
    updateDashboardScale()
  })
}

const toggleFullscreen = () => {
  const target = rootRef.value || screenRef.value || document.documentElement
  try {
    if (!document.fullscreenElement) {
      const result = target.requestFullscreen?.()
      if (result?.catch) result.catch(() => {})
    } else {
      const result = document.exitFullscreen?.()
      if (result?.catch) result.catch(() => {})
    }
  } catch (e) {
    // 浏览器或嵌入容器拒绝全屏时保持大屏布局，不打断页面操作。
  } finally {
    isFullscreen.value = Boolean(document.fullscreenElement)
  }
}

const handleFullscreenChange = () => {
  isFullscreen.value = Boolean(document.fullscreenElement)
  scheduleDashboardScale()
}

const goApps = () => {
  router.push('/apps')
}

onMounted(() => {
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  window.addEventListener('resize', scheduleDashboardScale)
  if (window.ResizeObserver && rootRef.value) {
    resizeObserver = new ResizeObserver(scheduleDashboardScale)
    resizeObserver.observe(rootRef.value)
  }
  scheduleDashboardScale()
  loadData()
  refreshTimer = setInterval(loadData, 30000)
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
  if (refreshTimer) clearInterval(refreshTimer)
  if (resizeObserver) resizeObserver.disconnect()
  if (resizeFrame) cancelAnimationFrame(resizeFrame)
  window.removeEventListener('resize', scheduleDashboardScale)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
})
</script>

<style scoped>
.purchase-cockpit {
  --bg: #06111f;
  --panel: rgba(10, 25, 43, 0.78);
  --border: rgba(34, 211, 238, 0.32);
  --glow: rgba(34, 211, 238, 0.12);
  --glow-strong: rgba(34, 211, 238, 0.28);
  --text1: #eff6ff;
  --text2: #a8c7dd;
  --text3: #638398;
  --c-primary: #22d3ee;
  --c-accent: #60a5fa;
  --c-green: #34d399;
  --c-amber: #fbbf24;
  --c-red: #fb7185;
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
  font-family: "DIN Alternate", "Helvetica Neue", "PingFang SC", sans-serif;
}

.purchase-cockpit.fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  width: 100vw;
  height: 100vh;
  min-height: 0;
  padding: 0;
}

.purchase-cockpit:fullscreen {
  width: 100vw;
  height: 100vh;
  min-height: 0;
  padding: 12px;
  background: var(--bg);
}

.cockpit-bg,
.scan-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.cockpit-bg {
  background:
    radial-gradient(circle at 50% 35%, rgba(34, 211, 238, 0.16), transparent 34%),
    linear-gradient(rgba(34, 211, 238, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(34, 211, 238, 0.045) 1px, transparent 1px),
    #06111f;
  background-size: auto, 42px 42px, 42px 42px, auto;
}

.scan-layer {
  background: repeating-linear-gradient(0deg, transparent 0, transparent 5px, rgba(125, 211, 252, 0.035) 6px);
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
  border: 1px solid var(--border);
  background: rgba(2, 6, 23, 0.58);
  box-shadow: 0 0 36px rgba(34, 211, 238, 0.18);
}

.screen-header {
  height: 58px;
  flex-shrink: 0;
  display: grid;
  grid-template-columns: 1fr 1.1fr 1fr;
  align-items: center;
  padding: 0 18px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(90deg, rgba(14, 165, 233, 0.12), rgba(15, 23, 42, 0.66), rgba(14, 165, 233, 0.12));
}

.title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 20px;
  font-weight: 900;
  color: var(--c-primary);
  letter-spacing: 2px;
}

.title-mark {
  width: 10px;
  height: 10px;
  border: 2px solid var(--c-primary);
  transform: rotate(45deg);
  box-shadow: 0 0 12px var(--c-primary);
}

.subtitle {
  margin-top: 2px;
  font-size: 10px;
  letter-spacing: 4px;
  color: var(--text3);
}

.header-center {
  display: flex;
  justify-content: center;
}

.live-badge {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 22px;
  border: 1px solid var(--border);
  background: var(--glow);
  color: var(--c-primary);
  font-size: 13px;
  font-weight: 700;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c-green);
  animation: pulse 1.8s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.65); }
  70% { box-shadow: 0 0 0 8px rgba(52, 211, 153, 0); }
  100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
}

.refresh-text {
  color: var(--text2);
  font-size: 11px;
}

.header-right {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 10px;
}

.clock {
  min-width: 168px;
  font-size: 15px;
  color: var(--c-primary);
  text-align: right;
  font-weight: 800;
}

.hud-btn {
  height: 30px;
  padding: 0 12px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--c-primary);
  cursor: pointer;
}

.hud-btn:hover {
  background: var(--glow);
}

.screen-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 24% 1fr 28%;
  gap: 12px;
  padding: 12px;
}

.side-col,
.center-col {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.panel {
  position: relative;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  background: var(--panel);
  box-shadow: inset 0 0 20px var(--glow);
}

.panel::before,
.panel::after {
  content: "";
  position: absolute;
  width: 16px;
  height: 16px;
  border: 2px solid var(--c-primary);
  opacity: 0.6;
  pointer-events: none;
}

.panel::before {
  left: -1px;
  top: -1px;
  border-right: none;
  border-bottom: none;
}

.panel::after {
  right: -1px;
  bottom: -1px;
  border-left: none;
  border-top: none;
}

.panel-hd {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 32px;
  flex-shrink: 0;
  padding: 0 12px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(90deg, var(--glow), transparent);
  color: var(--c-primary);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 1px;
}

.panel-sub {
  color: var(--text3);
  font-size: 10px;
}

.kpi-panel {
  flex: 1.4;
}

.left-col .panel:nth-child(2),
.left-col .panel:nth-child(3) {
  flex: 1;
}

.kpi-grid {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 10px;
}

.kpi-card {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  border: 1px solid rgba(34, 211, 238, 0.18);
  background: rgba(14, 165, 233, 0.08);
}

.kpi-value {
  font-size: 22px;
  line-height: 1.1;
  font-weight: 900;
}

.kpi-label {
  margin-top: 5px;
  font-size: 11px;
  color: var(--text2);
}

.funnel,
.status-list,
.rank-list,
.alert-list,
.activity-list {
  flex: 1;
  min-height: 0;
  padding: 10px;
  overflow: hidden;
}

.bar-row {
  display: grid;
  grid-template-columns: 48px 1fr 34px;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
  font-size: 12px;
}

.bar-label,
.bar-value {
  color: var(--text2);
}

.bar-value {
  text-align: right;
  font-weight: 800;
}

.bar-track {
  height: 8px;
  overflow: hidden;
  background: rgba(148, 163, 184, 0.16);
}

.bar-fill {
  height: 100%;
  transition: width 0.8s ease;
}

.supplier-ring {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: 44% 1fr;
  align-items: center;
}

.ring-svg {
  width: 100%;
  height: 100%;
  max-height: 150px;
}

.ring-track {
  fill: none;
  stroke: rgba(148, 163, 184, 0.18);
  stroke-width: 12;
}

.ring-fill {
  fill: none;
  stroke: var(--c-green);
  stroke-width: 12;
  stroke-linecap: round;
  transform: rotate(-90deg);
  transform-origin: 70px 70px;
}

.ring-value {
  fill: var(--text1);
  font-size: 24px;
  font-weight: 900;
}

.ring-label {
  fill: var(--text3);
  font-size: 11px;
}

.status-row,
.rank-row,
.activity-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 8px;
  margin-bottom: 6px;
  background: rgba(14, 165, 233, 0.08);
  border: 1px solid rgba(34, 211, 238, 0.12);
  font-size: 12px;
}

.status-row strong,
.rank-amount,
.activity-qty {
  margin-left: auto;
  color: var(--text1);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.flow-panel {
  flex: 1;
}

.trend-panel {
  height: 26%;
  flex-shrink: 0;
}

.flow-map {
  position: relative;
  flex: 1;
  min-height: 0;
}

.flow-orbit {
  position: absolute;
  inset: 14%;
  border: 1px solid rgba(34, 211, 238, 0.2);
  border-radius: 50%;
  box-shadow: inset 0 0 34px rgba(34, 211, 238, 0.08);
}

.flow-lines {
  position: absolute;
  inset: 11% 4%;
  width: 92%;
  height: 78%;
  fill: none;
  stroke: rgba(96, 165, 250, 0.45);
  stroke-width: 2;
  stroke-dasharray: 8 8;
  animation: dash 14s linear infinite;
}

@keyframes dash {
  to { stroke-dashoffset: -120; }
}

.flow-node {
  position: absolute;
  width: 100px;
  height: 72px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  background: rgba(14, 165, 233, 0.12);
  box-shadow: 0 0 18px rgba(34, 211, 238, 0.16);
}

.flow-0 { left: 5%; top: 42%; }
.flow-1 { left: 29%; top: 18%; }
.flow-2 { right: 29%; top: 18%; }
.flow-3 { right: 5%; top: 42%; }

.flow-value {
  color: var(--c-primary);
  font-size: 26px;
  font-weight: 900;
}

.flow-label {
  color: var(--text2);
  font-size: 12px;
}

.center-core {
  position: absolute;
  left: 50%;
  top: 53%;
  width: 190px;
  height: 190px;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  background: radial-gradient(circle, rgba(34, 211, 238, 0.18), rgba(15, 23, 42, 0.86));
  box-shadow: 0 0 44px rgba(34, 211, 238, 0.22);
}

.core-value {
  color: var(--c-green);
  font-size: 44px;
  font-weight: 900;
}

.core-label {
  color: var(--text1);
  font-size: 15px;
  font-weight: 800;
}

.core-sub {
  margin-top: 4px;
  color: var(--text3);
  font-size: 11px;
}

.trend-bars {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 10px;
  padding: 10px 14px;
  align-items: end;
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
  width: 18px;
  min-height: 52px;
  display: flex;
  align-items: end;
  background: rgba(148, 163, 184, 0.15);
}

.trend-fill {
  width: 100%;
  min-height: 4px;
  background: linear-gradient(180deg, var(--c-primary), var(--c-accent));
}

.trend-label,
.trend-value {
  color: var(--text2);
  font-size: 10px;
}

.alert-panel {
  flex: 1.1;
}

.right-col .panel:nth-child(2),
.activity-panel {
  flex: 1;
}

.alert-row {
  display: grid;
  grid-template-columns: 40px 1fr;
  gap: 8px;
  padding: 8px;
  margin-bottom: 6px;
  font-size: 12px;
  border-left: 3px solid var(--c-amber);
  background: rgba(251, 191, 36, 0.08);
}

.alert-danger {
  border-left-color: var(--c-red);
  background: rgba(251, 113, 133, 0.1);
}

.alert-type {
  color: var(--c-primary);
  font-weight: 800;
}

.alert-msg {
  min-width: 0;
  overflow: hidden;
  color: var(--text2);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.rank-no {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(34, 211, 238, 0.16);
  color: var(--c-primary);
  font-weight: 900;
}

.rank-name,
.activity-name {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  color: var(--text2);
}

.activity-date {
  width: 38px;
  color: var(--text3);
}

.empty-state {
  height: 100%;
  min-height: 68px;
  display: flex;
  align-items: center;
  justify-content: center;
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

  .screen-body {
    grid-template-columns: 25% 1fr 30%;
    gap: 8px;
    padding: 8px;
  }

  .flow-node {
    width: 84px;
  }
}
</style>
