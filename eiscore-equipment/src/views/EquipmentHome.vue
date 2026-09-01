<template>
  <div class="equipment-cockpit" :class="{ fullscreen: isFullscreen }">
    <div class="cockpit-bg"></div>
    <main class="screen">
      <header class="screen-header">
        <div class="header-left">
          <div class="title"><span class="title-mark"></span>设备运行大屏</div>
          <div class="subtitle">EQUIPMENT OPERATION COMMAND CENTER</div>
        </div>
        <div class="header-center">
          <div class="live-badge">
            <span class="pulse-dot"></span>
            <span>台账 · 点检 · 异常 · 维保</span>
            <span class="refresh-text">{{ loading ? '同步中' : realtimeStatusText }}</span>
            <span class="sync-text">{{ lastSyncText }}</span>
            <span class="event-count">事件 {{ realtimeEventCount }}</span>
          </div>
        </div>
        <div class="header-right">
          <div class="clock">{{ clock }}</div>
          <button class="hud-btn" type="button" @click="goApps">应用</button>
          <button class="hud-btn" type="button" :disabled="loading" @click="loadData()">
            {{ loading ? '刷新中' : '刷新' }}
          </button>
          <button class="hud-btn primary" type="button" @click="openApp('assets')">设备台账</button>
          <button class="hud-btn" type="button" @click="toggleFullscreen">{{ isFullscreen ? '退出' : '全屏' }}</button>
        </div>
      </header>

      <section class="screen-body">
        <section class="panel kpi-panel">
          <div class="panel-hd">核心指标</div>
          <div class="kpi-grid">
            <button
              v-for="item in kpiList"
              :key="item.label"
              type="button"
              class="kpi-card"
              @click="openApp(item.appKey)"
            >
              <div class="kpi-value" :style="{ color: item.color }">{{ item.value }}</div>
              <div class="kpi-copy">
                <div class="kpi-label">{{ item.label }}</div>
                <div class="kpi-sub">{{ item.sub }}</div>
              </div>
            </button>
          </div>
        </section>

        <section class="panel status-panel">
          <div class="panel-hd">
            设备状态结构
            <span class="panel-sub">{{ assets.length }} 台</span>
          </div>
          <div class="status-layout">
            <div class="status-ring" :style="statusPieStyle">
              <div class="ring-hole">
                <strong>{{ avgHealthScore }}</strong>
                <span>健康评分</span>
              </div>
            </div>
            <div class="legend-list">
              <button
                v-for="item in statusRows"
                :key="item.label"
                type="button"
                class="legend-row"
                @click="openApp('assets')"
              >
                <span class="legend-dot" :style="{ background: item.color }"></span>
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
              </button>
            </div>
          </div>
          <div class="mini-section">
            <div class="mini-title">设备类型分布</div>
            <div class="bar-list">
              <button
                v-for="item in assetTypeRows.slice(0, 4)"
                :key="item.label"
                type="button"
                class="bar-row"
                @click="openApp('assets')"
              >
                <span class="bar-label">{{ item.label }}</span>
                <div class="bar-track">
                  <div class="bar-fill" :style="{ width: item.pct + '%', background: item.color }"></div>
                </div>
                <span class="bar-value">{{ item.value }}</span>
              </button>
            </div>
          </div>
          <div class="mini-section risk-section">
            <div class="mini-title">低健康设备</div>
            <div class="compact-list">
              <button
                v-for="(row, index) in healthRiskRows.slice(0, 4)"
                :key="row.id || row.asset_no"
                type="button"
                class="rank-row"
                @click="openRecord(row, 'assets')"
              >
                <span class="rank-no">{{ index + 1 }}</span>
                <span class="rank-name">{{ row.asset_name || row.asset_no }}</span>
                <div class="rank-track">
                  <i :style="{ width: Math.max(numberValue(row.health_score), 6) + '%' }"></i>
                </div>
                <strong>{{ numberText(row.health_score) }}</strong>
              </button>
              <div v-if="healthRiskRows.length === 0" class="compact-empty">暂无低健康设备</div>
            </div>
          </div>
        </section>

        <section class="panel command-panel">
          <div class="panel-hd">
            设备态势主屏
            <span class="panel-sub">LIVE</span>
          </div>
          <div class="command-main">
            <div class="health-score">
              <span>综合设备健康</span>
              <strong>{{ avgHealthScore }}</strong>
              <em>{{ runningCount }} 台运行 / {{ downCount }} 台停机</em>
            </div>
            <div class="score-side">
              <button type="button" @click="openApp('issues')">
                <span>未关闭异常</span>
                <strong>{{ openIssueCount }}</strong>
              </button>
              <button type="button" @click="openApp('work_orders')">
                <span>处理中工单</span>
                <strong>{{ activeWorkOrderCount }}</strong>
              </button>
              <button type="button" @click="openApp('work_orders')">
                <span>停机小时</span>
                <strong>{{ numberText(totalDowntimeHours) }}</strong>
              </button>
              <button type="button" @click="openApp('plans')">
                <span>计划完成率</span>
                <strong>{{ avgPlanCompletion }}%</strong>
              </button>
            </div>
          </div>
          <div class="process-map">
            <svg viewBox="0 0 760 260" class="process-lines" aria-hidden="true">
              <path d="M80 132 C196 42 292 42 380 132 C468 222 566 222 680 132" />
              <path d="M80 132 C198 224 290 224 380 132 C470 40 568 40 680 132" />
            </svg>
            <button
              v-for="(node, index) in flowNodes"
              :key="node.label"
              type="button"
              class="flow-node"
              :class="`node-${index}`"
              @click="openApp(node.appKey)"
            >
              <strong>{{ node.value }}</strong>
              <span>{{ node.label }}</span>
            </button>
            <div class="center-core">
              <strong>{{ riskIndex }}</strong>
              <span>风险指数</span>
            </div>
          </div>
          <div class="command-detail-grid">
            <div class="mini-block">
              <div class="mini-title">计划达成</div>
              <button
                v-for="item in planProgressRows.slice(0, 2)"
                :key="item.id || item.plan_no"
                type="button"
                class="plan-row"
                @click="openRecord(item, 'plans')"
              >
                <span class="plan-name">{{ item.plan_name || item.plan_no }}</span>
                <div class="plan-track">
                  <i :style="{ width: item.progress + '%' }"></i>
                </div>
                <strong>{{ item.progress }}%</strong>
              </button>
              <div v-if="planProgressRows.length === 0" class="compact-empty">暂无计划</div>
            </div>
            <div class="mini-block">
              <div class="mini-title">标准覆盖</div>
              <button
                v-for="item in standardCoverageRows.slice(0, 2)"
                :key="item.label"
                type="button"
                class="standard-row"
                @click="openApp('standards')"
              >
                <span class="standard-name">{{ item.label }}</span>
                <div class="standard-track">
                  <i :style="{ width: item.pct + '%' }"></i>
                </div>
                <strong>{{ item.effective }}/{{ item.total }}</strong>
              </button>
              <div v-if="standardCoverageRows.length === 0" class="compact-empty">暂无标准</div>
            </div>
          </div>
        </section>

        <section class="panel trend-panel">
          <div class="panel-hd">
            近 7 天点检节奏
            <span class="panel-sub">{{ checks.length }} 单</span>
          </div>
          <div class="trend-bars">
            <button
              v-for="item in checkBuckets"
              :key="item.label"
              type="button"
              class="trend-item"
              @click="openApp('checks')"
            >
              <div class="trend-bar">
                <div class="trend-fill" :class="{ danger: item.abnormal > 0 }" :style="{ height: item.pct + '%' }"></div>
              </div>
              <div class="trend-label">{{ item.label }}</div>
              <div class="trend-value">{{ item.count }}</div>
            </button>
          </div>
        </section>

        <section class="panel alert-panel">
          <div class="panel-hd">
            风险预警
            <span class="panel-sub">{{ alertList.length }} 项</span>
          </div>
          <div class="risk-split">
            <button
              v-for="item in issueLevelRows"
              :key="item.label"
              type="button"
              class="risk-cell"
              :class="`risk-${item.level}`"
              @click="openApp('issues')"
            >
              <strong>{{ item.value }}</strong>
              <span>{{ item.label }}</span>
            </button>
          </div>
          <div class="scroll-container alert-list">
            <div
              v-if="alertList.length > 0"
              class="scroll-content"
              :class="{ scrolling: alertList.length > 3 }"
              :style="{ animationDuration: scrollDuration(alertList.length, 3, 12) }"
            >
              <div class="scroll-track">
                <button
                  v-for="alert in alertList"
                  :key="'alert-a-' + alert.id"
                  type="button"
                  class="alert-row"
                  :class="`alert-${alert.level}`"
                  @click="openApp(alert.appKey)"
                >
                  <span class="alert-type">{{ alert.type }}</span>
                  <span class="alert-msg">{{ alert.message }}</span>
                </button>
              </div>
              <div v-if="alertList.length > 3" class="scroll-track">
                <button
                  v-for="alert in alertList"
                  :key="'alert-b-' + alert.id"
                  type="button"
                  class="alert-row"
                  :class="`alert-${alert.level}`"
                  @click="openApp(alert.appKey)"
                >
                  <span class="alert-type">{{ alert.type }}</span>
                  <span class="alert-msg">{{ alert.message }}</span>
                </button>
              </div>
            </div>
            <div v-if="alertList.length === 0" class="empty-state">暂无风险</div>
          </div>
        </section>

        <section class="panel stream-panel">
          <div class="panel-hd">
            最新点检流
            <span class="panel-sub">{{ recentChecks.length }} 条</span>
          </div>
          <div class="scroll-container stream-list">
            <div
              v-if="recentChecks.length > 0"
              class="scroll-content"
              :class="{ scrolling: recentChecks.length > 3 }"
              :style="{ animationDuration: scrollDuration(recentChecks.length, 3, 12) }"
            >
              <div class="scroll-track">
                <button
                  v-for="row in recentChecks"
                  :key="'stream-a-' + (row.id || row.check_no)"
                  type="button"
                  class="stream-row"
                  @click="openRecord(row, 'checks')"
                >
                  <span class="stream-date">{{ formatShortDate(row.check_date) }}</span>
                  <span class="stream-main">
                    <strong>{{ row.asset_name || row.check_no }}</strong>
                    <span>{{ row.check_no }} · {{ row.asset_no || '--' }}</span>
                  </span>
                  <span class="stream-rate" :class="{ danger: numberValue(row.abnormal_count) > 0 }">
                    {{ numberText(row.abnormal_count) }}/{{ numberText(row.check_item_count) }}
                  </span>
                  <span class="mini-tag" :class="statusTone(row.check_result)">{{ row.check_result }}</span>
                </button>
              </div>
              <div v-if="recentChecks.length > 3" class="scroll-track">
                <button
                  v-for="row in recentChecks"
                  :key="'stream-b-' + (row.id || row.check_no)"
                  type="button"
                  class="stream-row"
                  @click="openRecord(row, 'checks')"
                >
                  <span class="stream-date">{{ formatShortDate(row.check_date) }}</span>
                  <span class="stream-main">
                    <strong>{{ row.asset_name || row.check_no }}</strong>
                    <span>{{ row.check_no }} · {{ row.asset_no || '--' }}</span>
                  </span>
                  <span class="stream-rate" :class="{ danger: numberValue(row.abnormal_count) > 0 }">
                    {{ numberText(row.abnormal_count) }}/{{ numberText(row.check_item_count) }}
                  </span>
                  <span class="mini-tag" :class="statusTone(row.check_result)">{{ row.check_result }}</span>
                </button>
              </div>
            </div>
            <div v-if="recentChecks.length === 0" class="empty-state">暂无点检记录</div>
          </div>
        </section>

        <section class="panel work-panel">
          <div class="panel-hd">
            维保闭环
            <span class="panel-sub">工单 {{ workOrders.length }} / 计划 {{ plans.length }}</span>
          </div>
          <div class="work-summary">
            <button
              v-for="item in workSummaryRows"
              :key="item.label"
              type="button"
              class="work-cell"
              @click="openApp(item.appKey)"
            >
              <strong>{{ item.value }}</strong>
              <span>{{ item.label }}</span>
            </button>
          </div>
          <div class="scroll-container work-list">
            <div
              v-if="visibleWorkOrders.length > 0"
              class="scroll-content"
              :class="{ scrolling: visibleWorkOrders.length > 3 }"
              :style="{ animationDuration: scrollDuration(visibleWorkOrders.length, 3, 12) }"
            >
              <div class="scroll-track">
                <button
                  v-for="item in visibleWorkOrders"
                  :key="'work-a-' + (item.id || item.work_order_no)"
                  type="button"
                  class="work-row"
                  @click="openRecord(item, 'work_orders')"
                >
                  <span class="work-main">
                    <strong>{{ item.work_order_no }}</strong>
                    <span>{{ item.task_desc }}</span>
                  </span>
                  <span class="work-meta">{{ formatShortDate(item.plan_date) }}</span>
                  <span class="mini-tag" :class="statusTone(item.work_status)">{{ item.work_status }}</span>
                </button>
              </div>
              <div v-if="visibleWorkOrders.length > 3" class="scroll-track">
                <button
                  v-for="item in visibleWorkOrders"
                  :key="'work-b-' + (item.id || item.work_order_no)"
                  type="button"
                  class="work-row"
                  @click="openRecord(item, 'work_orders')"
                >
                  <span class="work-main">
                    <strong>{{ item.work_order_no }}</strong>
                    <span>{{ item.task_desc }}</span>
                  </span>
                  <span class="work-meta">{{ formatShortDate(item.plan_date) }}</span>
                  <span class="mini-tag" :class="statusTone(item.work_status)">{{ item.work_status }}</span>
                </button>
              </div>
            </div>
            <div v-if="visibleWorkOrders.length === 0" class="empty-state">暂无维保工单</div>
          </div>
        </section>
      </section>
    </main>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import request from '@/utils/request'
