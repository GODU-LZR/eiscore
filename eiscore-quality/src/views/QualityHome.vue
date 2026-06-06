<template>
  <div class="quality-cockpit" :class="{ fullscreen: isFullscreen }">
    <div class="cockpit-bg"></div>
    <div class="grid-layer"></div>

    <main class="screen">
      <header class="screen-header">
        <div class="header-left">
          <div class="title"><span class="title-mark"></span>质检大屏</div>
          <div class="subtitle">QUALITY INSPECTION COMMAND CENTER</div>
        </div>
        <div class="header-center">
          <div class="live-badge">
            <span class="pulse-dot"></span>
            <span>检验 · 异常 · 整改 · 审核</span>
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
          <button class="hud-btn primary" type="button" @click="openApp('inspections')">检验台账</button>
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

        <section class="panel result-panel">
          <div class="panel-hd">
            检验结果结构
            <span class="panel-sub">{{ inspections.length }} 单</span>
          </div>
          <div class="result-ring-wrap">
            <div class="result-top">
              <div class="result-ring" :style="inspectionResultPieStyle">
                <div class="ring-hole">
                  <strong>{{ passRate }}%</strong>
                  <span>合格率</span>
                </div>
              </div>
              <div class="legend-list">
                <button
                  v-for="item in resultRows"
                  :key="item.label"
                  type="button"
                  class="legend-row"
                  @click="openApp('inspections')"
                >
                  <span class="legend-dot" :style="{ background: item.color }"></span>
                  <span>{{ item.label }}</span>
                  <strong>{{ item.value }}</strong>
                </button>
              </div>
            </div>
            <div class="result-metrics">
              <div class="mini-section">
                <div class="mini-title">检验类型</div>
                <div class="bar-list compact-list">
                  <button
                    v-for="item in inspectionTypeRows.slice(0, 3)"
                    :key="item.label"
                    type="button"
                    class="bar-row"
                    @click="openApp('inspections')"
                  >
                    <span class="bar-label">{{ item.label }}</span>
                    <div class="bar-track">
                      <div class="bar-fill" :style="{ width: item.pct + '%', background: item.color }"></div>
                    </div>
                    <span class="bar-value">{{ item.value }}</span>
                  </button>
                </div>
              </div>
              <div class="mini-section">
                <div class="mini-title">缺陷 TOP</div>
                <div class="rank-list compact-list">
                  <button
                    v-for="(item, index) in defectRanking.slice(0, 3)"
                    :key="item.name"
                    type="button"
                    class="rank-row"
                    @click="openApp('inspections')"
                  >
                    <span class="rank-no">{{ index + 1 }}</span>
                    <span class="rank-name">{{ item.name }}</span>
                    <div class="rank-track">
                      <i :style="{ width: item.pct + '%' }"></i>
                    </div>
                    <strong>{{ numberText(item.defects) }}</strong>
                  </button>
                  <div v-if="defectRanking.length === 0" class="empty-state compact-empty">暂无缺陷排行</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section class="panel command-panel">
          <div class="panel-hd">
            质量态势主屏
            <span class="panel-sub">LIVE</span>
          </div>

          <div class="command-main">
            <div class="quality-score">
              <span>本期样本合格率</span>
              <strong>{{ passRate }}%</strong>
              <em>{{ numberText(totalSamples) }} 样本 / {{ numberText(totalDefects) }} 不良</em>
            </div>
            <div class="score-side">
              <button type="button" @click="openApp('ncr')">
                <span>未关闭异常</span>
                <strong>{{ openNcrCount }}</strong>
              </button>
              <button type="button" @click="openApp('actions')">
                <span>逾期整改</span>
                <strong>{{ overdueActionCount }}</strong>
              </button>
              <button type="button" @click="openApp('audits')">
                <span>待整改审核</span>
                <strong>{{ auditFindingCount }}</strong>
              </button>
              <button type="button" @click="openApp('standards')">
                <span>有效标准</span>
                <strong>{{ effectiveStandardCount }}</strong>
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
        </section>

        <section class="panel trend-panel">
          <div class="panel-hd">
            近 7 天检验节奏
            <span class="panel-sub">{{ inspections.length }} 单</span>
          </div>
          <div class="trend-bars">
            <button
              v-for="item in inspectionBuckets"
              :key="item.label"
              type="button"
              class="trend-item"
              @click="openApp('inspections')"
            >
              <div class="trend-bar">
                <div class="trend-fill" :class="{ danger: item.defects > 0 }" :style="{ height: item.pct + '%' }"></div>
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

        <section class="panel inspection-panel">
          <div class="panel-hd">
            最新检验流
            <span class="panel-sub">{{ recentInspections.length }} 条</span>
          </div>
          <div class="scroll-container inspection-stream">
            <div
              v-if="recentInspections.length > 0"
              class="scroll-content"
              :class="{ scrolling: recentInspections.length > 3 }"
              :style="{ animationDuration: scrollDuration(recentInspections.length, 3, 12) }"
            >
              <div class="scroll-track">
                <button
                  v-for="row in recentInspections"
                  :key="'stream-a-' + (row.id || row.doc_no)"
                  type="button"
                  class="stream-row"
                  @click="openRecord(row, 'inspections')"
                >
                  <span class="stream-date">{{ formatShortDate(row.inspection_date) }}</span>
                  <span class="stream-main">
                    <strong>{{ row.item_name || row.doc_no }}</strong>
                    <span>{{ row.doc_no }} · {{ row.batch_no || row.source_doc_no || '--' }}</span>
                  </span>
                  <span class="stream-rate" :class="{ danger: numberValue(row.defect_qty) > 0 }">
                    {{ numberText(row.defect_qty) }}/{{ numberText(row.sample_qty) }}
                  </span>
                  <span class="mini-tag" :class="statusTone(row.result)">{{ row.result }}</span>
                </button>
              </div>
              <div v-if="recentInspections.length > 3" class="scroll-track">
                <button
                  v-for="row in recentInspections"
                  :key="'stream-b-' + (row.id || row.doc_no)"
                  type="button"
                  class="stream-row"
                  @click="openRecord(row, 'inspections')"
                >
                  <span class="stream-date">{{ formatShortDate(row.inspection_date) }}</span>
                  <span class="stream-main">
                    <strong>{{ row.item_name || row.doc_no }}</strong>
                    <span>{{ row.doc_no }} · {{ row.batch_no || row.source_doc_no || '--' }}</span>
                  </span>
                  <span class="stream-rate" :class="{ danger: numberValue(row.defect_qty) > 0 }">
                    {{ numberText(row.defect_qty) }}/{{ numberText(row.sample_qty) }}
                  </span>
                  <span class="mini-tag" :class="statusTone(row.result)">{{ row.result }}</span>
                </button>
              </div>
            </div>
            <div v-if="recentInspections.length === 0" class="empty-state">暂无检验记录</div>
          </div>
        </section>

        <section class="panel action-panel">
          <div class="panel-hd">
            整改闭环
            <span class="panel-sub">整改 {{ actions.length }} / 审核 {{ audits.length }}</span>
          </div>
          <div class="scroll-container action-list">
            <div
              v-if="visibleActions.length > 0"
              class="scroll-content"
              :class="{ scrolling: visibleActions.length > 3 }"
              :style="{ animationDuration: scrollDuration(visibleActions.length, 3, 12) }"
            >
              <div class="scroll-track">
                <button
                  v-for="item in visibleActions"
                  :key="'action-a-' + (item.id || item.action_no)"
                  type="button"
                  class="action-row"
                  @click="openRecord(item, 'actions')"
                >
                  <span class="action-main">
                    <strong>{{ item.action_no }}</strong>
                    <span>{{ item.task_desc }}</span>
                  </span>
                  <span class="action-meta">{{ formatShortDate(item.due_date) }}</span>
                  <span class="mini-tag" :class="statusTone(item.action_status)">{{ item.action_status }}</span>
                </button>
              </div>
              <div v-if="visibleActions.length > 3" class="scroll-track">
                <button
                  v-for="item in visibleActions"
                  :key="'action-b-' + (item.id || item.action_no)"
                  type="button"
                  class="action-row"
                  @click="openRecord(item, 'actions')"
                >
                  <span class="action-main">
                    <strong>{{ item.action_no }}</strong>
                    <span>{{ item.task_desc }}</span>
                  </span>
                  <span class="action-meta">{{ formatShortDate(item.due_date) }}</span>
                  <span class="mini-tag" :class="statusTone(item.action_status)">{{ item.action_status }}</span>
                </button>
              </div>
            </div>
            <div v-if="visibleActions.length === 0" class="empty-state">暂无整改任务</div>
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

const router = useRouter()

const loading = ref(false)
const isFullscreen = ref(false)
const clock = ref('')
const inspections = ref([])
const ncrs = ref([])
const actions = ref([])
const audits = ref([])
const standards = ref([])
const lastSyncAt = ref(null)
const realtimeReady = ref(false)
const realtimeEventCount = ref(0)

let clockTimer = null
let refreshTimer = null
let realtimeUnsub = null
let realtimeTimer = null

const QUALITY_REALTIME_TABLES = new Set([
  'quality_inspections',
  'quality_ncrs',
  'quality_corrective_actions',
  'quality_audits',
  'quality_standards'
])

const colors = {
  primary: 'var(--c-primary)',
  green: 'var(--c-green)',
  amber: 'var(--c-amber)',
  red: 'var(--c-red)',
  cyan: 'var(--c-cyan)',
  violet: 'var(--c-violet)'
}

const fallbackInspections = [
  {
    id: 'demo-qc-1',
    doc_no: 'QI-20260605-001',
    inspection_type: '来料检验',
    item_name: '食品级纸盒 500ml',
    source_name: '江门绿田包装材料',
    batch_no: 'B20260605-A01',
    sample_qty: 80,
    defect_qty: 1,
    result: '待判定',
    inspector: '张晓',
    inspection_date: '2026-06-05'
  },
  {
    id: 'demo-qc-2',
    doc_no: 'QI-20260604-012',
    inspection_type: '成品抽检',
    item_name: '常温酸奶 12瓶装',
    source_name: '包装二线',
    batch_no: 'FG20260604-08',
    sample_qty: 120,
    defect_qty: 2,
    result: '合格',
    inspector: '陈雨',
    inspection_date: '2026-06-04'
  },
  {
    id: 'demo-qc-3',
    doc_no: 'QI-20260604-009',
    inspection_type: '过程巡检',
    item_name: '灌装线 L2',
    source_name: '灌装车间',
    batch_no: 'CAP20260604-02',
    sample_qty: 45,
    defect_qty: 5,
    result: '不合格',
    inspector: '刘铭',
    inspection_date: '2026-06-04'
  }
]