import { getRealtimeClient } from '@/utils/realtime'
import {
  isEquipmentRealtimePayloadRelevant,
  normalizeEquipmentRows,
  parseEquipmentRealtimePayload,
  shouldReplaceEquipmentRows
} from '@/domain/equipment-home-data-policy.js'
import {
  EQUIPMENT_HOME_FALLBACK_SNAPSHOT,
  buildEquipmentHomeQueryRequests,
  shouldApplyEquipmentHomeFallback
} from '@/domain/equipment-home-load-policy.js'
import {
  buildEquipmentAssetTypeRows,
  buildEquipmentHealthRiskRows,
  buildEquipmentIssueLevelRows,
  buildEquipmentPlanProgressRows,
  buildEquipmentStandardCoverageRows,
  buildEquipmentStatusRows,
  buildEquipmentVisibleWorkOrders,
  formatEquipmentNumber as numberText,
  resolveEquipmentStatusTone as statusTone,
  toEquipmentNumber as numberValue
} from '@/domain/equipment-home-presentation-policy.js'
import {
  buildEquipmentCockpitSummary,
  buildEquipmentFlowNodes,
  buildEquipmentKpiRows,
  buildEquipmentWorkSummaryRows,
  calculateEquipmentRiskIndex
} from '@/domain/equipment-home-summary-policy.js'
import {
  buildEquipmentAlertRows,
  buildEquipmentCheckBuckets,
  calculateEquipmentDaysBetween,
  formatEquipmentClockTime as formatClockTime,
  formatEquipmentShortDate as formatShortDate
} from '@/domain/equipment-home-timeline-policy.js'