const fallbackNcrs = [
  {
    id: 'demo-ncr-1',
    doc_no: 'NCR-20260604-003',
    source_type: '过程巡检',
    issue_desc: '瓶盖扭矩偏低',
    severity: '严重',
    owner_dept: '生产部',
    owner_name: '王浩',
    deadline: '2026-06-05',
    ncr_status: '待整改'
  }
]

const fallbackActions = [
  {
    id: 'demo-action-1',
    action_no: 'QA-20260604-003-01',
    ncr_doc_no: 'NCR-20260604-003',
    task_desc: '调整旋盖机扭矩参数并记录复测结果',
    owner_name: '王浩',
    due_date: '2026-06-05',
    action_status: '处理中'
  }
]

const fallbackAudits = [
  {
    id: 'demo-audit-1',
    audit_no: 'AUD-20260603-001',
    audit_type: '过程审核',
    audit_scope: '灌装二线首件确认',
    plan_date: '2026-06-06',
    auditor: '陈雨',
    finding_count: 2,
    audit_status: '待整改'
  }
]

const fallbackStandards = [
  {
    id: 'demo-standard-1',
    standard_no: 'STD-PKG-001',
    standard_name: '食品级纸盒来料检验标准',
    item_category: '包装材料',
    standard_status: '生效'
  }
]

const numberValue = (value) => {
  const num = Number(value)
  return Number.isFinite(num) ? num : 0
}

const numberText = (value) => {
  const num = numberValue(value)
  if (Math.abs(num) >= 10000) return `${(num / 10000).toFixed(1)}万`
  return Number.isInteger(num) ? String(num) : num.toFixed(1)
}

const percent = (value, total) => {
  const base = numberValue(total)
  if (base <= 0) return 0
  return Math.max(0, Math.min(100, Math.round((numberValue(value) / base) * 100)))
}

const parseDate = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const dayStart = (date = new Date()) => {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  return next
}

const daysBetween = (value, base = new Date()) => {
  const target = parseDate(value)
  if (!target) return null
  return Math.round((dayStart(target).getTime() - dayStart(base).getTime()) / 86400000)
}

const formatShortDate = (value) => {
  const date = parseDate(value)
  if (!date) return '--'
  return `${date.getMonth() + 1}/${date.getDate()}`
}

const formatClockTime = (value) => {
  const date = parseDate(value)
  if (!date) return '--:--:--'
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}

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

const applyFallbackData = () => {
  inspections.value = fallbackInspections
  ncrs.value = fallbackNcrs
  actions.value = fallbackActions
  audits.value = fallbackAudits
  standards.value = fallbackStandards
}

const loadData = async (options = {}) => {
  const silent = options?.silent === true
  if (silent && loading.value) return
  if (!silent) loading.value = true
  try {
    const [inspectionRows, ncrRows, actionRows, auditRows, standardRows] = await Promise.all([
      request({ url: '/quality_inspections?status=neq.deleted&order=inspection_date.desc&limit=500', method: 'get' }),
      request({ url: '/quality_ncrs?status=neq.deleted&order=deadline.asc&limit=500', method: 'get' }),
      request({ url: '/quality_corrective_actions?status=neq.deleted&order=due_date.asc&limit=500', method: 'get' }),
      request({ url: '/quality_audits?status=neq.deleted&order=plan_date.asc&limit=300', method: 'get' }),
      request({ url: '/quality_standards?status=neq.deleted&order=effective_date.desc&limit=300', method: 'get' })
    ])
    inspections.value = Array.isArray(inspectionRows) ? inspectionRows : []
    ncrs.value = Array.isArray(ncrRows) ? ncrRows : []
    actions.value = Array.isArray(actionRows) ? actionRows : []
    audits.value = Array.isArray(auditRows) ? auditRows : []
    standards.value = Array.isArray(standardRows) ? standardRows : []
    lastSyncAt.value = new Date()
  } catch (error) {
    if (!inspections.value.length && !ncrs.value.length && !actions.value.length && !audits.value.length && !standards.value.length) {
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

const parseRealtimePayload = (event) => {
  if (!event) return null
  if (event.payload && typeof event.payload === 'string') {
    try {
      return JSON.parse(event.payload)
    } catch (e) {
      return null
    }
  }
  if (event.payload && typeof event.payload === 'object') return event.payload
  return event.schema && event.table ? event : null
}

const handleRealtimeEvent = (event) => {
  const payload = parseRealtimePayload(event)
  if (!payload) return
  if (payload.schema === 'public' && QUALITY_REALTIME_TABLES.has(payload.table)) {
    realtimeEventCount.value += 1
    scheduleRealtimeReload()
  }
}

const totalSamples = computed(() => inspections.value.reduce((sum, row) => sum + numberValue(row.sample_qty), 0))
const totalDefects = computed(() => inspections.value.reduce((sum, row) => sum + numberValue(row.defect_qty), 0))
const passRate = computed(() => {
  if (totalSamples.value <= 0) return '0.0'
  return (((totalSamples.value - totalDefects.value) / totalSamples.value) * 100).toFixed(1)
})

const pendingInspectionCount = computed(() => inspections.value.filter((row) => row.result === '待判定').length)
const openNcrCount = computed(() => ncrs.value.filter((row) => row.ncr_status !== '已关闭').length)
const criticalNcrCount = computed(() => ncrs.value.filter((row) => row.severity === '关键' || row.severity === '严重').length)
const overdueActionCount = computed(() => actions.value.filter((row) => {
  if (row.action_status === '已完成') return false
  const delta = daysBetween(row.due_date)
  return delta !== null && delta < 0
}).length)
const auditFindingCount = computed(() => audits.value.filter((row) => row.audit_status === '待整改').length)
const effectiveStandardCount = computed(() => standards.value.filter((row) => row.standard_status === '生效').length)

const riskIndex = computed(() => {
  const score =
    pendingInspectionCount.value * 8 +
    openNcrCount.value * 12 +
    criticalNcrCount.value * 10 +
    overdueActionCount.value * 16 +
    auditFindingCount.value * 8
  return Math.min(99, score)
})

const kpiList = computed(() => [
  { label: '样本合格率', value: `${passRate.value}%`, sub: `${numberText(totalSamples.value)} 样本`, color: colors.green, appKey: 'inspections' },
  { label: '待判定检验', value: pendingInspectionCount.value, sub: `${inspections.value.length} 张检验单`, color: pendingInspectionCount.value ? colors.amber : colors.green, appKey: 'inspections' },
  { label: '未关闭异常', value: openNcrCount.value, sub: `严重 ${criticalNcrCount.value}`, color: openNcrCount.value ? colors.red : colors.green, appKey: 'ncr' },
  { label: '逾期整改', value: overdueActionCount.value, sub: `${actions.value.length} 个任务`, color: overdueActionCount.value ? colors.red : colors.cyan, appKey: 'actions' }
])

const countBy = (rows, key, fallback = '未分类') => {
  const map = new Map()
  rows.forEach((row) => {
    const label = row?.[key] || fallback
    map.set(label, (map.get(label) || 0) + 1)
  })
  return Array.from(map.entries()).map(([label, value]) => ({ label, value }))
}

const resultRows = computed(() => {
  const palette = {
    合格: colors.green,
    让步接收: colors.cyan,
    待判定: colors.amber,
    不合格: colors.red
  }
  const base = ['合格', '让步接收', '待判定', '不合格']
  const counts = countBy(inspections.value, 'result')
  return base.map((label) => ({
    label,
    value: counts.find((item) => item.label === label)?.value || 0,
    color: palette[label]
  }))
})

const inspectionResultPieStyle = computed(() => {
  const total = resultRows.value.reduce((sum, item) => sum + item.value, 0)
  if (total <= 0) return { background: 'conic-gradient(rgba(255,255,255,0.16) 0deg 360deg)' }
  let cursor = 0
  const stops = resultRows.value.map((item) => {
    const start = cursor
    const size = (item.value / total) * 360
    cursor += size
    return `${item.color} ${start}deg ${cursor}deg`
  })
  return { background: `conic-gradient(${stops.join(', ')})` }
})

const inspectionTypeRows = computed(() => {
  const rows = countBy(inspections.value, 'inspection_type')
  const maxValue = Math.max(...rows.map((item) => item.value), 1)
  const palette = [colors.primary, colors.green, colors.cyan, colors.amber, colors.violet]
  return rows
    .sort((a, b) => b.value - a.value)
    .map((item, index) => ({
      ...item,
      pct: percent(item.value, maxValue),
      color: palette[index % palette.length]
    }))
})

const defectRanking = computed(() => {
  const map = new Map()
  inspections.value.forEach((row) => {
    const defects = numberValue(row.defect_qty)
    if (defects <= 0) return
    const name = row.item_name || row.item_code || row.doc_no || '未命名对象'
    map.set(name, (map.get(name) || 0) + defects)
  })
  const rows = Array.from(map.entries())
    .map(([name, defects]) => ({ name, defects }))
    .sort((a, b) => b.defects - a.defects)
    .slice(0, 5)
  const maxValue = Math.max(...rows.map((item) => item.defects), 1)
  return rows.map((item) => ({ ...item, pct: percent(item.defects, maxValue) }))
})

const flowNodes = computed(() => [
  { label: '检验单', value: inspections.value.length, appKey: 'inspections' },
  { label: '不合格', value: inspections.value.filter((row) => row.result === '不合格').length, appKey: 'inspections' },
  { label: '异常单', value: ncrs.value.length, appKey: 'ncr' },
  { label: '整改中', value: actions.value.filter((row) => row.action_status !== '已完成').length, appKey: 'actions' },
  { label: '已关闭', value: ncrs.value.filter((row) => row.ncr_status === '已关闭').length, appKey: 'ncr' }
])

const inspectionBuckets = computed(() => {
  const today = dayStart()
  const buckets = Array.from({ length: 7 }).map((_, index) => {
    const date = new Date(today)
    date.setDate(today.getDate() - (6 - index))
    return {
      date,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      count: 0,
      defects: 0
    }
  })
  inspections.value.forEach((row) => {
    const date = parseDate(row.inspection_date)
    if (!date) return
    const diff = Math.round((dayStart(date).getTime() - dayStart(today).getTime()) / 86400000)
    const index = diff + 6
    if (index >= 0 && index < buckets.length) {
      buckets[index].count += 1
      buckets[index].defects += numberValue(row.defect_qty)
    }
  })
  const maxCount = Math.max(...buckets.map((item) => item.count), 1)
  return buckets.map((item) => ({
    ...item,
    pct: Math.max(8, percent(item.count, maxCount))
  }))
})

const recentInspections = computed(() => inspections.value.slice(0, 6))

const visibleActions = computed(() => actions.value
  .slice()
  .sort((a, b) => {
    const aOverdue = daysBetween(a.due_date) !== null && daysBetween(a.due_date) < 0 && a.action_status !== '已完成'
    const bOverdue = daysBetween(b.due_date) !== null && daysBetween(b.due_date) < 0 && b.action_status !== '已完成'
    if (aOverdue !== bOverdue) return aOverdue ? -1 : 1
    return String(a.due_date || '').localeCompare(String(b.due_date || ''))
  })
  .slice(0, 5))

const alertList = computed(() => {
  const alerts = []
  ncrs.value.forEach((row) => {
    if (row.ncr_status === '已关闭') return
    const delta = daysBetween(row.deadline)
    const level = row.severity === '关键' || row.severity === '严重' ? 'danger' : 'warn'
    alerts.push({
      id: `ncr-${row.id || row.doc_no}`,
      type: row.severity || '异常',
      message: `${row.doc_no} · ${row.issue_desc}${delta !== null ? ` · ${delta < 0 ? '逾期' + Math.abs(delta) + '天' : delta + '天内到期'}` : ''}`,
      level: delta !== null && delta < 0 ? 'danger' : level,
      appKey: 'ncr'
    })
  })
  actions.value.forEach((row) => {
    if (row.action_status === '已完成') return
    const delta = daysBetween(row.due_date)
    if (delta !== null && delta <= 1) {
      alerts.push({
        id: `action-${row.id || row.action_no}`,
        type: delta < 0 ? '逾期' : '临期',
        message: `${row.action_no} · ${row.task_desc}`,
        level: delta < 0 ? 'danger' : 'warn',
        appKey: 'actions'
      })
    }
  })
  audits.value.forEach((row) => {
    if (row.audit_status !== '待整改') return
    alerts.push({
      id: `audit-${row.id || row.audit_no}`,
      type: '审核',
      message: `${row.audit_no} · ${row.audit_scope}`,
      level: 'warn',
      appKey: 'audits'
    })
  })
  return alerts.slice(0, 6)
})

const statusTone = (status) => {
  if (['合格', '已完成', '已关闭', '生效'].includes(status)) return 'ok'
  if (['不合格', '关键', '严重'].includes(status)) return 'danger'
  if (['待判定', '待整改', '待处理', '待验证', '整改中'].includes(status)) return 'warn'
  return 'info'
}

const appRoutes = {
  inspections: '/app/inspections',
  ncr: '/app/ncr',
  actions: '/app/actions',
  audits: '/app/audits',
  standards: '/app/standards'
}

const openApp = (key) => {
  const path = appRoutes[key]
  if (path) router.push(path)
}

const openRecord = (row, appKey) => {
  if (!row?.id) return
  router.push({
    name: 'QualityDocumentDetail',
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
  refreshTimer = window.setInterval(() => loadData({ silent: true }), 12000)
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
.quality-cockpit {
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
  padding: 12px;
  box-sizing: border-box;
  color: var(--text1);
  background: var(--bg);
  container-type: size;
  font-family: "DIN Alternate", "Helvetica Neue", "PingFang SC", sans-serif;
}

.quality-cockpit.fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

.cockpit-bg,
.grid-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.cockpit-bg {
  background:
    linear-gradient(115deg, rgba(94, 234, 212, 0.12) 0 12%, transparent 12% 100%),
    linear-gradient(245deg, rgba(250, 204, 21, 0.08) 0 11%, transparent 11% 100%),
    linear-gradient(180deg, #121711 0%, #090d0a 100%);
}

.grid-layer {
  opacity: 0.86;
  background:
    linear-gradient(rgba(94, 234, 212, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(94, 234, 212, 0.045) 1px, transparent 1px),
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.035) 0 1px, transparent 1px 14px);
  background-size: 44px 44px, 44px 44px, auto;
}

.screen {
  position: relative;
  z-index: 2;
  width: min(calc(100vw - 24px), calc((100vh - 24px) * 16 / 9));
  max-width: calc(100% - 24px);
  max-height: calc(100% - 24px);
  aspect-ratio: 16 / 9;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(94, 234, 212, 0.34);
  background: linear-gradient(180deg, rgba(15, 24, 20, 0.94), rgba(8, 12, 10, 0.94));
  box-shadow: 0 20px 48px rgba(0, 0, 0, 0.34);
}

.quality-cockpit.fullscreen .screen {
  width: min(calc(100vw - 24px), calc((100vh - 24px) * 16 / 9));
  max-width: calc(100vw - 24px);
  max-height: calc(100vh - 24px);
}

@supports (width: 100cqw) {
  .screen,
  .quality-cockpit.fullscreen .screen {
    width: min(calc(100cqw - 24px), calc((100cqh - 24px) * 16 / 9));
    max-width: calc(100cqw - 24px);
    max-height: calc(100cqh - 24px);
  }
}

.screen-header {
  height: 52px;
  flex-shrink: 0;
  display: grid;
  grid-template-columns: minmax(180px, 0.9fr) minmax(280px, 1.2fr) minmax(360px, 1.5fr);
  align-items: center;
  padding: 0 14px;
  border-bottom: 2px solid rgba(94, 234, 212, 0.32);
  background:
    linear-gradient(90deg, rgba(94, 234, 212, 0.16), transparent 42%),
    repeating-linear-gradient(135deg, rgba(255, 255, 255, 0.045) 0 1px, transparent 1px 10px),
    rgba(18, 27, 22, 0.92);
}

.title {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--text1);
  font-size: 20px;
  font-weight: 900;
}

.title-mark {
  width: 18px;
  height: 18px;
  border: 3px solid var(--c-primary);
  border-left-color: transparent;
  transform: skewX(-16deg);
  box-shadow: 5px 0 0 rgba(94, 234, 212, 0.2);
}

.subtitle {
  margin-top: 2px;
  color: var(--text3);
  font-size: 10px;
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
  gap: 8px;
  padding: 6px 12px;
  border: 1px solid var(--border);
  background: rgba(94, 234, 212, 0.09);
  color: var(--c-primary);
  font-size: 12px;
  font-weight: 800;
  white-space: nowrap;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c-green);
  animation: pulse 1.8s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0.65); }
  70% { box-shadow: 0 0 0 8px rgba(74, 222, 128, 0); }
  100% { box-shadow: 0 0 0 0 rgba(74, 222, 128, 0); }
}

.refresh-text {
  color: var(--text2);
  font-size: 11px;
}

.sync-text,
.event-count {
  color: var(--text3);
  font-size: 10px;
}

.header-right {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.clock {
  color: var(--text2);
  font-size: 12px;
  white-space: nowrap;
}

.hud-btn {
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--border);
  background: rgba(94, 234, 212, 0.08);
  color: var(--text1);
  font-size: 12px;
  cursor: pointer;
}

.hud-btn.primary {
  border-color: rgba(250, 204, 21, 0.52);
  color: var(--c-amber);
}

.hud-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.screen-body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-template-rows: 92px minmax(0, 1.48fr) minmax(0, 1fr);
  gap: 10px;
  padding: 10px;
}

.panel {
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--panel);
  box-shadow: inset 0 0 22px rgba(94, 234, 212, 0.04);
}