const router = useRouter()

const loading = ref(false)
const isFullscreen = ref(false)
const clock = ref('')
const assets = ref([])
const checks = ref([])
const issues = ref([])
const workOrders = ref([])
const plans = ref([])
const standards = ref([])
const lastSyncAt = ref(null)
const realtimeReady = ref(false)
const realtimeEventCount = ref(0)

let clockTimer = null
let refreshTimer = null
let realtimeUnsub = null
let realtimeTimer = null

const colors = {
  primary: 'var(--c-primary)',
  green: 'var(--c-green)',
  amber: 'var(--c-amber)',
  red: 'var(--c-red)',
  cyan: 'var(--c-cyan)',
  violet: 'var(--c-violet)'
}

const daysBetween = (value) => calculateEquipmentDaysBetween(value, new Date())

const scrollDuration = (count, factor = 3, min = 12) => `${Math.max(numberValue(count) * factor, min)}s`

const updateClock = () => {
  const now = new Date()
  clock.value = now.toLocaleString('zh-CN', {
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const realtimeStatusText = computed(() => realtimeReady.value ? '实时传输' : '轮询传输')
const lastSyncText = computed(() => lastSyncAt.value ? `同步 ${formatClockTime(lastSyncAt.value)}` : '等待同步')

const assignRowsIfChanged = (target, rows) => {
  const nextRows = normalizeEquipmentRows(rows)
  if (shouldReplaceEquipmentRows(target.value, nextRows)) {
    target.value = nextRows
  }
}

const applyFallbackData = () => {
  assignRowsIfChanged(assets, EQUIPMENT_HOME_FALLBACK_SNAPSHOT.assets)
  assignRowsIfChanged(checks, EQUIPMENT_HOME_FALLBACK_SNAPSHOT.checks)
  assignRowsIfChanged(issues, EQUIPMENT_HOME_FALLBACK_SNAPSHOT.issues)
  assignRowsIfChanged(workOrders, EQUIPMENT_HOME_FALLBACK_SNAPSHOT.workOrders)
  assignRowsIfChanged(plans, EQUIPMENT_HOME_FALLBACK_SNAPSHOT.plans)
  assignRowsIfChanged(standards, EQUIPMENT_HOME_FALLBACK_SNAPSHOT.standards)
}

const loadData = async (options = {}) => {
  const silent = options?.silent === true
  if (silent && loading.value) return
  if (!silent) loading.value = true
  try {
    const [assetRows, checkRows, issueRows, workRows, planRows, standardRows] = await Promise.all(
      buildEquipmentHomeQueryRequests().map((config) => request(config))
    )
    assignRowsIfChanged(assets, assetRows)
    assignRowsIfChanged(checks, checkRows)
    assignRowsIfChanged(issues, issueRows)
    assignRowsIfChanged(workOrders, workRows)
    assignRowsIfChanged(plans, planRows)
    assignRowsIfChanged(standards, standardRows)
    lastSyncAt.value = new Date()
  } catch (error) {
    if (shouldApplyEquipmentHomeFallback({
      assets: assets.value,
      checks: checks.value,
      issues: issues.value,
      workOrders: workOrders.value,
      plans: plans.value,
      standards: standards.value
    })) {
      applyFallbackData()
      lastSyncAt.value = new Date()
    }
  } finally {
    if (!silent) loading.value = false
  }
}

const scheduleRealtimeReload = () => {
  if (realtimeTimer) return
  realtimeTimer = window.setTimeout(() => {
    realtimeTimer = null
    loadData({ silent: true })
  }, 600)
}

const handleRealtimeEvent = (event) => {
  const payload = parseEquipmentRealtimePayload(event)
  if (isEquipmentRealtimePayloadRelevant(payload)) {
    realtimeEventCount.value += 1
    scheduleRealtimeReload()
  }
}

const cockpitSummary = computed(() => buildEquipmentCockpitSummary({
  assets: assets.value,
  checks: checks.value,
  issues: issues.value,
  workOrders: workOrders.value,
  plans: plans.value,
  standards: standards.value,
  daysUntil: daysBetween
}))
const summaryMetric = (key) => computed(() => cockpitSummary.value[key])
const runningCount = summaryMetric('runningCount')
const downCount = summaryMetric('downCount')
const avgHealthScore = summaryMetric('avgHealthScore')
const abnormalCheckCount = summaryMetric('abnormalCheckCount')
const openIssueCount = summaryMetric('openIssueCount')
const activeWorkOrderCount = summaryMetric('activeWorkOrderCount')
const totalDowntimeHours = summaryMetric('totalDowntimeHours')
const avgPlanCompletion = summaryMetric('avgPlanCompletion')

const riskIndex = computed(() => calculateEquipmentRiskIndex(cockpitSummary.value))

const kpiList = computed(() => buildEquipmentKpiRows({ summary: cockpitSummary.value, colors }))

const statusRows = computed(() => buildEquipmentStatusRows({ assets: assets.value, colors }))

const statusPieStyle = computed(() => {
  const total = statusRows.value.reduce((sum, item) => sum + item.value, 0)
  if (total <= 0) return { background: 'conic-gradient(rgba(255,255,255,0.16) 0deg 360deg)' }
  let cursor = 0
  const stops = statusRows.value.map((item) => {
    const start = cursor
    const size = (item.value / total) * 360
    cursor += size
    return `${item.color} ${start}deg ${cursor}deg`
  })
  return { background: `conic-gradient(${stops.join(', ')})` }
})

const assetTypeRows = computed(() => buildEquipmentAssetTypeRows({ assets: assets.value, colors }))

const healthRiskRows = computed(() => buildEquipmentHealthRiskRows(assets.value))

const flowNodes = computed(() => buildEquipmentFlowNodes(cockpitSummary.value))

const checkBuckets = computed(() => buildEquipmentCheckBuckets({
  checks: checks.value,
  referenceDate: new Date()
}))

const recentChecks = computed(() => checks.value.slice(0, 6))

const planProgressRows = computed(() => buildEquipmentPlanProgressRows(plans.value))

const standardCoverageRows = computed(() => buildEquipmentStandardCoverageRows({
  assets: assets.value,
  standards: standards.value
}))

const visibleWorkOrders = computed(() => buildEquipmentVisibleWorkOrders(workOrders.value))

const issueLevelRows = computed(() => buildEquipmentIssueLevelRows(issues.value))

const workSummaryRows = computed(() => buildEquipmentWorkSummaryRows(cockpitSummary.value))

const alertList = computed(() => buildEquipmentAlertRows({
  assets: assets.value,
  issues: issues.value,
  plans: plans.value,
  referenceDate: new Date()
}))

const appRoutes = {
  assets: '/app/assets',
  checks: '/app/checks',
  issues: '/app/issues',
  work_orders: '/app/work_orders',
  plans: '/app/plans',
  standards: '/app/standards'
}

const openApp = (key) => {
  const path = appRoutes[key]
  if (path) router.push(path)
}

const openRecord = (row, appKey) => {
  if (!row?.id) return
  router.push({
    name: 'EquipmentDocumentDetail',
    params: { id: row.id },
    query: { appKey, demo: String(row.id).startsWith('demo-') ? '1' : undefined }
  })
}

const goApps = () => router.push('/')

const toggleFullscreen = async () => {
  isFullscreen.value = !isFullscreen.value
  if (!document.fullscreenEnabled) return
  try {
    if (isFullscreen.value && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen()
    } else if (!isFullscreen.value && document.fullscreenElement) {
      await document.exitFullscreen()
    }
  } catch (e) {
    // Embedded hosts can reject fullscreen; keep the cockpit layout state.
  }
}

onMounted(() => {
  updateClock()
  loadData()
  clockTimer = window.setInterval(updateClock, 1000)
  refreshTimer = window.setInterval(() => {
    if (!document.hidden) loadData({ silent: true })
  }, 30000)
  try {
    realtimeUnsub = getRealtimeClient().subscribe(handleRealtimeEvent)
    realtimeReady.value = true
  } catch (e) {
    realtimeReady.value = false
  }
})

onBeforeUnmount(() => {
  if (clockTimer) window.clearInterval(clockTimer)
  if (refreshTimer) window.clearInterval(refreshTimer)
  if (realtimeUnsub) realtimeUnsub()
  realtimeUnsub = null
  if (realtimeTimer) {
    window.clearTimeout(realtimeTimer)
    realtimeTimer = null
  }
})
</script>

<style scoped>
.equipment-cockpit {
  --bg: #10140f;
  --panel: rgba(18, 28, 23, 0.82);
  --panel-soft: rgba(32, 43, 35, 0.72);
  --border: rgba(94, 234, 212, 0.28);
  --line: rgba(255, 255, 255, 0.08);
  --text1: #f3fff8;
  --text2: #b7d3c5;
  --text3: #759383;
  --c-primary: #5eead4;
  --c-cyan: #38bdf8;
  --c-green: #4ade80;
  --c-amber: #facc15;
  --c-red: #fb7185;
  --c-violet: #a78bfa;
  position: relative;
  width: 100%;
  min-width: 0;
  height: 100vh;
  min-height: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  box-sizing: border-box;
  background: var(--bg);
  color: var(--text1);
}

.cockpit-bg {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(rgba(94, 234, 212, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(94, 234, 212, 0.06) 1px, transparent 1px),
    radial-gradient(circle at 18% 18%, rgba(94, 234, 212, 0.18), transparent 28%),
    radial-gradient(circle at 82% 24%, rgba(56, 189, 248, 0.14), transparent 30%),
    linear-gradient(135deg, #0b110d 0%, #10190f 52%, #071311 100%);
  background-size: 44px 44px, 44px 44px, auto, auto, auto;
}

.screen {
  position: relative;
  z-index: 1;
  width: min(100%, calc((100vh - 36px) * 16 / 9));
  aspect-ratio: 16 / 9;
  height: auto;
  max-height: calc(100vh - 36px);
  min-width: 0;
  display: grid;
  grid-template-rows: 60px minmax(0, 1fr);
  gap: 10px;
}

.equipment-cockpit.fullscreen {
  padding: 0;
}

.equipment-cockpit.fullscreen .screen {
  width: min(100vw, 177.7777778vh);
  max-height: 100vh;
}

.screen-header,
.panel {
  border: 1px solid var(--border);
  background: var(--panel);
  box-shadow: inset 0 0 18px rgba(94, 234, 212, 0.06);
  backdrop-filter: blur(8px);
}

.screen-header {
  display: grid;
  grid-template-columns: minmax(230px, 0.92fr) minmax(320px, 1.08fr) minmax(360px, 1fr);
  align-items: center;
  gap: 10px;
  padding: 0 14px;
  min-width: 0;
}

.title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0;
}

.title-mark {
  width: 4px;
  height: 22px;
  background: var(--c-primary);
  box-shadow: 0 0 14px rgba(94, 234, 212, 0.8);
}

.subtitle {
  margin-top: 3px;
  color: var(--text3);
  font-size: 10px;
}

.header-center {
  min-width: 0;
  display: flex;
  justify-content: center;
}

.live-badge {
  max-width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 7px 10px;
  border: 1px solid rgba(94, 234, 212, 0.22);
  background: rgba(10, 20, 18, 0.55);
  color: var(--text2);
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--c-green);
  box-shadow: 0 0 10px rgba(74, 222, 128, 0.9);
  flex: 0 0 auto;
}

.refresh-text,
.sync-text,
.event-count {
  color: var(--c-primary);
}

.header-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 7px;
  min-width: 0;
}

.clock {
  color: var(--text2);
  font-size: 11px;
  white-space: nowrap;
}

.hud-btn {
  height: 28px;
  border: 1px solid rgba(94, 234, 212, 0.28);
  background: rgba(94, 234, 212, 0.08);
  color: var(--text2);
  padding: 0 9px;
  cursor: pointer;
  white-space: nowrap;
  font-size: 12px;
}

.hud-btn.primary {
  background: rgba(94, 234, 212, 0.18);
  color: var(--c-primary);
}

.screen-body {
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-template-rows: 86px minmax(0, 1.44fr) minmax(0, 1fr);
  gap: 10px;
}

.panel {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.panel-hd {
  height: 28px;
  flex: 0 0 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  border-bottom: 1px solid var(--line);
  color: var(--text1);
  font-size: 12px;
  font-weight: 800;
}

.panel-sub {
  color: var(--text3);
  font-size: 10px;
  font-weight: 600;
}

.kpi-panel {
  grid-column: 1 / 13;
  grid-row: 1;
}

.status-panel {
  grid-column: 1 / 4;
  grid-row: 2 / 4;
}

.command-panel {
  grid-column: 4 / 10;
  grid-row: 2;
}

.trend-panel {
  grid-column: 4 / 7;
  grid-row: 3;
}

.alert-panel {
  grid-column: 10 / 13;
  grid-row: 2;
}

.stream-panel {
  grid-column: 7 / 10;
  grid-row: 3;
}

.work-panel {
  grid-column: 10 / 13;
  grid-row: 3;
}

.kpi-grid {
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding: 8px 10px;
}

.kpi-card {
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: var(--panel-soft);
  color: inherit;
  display: grid;
  grid-template-columns: 74px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
}

.kpi-value {
  font-size: 27px;
  line-height: 1;
  font-weight: 900;
  text-align: center;
}

.kpi-copy {
  min-width: 0;
}

.kpi-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 800;
}

.kpi-sub {
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text3);
  font-size: 10px;
}

.status-layout {
  flex: 0 0 132px;
  display: grid;
  grid-template-columns: 118px minmax(0, 1fr);
  gap: 9px;
  align-items: center;
  padding: 9px 10px 6px;
}

.status-ring {
  width: 112px;
  aspect-ratio: 1;
  border-radius: 50%;
  display: grid;
  place-items: center;
}

.ring-hole {
  width: 72px;
  aspect-ratio: 1;
  border-radius: 50%;
  background: rgba(11, 17, 13, 0.95);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.ring-hole strong {
  font-size: 23px;
  line-height: 1;
  color: var(--c-primary);
}

.ring-hole span {
  margin-top: 5px;
  color: var(--text3);
  font-size: 10px;
}

.legend-list,
.bar-list,
.scroll-track,
.compact-list {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.legend-row,
.bar-row,
.alert-row,
.stream-row,
.work-row,
.flow-node,
.score-side button,
.trend-item,
.rank-row,
.plan-row,
.standard-row,
.risk-cell,
.work-cell {
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}

.legend-row {
  display: grid;
  grid-template-columns: 10px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 7px;
  color: var(--text2);
  font-size: 11px;
  text-align: left;
}

.legend-row span:nth-child(2),
.bar-label,
.rank-name,
.plan-name,
.standard-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.mini-section {
  min-height: 0;
  padding: 0 10px 8px;
}

.risk-section {
  flex: 1;
}

.mini-title {
  margin-bottom: 7px;
  color: var(--text2);
  font-size: 11px;
  font-weight: 800;
}

.bar-row {
  display: grid;
  grid-template-columns: 66px minmax(0, 1fr) 24px;
  gap: 7px;
  align-items: center;
  min-height: 19px;
  color: var(--text2);
  font-size: 11px;
  text-align: left;
}

.bar-track,
.rank-track,
.plan-track,
.standard-track {
  height: 7px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

.bar-fill,
.rank-track i,
.plan-track i,
.standard-track i {
  display: block;
  height: 100%;
}

.rank-row {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr) 48px 28px;
  align-items: center;
  gap: 7px;
  min-height: 21px;
  color: var(--text2);
  font-size: 11px;
  text-align: left;
}

.rank-no {
  color: var(--c-primary);
  font-weight: 900;
}

.rank-track i {
  background: linear-gradient(90deg, var(--c-red), var(--c-amber), var(--c-green));
}

.rank-row strong {
  color: var(--text1);
  font-size: 11px;
  text-align: right;
}

.command-panel {
  display: grid;
  grid-template-rows: 28px 86px minmax(90px, 1fr) 66px;
}

.command-main {
  min-height: 0;
  display: grid;
  grid-template-columns: 1.08fr 1.28fr;
  gap: 9px;
  padding: 8px 10px 7px;
}

.health-score {
  min-width: 0;
  border: 1px solid rgba(94, 234, 212, 0.18);
  background: rgba(94, 234, 212, 0.07);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.health-score span,
.health-score em {
  color: var(--text3);
  font-style: normal;
  font-size: 11px;
}

.health-score strong {
  color: var(--c-primary);
  font-size: 42px;
  line-height: 0.95;
  margin: 4px 0;
}

.score-side {
  min-width: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.score-side button {
  min-width: 0;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: var(--panel-soft);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
}

.score-side span {
  color: var(--text3);
  font-size: 10px;
}

.score-side strong {
  color: var(--text1);
  font-size: 22px;
  line-height: 1;
}

.process-map {
  position: relative;
  min-height: 0;
  margin: 0 10px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(90deg, transparent 0 31%, rgba(94, 234, 212, 0.06) 31% 31.4%, transparent 31.4% 68%, rgba(250, 204, 21, 0.06) 68% 68.4%, transparent 68.4%),
    rgba(5, 12, 10, 0.32);
  overflow: hidden;
}

.process-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.process-lines path {
  fill: none;
  stroke: rgba(94, 234, 212, 0.30);
  stroke-width: 2;
}

.flow-node {
  position: absolute;
  width: 76px;
  height: 52px;
  border: 1px solid rgba(94, 234, 212, 0.3);
  background: rgba(14, 26, 22, 0.88);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.flow-node strong {
  color: var(--c-primary);
  font-size: 20px;
  line-height: 1;
}

.flow-node span {
  color: var(--text2);
  font-size: 10px;
}

.node-0 { left: 5%; top: 42%; }
.node-1 { left: 23%; top: 14%; }
.node-2 { left: 44%; top: 42%; }
.node-3 { right: 23%; top: 14%; }
.node-4 { right: 5%; top: 42%; }

.center-core {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 88px;
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border-radius: 50%;
  border: 1px solid rgba(94, 234, 212, 0.42);
  background: rgba(8, 18, 15, 0.94);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 22px rgba(94, 234, 212, 0.18);
}

.center-core strong {
  color: var(--c-amber);
  font-size: 30px;
  line-height: 1;
}

.center-core span {
  margin-top: 5px;
  color: var(--text3);
  font-size: 11px;
}

.command-detail-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 8px 10px 9px;
}

.mini-block {
  min-width: 0;
  min-height: 0;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.035);
  padding: 7px;
  box-sizing: border-box;
}

.plan-row,
.standard-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 56px 38px;
  align-items: center;
  gap: 7px;
  min-height: 18px;
  color: var(--text2);
  font-size: 10px;
  text-align: left;
}

.plan-track i,
.standard-track i {
  background: linear-gradient(90deg, var(--c-primary), var(--c-green));
}

.plan-row strong,
.standard-row strong {
  color: var(--text1);
  font-size: 10px;
  text-align: right;
}

.trend-bars {
  min-height: 0;
  flex: 1;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
  align-items: end;
  padding: 8px 10px;
}

.trend-item {
  min-width: 0;
  height: 100%;
  display: grid;
  grid-template-rows: minmax(0, 1fr) 16px 15px;
  gap: 3px;
  color: var(--text2);
}

.trend-bar {
  height: 100%;
  min-height: 0;
  display: flex;
  align-items: flex-end;
  background: rgba(255, 255, 255, 0.06);
}

.trend-fill {
  width: 100%;
  min-height: 5%;
  background: linear-gradient(180deg, var(--c-primary), rgba(94, 234, 212, 0.28));
}

.trend-fill.danger {
  background: linear-gradient(180deg, var(--c-red), rgba(251, 113, 133, 0.28));
}

.trend-label,
.trend-value {
  font-size: 10px;
  text-align: center;
}

.scroll-container {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 8px 9px;
}

.alert-panel .scroll-container,
.work-panel .scroll-container {
  padding-top: 2px;
}

.scroll-content {
  min-height: 100%;
}

.scroll-content.scrolling {
  animation: scrollY linear infinite;
  backface-visibility: hidden;
  transform: translate3d(0, 0, 0);
  will-change: transform;
}

.scroll-content.scrolling:hover {
  animation-play-state: paused;
}

@keyframes scrollY {
  from { transform: translate3d(0, 0, 0); }
  to { transform: translate3d(0, -50%, 0); }
}

.scroll-track {
  padding-bottom: 7px;
}

.risk-split,
.work-summary {
  flex: 0 0 46px;
  display: grid;
  gap: 6px;
  padding: 8px 9px 6px;
}

.risk-split {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.work-summary {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.risk-cell,
.work-cell {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.risk-cell strong,
.work-cell strong {
  color: var(--text1);
  font-size: 18px;
  line-height: 1;
}

.risk-cell span,
.work-cell span {
  color: var(--text3);
  font-size: 10px;
}

.risk-danger strong { color: var(--c-red); }
.risk-warn strong { color: var(--c-amber); }
.risk-info strong { color: var(--c-cyan); }

.alert-row {
  min-height: 38px;
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  padding: 6px 7px;
  text-align: left;
  background: rgba(255, 255, 255, 0.05);
  border-left: 3px solid var(--c-amber);
}

.alert-row.alert-danger {
  border-left-color: var(--c-red);
}

.alert-type {
  color: var(--c-amber);
  font-size: 11px;
  font-weight: 800;
}

.alert-danger .alert-type {
  color: var(--c-red);
}

.alert-msg {
  min-width: 0;
  overflow: hidden;
  display: -webkit-box;
  color: var(--text2);
  font-size: 11px;
  line-height: 1.35;
  white-space: normal;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.stream-row,
.work-row {
  min-height: 40px;
  display: grid;
  align-items: center;
  gap: 7px;
  padding: 6px 7px;
  text-align: left;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.stream-row {
  grid-template-columns: 38px minmax(0, 1fr) 44px 52px;
}

.work-row {
  grid-template-columns: minmax(0, 1fr) 38px 56px;
}

.stream-date,
.work-meta {
  color: var(--text3);
  font-size: 10px;
}

.stream-main,
.work-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.stream-main strong,
.work-main strong {
  color: var(--text1);
  font-size: 11px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stream-main span,
.work-main span {
  color: var(--text3);
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stream-rate {
  color: var(--c-green);
  font-size: 10px;
  text-align: right;
}

.stream-rate.danger {
  color: var(--c-red);
}

.mini-tag {
  justify-self: end;
  min-width: 0;
  max-width: 56px;
  padding: 2px 5px;
  text-align: center;
  font-size: 10px;
  line-height: 1.2;
  color: var(--text2);
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mini-tag.ok { color: var(--c-green); }
.mini-tag.warn { color: var(--c-amber); }
.mini-tag.danger { color: var(--c-red); }
.mini-tag.info { color: var(--c-cyan); }

.compact-empty,
.empty-state {
  color: var(--text3);
  font-size: 11px;
}

.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

button:hover {
  filter: brightness(1.08);
}

@media (max-width: 1200px) {
  .equipment-cockpit {
    padding: 10px;
  }

  .screen {
    width: min(100%, calc((100vh - 20px) * 16 / 9));
    max-height: calc(100vh - 20px);
    grid-template-rows: 56px minmax(0, 1fr);
    gap: 8px;
  }

  .screen-header {
    grid-template-columns: minmax(200px, 0.9fr) minmax(250px, 1fr) minmax(290px, 1fr);
    gap: 8px;
    padding: 0 10px;
  }

  .title {
    font-size: 17px;
  }

  .live-badge,
  .clock,
  .hud-btn {
    font-size: 10px;
  }

  .hud-btn {
    height: 26px;
    padding: 0 7px;
  }

  .screen-body {
    grid-template-rows: 78px minmax(0, 1.44fr) minmax(0, 1fr);
    gap: 8px;
  }

  .kpi-value {
    font-size: 22px;
  }

  .status-layout {
    grid-template-columns: 100px minmax(0, 1fr);
  }

  .status-ring {
    width: 96px;
  }

  .score-side strong {
    font-size: 18px;
  }

  .flow-node {
    width: 66px;
    height: 46px;
  }

  .center-core {
    width: 76px;
  }
}
</style>