.panel-hd {
  height: 30px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 10px;
  border-bottom: 1px solid var(--line);
  color: var(--text1);
  font-size: 12px;
  font-weight: 900;
}

.panel-sub {
  color: var(--text3);
  font-size: 10px;
  font-weight: 700;
}

.kpi-panel {
  grid-column: 1 / 13;
  grid-row: 1;
}

.kpi-grid {
  height: calc(100% - 30px);
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding: 8px 10px 8px;
}

.kpi-card,
.legend-row,
.bar-row,
.trend-item,
.stream-row,
.alert-row,
.rank-row,
.action-row,
.flow-node,
.score-side button {
  border: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.kpi-card {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(78px, auto) minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: var(--panel-soft);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.kpi-value {
  font-size: 28px;
  font-weight: 900;
  line-height: 1;
}

.kpi-label {
  color: var(--text2);
  font-size: 12px;
  font-weight: 800;
}

.kpi-copy {
  min-width: 0;
}

.kpi-sub {
  margin-top: 4px;
  color: var(--text3);
  font-size: 11px;
}

.result-panel {
  grid-column: 1 / 4;
  grid-row: 2 / 4;
}

.result-ring-wrap {
  height: calc(100% - 30px);
  display: grid;
  grid-template-rows: 142px minmax(0, 1fr);
  gap: 8px;
  padding: 10px 12px;
}

.result-top {
  min-height: 0;
  display: grid;
  grid-template-columns: 45% 55%;
  align-items: center;
  gap: 8px;
}

.result-ring {
  width: min(112px, 100%);
  aspect-ratio: 1;
  border-radius: 50%;
  display: grid;
  place-items: center;
  box-shadow: 0 0 20px rgba(94, 234, 212, 0.12);
}

.ring-hole {
  width: 68%;
  aspect-ratio: 1;
  border-radius: 50%;
  display: grid;
  place-items: center;
  align-content: center;
  background: #0d130f;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.ring-hole strong {
  font-size: 21px;
  color: var(--c-green);
}

.ring-hole span {
  color: var(--text3);
  font-size: 10px;
}

.legend-list,
.bar-list,
.scroll-track {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.scroll-container {
  flex: 1;
  height: calc(100% - 30px);
  min-height: 0;
  overflow: hidden;
  position: relative;
  padding: 8px 9px;
}

.scroll-content {
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.scroll-content.scrolling {
  animation: scrollUp linear infinite;
}

.scroll-content.scrolling:hover {
  animation-play-state: paused;
}

@keyframes scrollUp {
  0% { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}

.legend-row {
  display: grid;
  grid-template-columns: 10px 1fr auto;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  background: transparent;
  font-size: 12px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.bar-list {
  padding: 0;
}

.bar-row {
  display: grid;
  grid-template-columns: 62px minmax(0, 1fr) 28px;
  align-items: center;
  gap: 8px;
  min-height: 21px;
  background: transparent;
}

.bar-label,
.bar-value {
  color: var(--text2);
  font-size: 11px;
}

.bar-track,
.rank-track {
  height: 8px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
}

.bar-fill,
.rank-track i {
  display: block;
  height: 100%;
}

.command-panel {
  grid-column: 4 / 10;
  grid-row: 2;
  display: grid;
  grid-template-rows: 30px 104px minmax(0, 1fr);
}

.command-main {
  display: grid;
  grid-template-columns: 1.12fr 1.35fr;
  gap: 10px;
  padding: 8px 10px 7px;
}

.quality-score {
  min-height: 88px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 10px 14px;
  background:
    linear-gradient(90deg, rgba(94, 234, 212, 0.14), rgba(250, 204, 21, 0.08)),
    rgba(255, 255, 255, 0.035);
  border: 1px solid rgba(94, 234, 212, 0.24);
}

.quality-score span,
.quality-score em {
  color: var(--text2);
  font-size: 13px;
  font-style: normal;
}

.quality-score strong {
  margin: 4px 0;
  color: var(--c-green);
  font-size: 42px;
  line-height: 0.95;
}

.score-side {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.score-side button {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 7px 8px;
  background: rgba(255, 255, 255, 0.045);
  border: 1px solid var(--line);
}

.score-side span {
  color: var(--text3);
  font-size: 10px;
}

.score-side strong {
  margin-top: 6px;
  color: var(--c-amber);
  font-size: 24px;
  line-height: 1;
}

.process-map {
  position: relative;
  min-height: 0;
  margin: 0 10px 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.06);
  background:
    linear-gradient(90deg, transparent 0 31%, rgba(94, 234, 212, 0.06) 31% 31.4%, transparent 31.4% 68%, rgba(250, 204, 21, 0.06) 68% 68.4%, transparent 68.4%);
}

.process-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.process-lines path {
  fill: none;
  stroke: rgba(94, 234, 212, 0.34);
  stroke-width: 2;
}

.flow-node {
  position: absolute;
  width: 74px;
  height: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(15, 22, 18, 0.92);
  border: 1px solid rgba(94, 234, 212, 0.38);
  box-shadow: 0 0 18px rgba(94, 234, 212, 0.08);
}

.flow-node strong {
  color: var(--c-primary);
  font-size: 20px;
  line-height: 1;
}

.flow-node span {
  margin-top: 6px;
  color: var(--text2);
  font-size: 11px;
}

.node-0 { left: 5%; top: 44%; }
.node-1 { left: 22%; top: 16%; }
.node-2 { left: 43%; top: 44%; }
.node-3 { right: 22%; top: 16%; }
.node-4 { right: 5%; top: 44%; }

.center-core {
  position: absolute;
  left: 50%;
  top: 8%;
  width: 88px;
  height: 88px;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: 2px solid rgba(250, 204, 21, 0.58);
  background: rgba(250, 204, 21, 0.08);
}

.center-core strong {
  color: var(--c-amber);
  font-size: 30px;
  line-height: 1;
}

.center-core span {
  color: var(--text2);
  font-size: 12px;
}

.trend-panel {
  grid-column: 4 / 7;
  grid-row: 3;
}

.trend-bars {
  height: calc(100% - 30px);
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
  padding: 8px 10px;
}

.trend-item {
  min-width: 0;
  display: grid;
  grid-template-rows: 1fr 18px 16px;
  gap: 3px;
  justify-items: center;
  background: transparent;
}

.trend-bar {
  width: 100%;
  min-height: 46px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.055);
}

.trend-fill {
  width: 100%;
  min-height: 4px;
  background: linear-gradient(180deg, var(--c-primary), rgba(94, 234, 212, 0.3));
}

.trend-fill.danger {
  background: linear-gradient(180deg, var(--c-red), rgba(251, 113, 133, 0.28));
}

.trend-label,
.trend-value {
  color: var(--text2);
  font-size: 11px;
}

.inspection-panel {
  grid-column: 7 / 10;
  grid-row: 3;
}

.stream-row {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 46px 58px;
  align-items: center;
  gap: 7px;
  min-height: 40px;
  padding: 6px 7px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.stream-date,
.stream-rate,
.action-meta {
  color: var(--text2);
  font-size: 11px;
}

.stream-rate.danger {
  color: var(--c-red);
}

.stream-main,
.action-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.stream-main strong,
.action-main strong {
  overflow: hidden;
  color: var(--text1);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stream-main span,
.action-main span {
  overflow: hidden;
  color: var(--text3);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.result-panel,
.alert-panel,
.trend-panel,
.inspection-panel,
.action-panel {
  display: flex;
  flex-direction: column;
}

.alert-panel {
  grid-column: 10 / 13;
  grid-row: 2;
}

.action-panel {
  grid-column: 10 / 13;
  grid-row: 3;
}

.alert-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  min-height: 39px;
  padding: 6px 7px;
  background: rgba(255, 255, 255, 0.04);
  border-left: 3px solid var(--c-amber);
}

.alert-row.alert-danger {
  border-left-color: var(--c-red);
}

.alert-type {
  color: var(--c-amber);
  font-size: 11px;
  font-weight: 900;
}

.alert-danger .alert-type {
  color: var(--c-red);
}

.alert-msg {
  overflow: hidden;
  color: var(--text2);
  display: -webkit-box;
  font-size: 11px;
  line-height: 1.35;
  white-space: normal;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.rank-row {
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr) 56px 32px;
  align-items: center;
  gap: 7px;
  min-height: 21px;
  padding: 2px 0;
  background: transparent;
}

.rank-no {
  color: var(--c-primary);
  font-weight: 900;
}

.rank-name {
  overflow: hidden;
  color: var(--text2);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-track {
  height: 7px;
}

.rank-track i {
  background: linear-gradient(90deg, var(--c-red), var(--c-amber));
}

.rank-row strong {
  color: var(--text1);
  font-size: 11px;
  text-align: right;
}

.action-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 38px 58px;
  align-items: center;
  gap: 7px;
  min-height: 40px;
  padding: 6px 7px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.mini-tag {
  min-width: 0;
  padding: 2px 5px;
  color: var(--text1);
  font-size: 10px;
  text-align: center;
  white-space: nowrap;
  background: rgba(56, 189, 248, 0.18);
  border: 1px solid rgba(56, 189, 248, 0.28);
}

.mini-tag.ok {
  color: var(--c-green);
  background: rgba(74, 222, 128, 0.12);
  border-color: rgba(74, 222, 128, 0.28);
}

.mini-tag.warn {
  color: var(--c-amber);
  background: rgba(250, 204, 21, 0.12);
  border-color: rgba(250, 204, 21, 0.3);
}

.mini-tag.danger {
  color: var(--c-red);
  background: rgba(251, 113, 133, 0.12);
  border-color: rgba(251, 113, 133, 0.3);
}

.result-metrics {
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
  min-height: 0;
}

.mini-section {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mini-title {
  color: var(--text3);
  font-size: 10px;
  font-weight: 900;
}

.compact-list {
  flex: 1;
  min-height: 0;
}

.compact-empty {
  padding: 4px 0;
}

.empty-state {
  padding: 12px;
  color: var(--text3);
  font-size: 12px;
  text-align: center;
}

button:hover {
  border-color: rgba(94, 234, 212, 0.42);
  filter: brightness(1.08);
}

@media (max-width: 1120px) {
  .screen {
    width: calc(100vw - 24px);
    height: auto;
    max-height: calc(100vh - 24px);
    aspect-ratio: 16 / 9;
  }

  .screen-body {
    grid-template-columns: repeat(12, minmax(0, 1fr));
    grid-template-rows: 92px minmax(0, 1.48fr) minmax(0, 1fr);
    min-height: 0;
  }

  .kpi-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
