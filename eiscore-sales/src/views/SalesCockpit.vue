<template>
  <div ref="rootRef" class="sales-cockpit" :class="{ fullscreen: isFullscreen }" :style="cockpitScaleVars">
    <div class="hud-bg"></div>
    <div class="scan-line"></div>

    <div class="screen-stage">
      <section ref="screenRef" class="screen-shell">
      <header class="hud-header">
        <div class="hdr-left">
          <div class="hdr-title"><span class="hdr-icon">◆</span>销售经营驾驶舱</div>
          <div class="hdr-sub">SALES COMMAND CENTER</div>
        </div>
        <div class="hdr-center">
          <div class="live-badge">
            <span class="pulse-dot"></span>
            <span>{{ loading ? '数据刷新中' : '实时经营监控' }}</span>
            <span class="live-count">{{ stats.orderCount }} 笔订单</span>
            <span class="live-count live-freshness">更新 {{ lastUpdatedText }}</span>
            <span class="live-count live-freshness">{{ refreshCountdown }}s 后刷新</span>
          </div>
        </div>
        <div class="hdr-right">
          <button class="hdr-btn" type="button" title="返回应用列表" @click="goApps">应用</button>
          <button class="hdr-btn" type="button" title="刷新数据" @click="loadCockpitData">刷新</button>
          <button class="hdr-btn icon-btn" type="button" title="全屏" @click="toggleFullscreen">⛶</button>
          <div class="clock">{{ clock }}</div>
        </div>
      </header>

      <main class="hud-body">
        <aside class="col col-left">
          <section class="box kpi-box">
            <div class="box-hdr">总体指标</div>
            <div class="kpi-grid">
              <div v-for="item in kpiCards" :key="item.key" class="kpi" :class="`tone-${item.tone}`">
                <div class="kpi-val">{{ item.value }}</div>
                <div class="kpi-label">{{ item.label }}</div>
                <div class="kpi-sub">{{ item.sub }}</div>
              </div>
            </div>
          </section>

          <section class="box gauge-box">
            <div class="box-hdr">
              回款进度
              <span>{{ formatCurrency(stats.paymentAmount) }}</span>
            </div>
            <div class="gauge-wrap">
              <svg viewBox="0 0 220 132" class="gauge-svg" aria-hidden="true">
                <path d="M28 108 A82 82 0 0 1 192 108" fill="none" stroke="var(--track)" stroke-width="15" stroke-linecap="round" />
                <path
                  d="M28 108 A82 82 0 0 1 192 108"
                  fill="none"
                  :stroke="paymentGaugeColor"
                  stroke-width="15"
                  stroke-linecap="round"
                  :stroke-dasharray="paymentGaugeDash"
                  class="gauge-fill"
                />
                <text x="110" y="82" text-anchor="middle" fill="var(--text1)" font-size="32" font-weight="900" font-family="DIN Alternate, monospace">{{ paymentRateCapped }}%</text>
                <text x="110" y="105" text-anchor="middle" fill="var(--text2)" font-size="12">订单回款率</text>
              </svg>
            </div>
            <div class="gauge-meta">
              <div>
                <span>应收余额</span>
                <strong class="danger">{{ formatCurrency(stats.receivableBalance) }}</strong>
              </div>
              <div>
                <span>待核销</span>
                <strong>{{ stats.pendingVerifyCount }} 笔</strong>
              </div>
            </div>
          </section>

          <section class="box logs-box">
            <div class="box-hdr">
              销售动态
              <span>{{ salesEvents.length }} 条</span>
            </div>
            <div class="marquee-container">
              <div class="marquee-content" :class="{ scrolling: salesEvents.length > 5 }" :style="{ animationDuration: Math.max(salesEvents.length * 4, 18) + 's' }">
                <div class="event-track">
                  <button v-for="event in salesEvents" :key="'a-' + event.key" type="button" class="event-row" @click="openApp(event.appKey)">
                    <span class="event-time">{{ event.time }}</span>
                    <span class="event-badge" :class="`event-${event.tone}`">{{ event.type }}</span>
                    <span class="event-name">{{ event.title }}</span>
                    <span class="event-amount">{{ event.amount }}</span>
                  </button>
                </div>
                <div v-if="salesEvents.length > 5" class="event-track">
                  <button v-for="event in salesEvents" :key="'b-' + event.key" type="button" class="event-row" @click="openApp(event.appKey)">
                    <span class="event-time">{{ event.time }}</span>
                    <span class="event-badge" :class="`event-${event.tone}`">{{ event.type }}</span>
                    <span class="event-name">{{ event.title }}</span>
                    <span class="event-amount">{{ event.amount }}</span>
                  </button>
                </div>
              </div>
              <div v-if="salesEvents.length === 0" class="empty-tip">暂无销售动态</div>
            </div>
          </section>
        </aside>

        <section class="col col-center">
          <section class="box command-box">
            <div class="box-hdr">
              经营主屏
              <span class="live-tag"><span class="blink-dot">●</span> LIVE</span>
            </div>
            <div class="command-main">
              <div class="hero-metric">
                <span>本期有效订单</span>
                <strong>{{ formatCurrency(stats.orderAmount) }}</strong>
                <em>{{ stats.orderCount }} 笔订单 / 均单 {{ formatCurrency(stats.avgOrderAmount) }}</em>
              </div>
              <div class="hero-side">
                <div>
                  <span>商机管道</span>
                  <strong>{{ formatCurrency(stats.opportunityAmount) }}</strong>
                </div>
                <div>
                  <span>加权预测</span>
                  <strong>{{ formatCurrency(stats.weightedOpportunityAmount) }}</strong>
                </div>
                <div>
                  <span>赢单率</span>
                  <strong>{{ stats.winRate }}%</strong>
                </div>
              </div>
            </div>

            <div class="funnel-stage">
              <div class="funnel-title">
                <span>销售漏斗</span>
                <strong>{{ stats.opportunityCount }} 个活跃商机</strong>
              </div>
              <button
                v-for="stage in opportunityFunnel"
                :key="stage.label"
                type="button"
                class="funnel-row"
                :style="{ '--funnel-width': stage.rate + '%' }"
                @click="openApp('opportunities')"
              >
                <div class="funnel-meta">
                  <span>{{ stage.label }}</span>
                  <strong>{{ stage.count }} 个</strong>
                </div>
                <div class="funnel-bar">
                  <i></i>
                </div>
                <em>{{ formatCurrency(stage.amount) }}</em>
              </button>
              <div v-if="opportunityFunnel.length === 0" class="empty-tip">暂无商机数据</div>
            </div>

            <div class="center-bottom">
              <div class="order-radar">
                <div class="mini-title">订单状态</div>
                <div class="stage-strip">
                  <div v-for="item in orderStageStats" :key="item.label" class="stage-cell">
                    <span>{{ item.label }}</span>
                    <strong>{{ item.count }}</strong>
                    <i :style="{ width: item.rate + '%' }"></i>
                  </div>
                </div>
              </div>
              <div class="target-board">
                <div class="mini-title">授信占用</div>
                <div class="credit-meter">
                  <strong>{{ creditUsageRate }}%</strong>
                  <span>总授信 {{ formatCurrency(totalCreditLimit) }}</span>
                  <i :style="{ width: creditUsageRate + '%' }"></i>
                </div>
              </div>
            </div>
          </section>
        </section>

        <aside class="col col-right">
          <section class="box rank-box">
            <div class="box-hdr">
              负责人业绩
              <span>{{ ownerRanking.length }} 人</span>
            </div>
            <div class="rank-list roll-viewport" :class="{ 'is-rolling': shouldAutoScroll(ownerRanking, 3) }">
              <div v-if="ownerRanking.length" class="roll-content" :class="{ rolling: shouldAutoScroll(ownerRanking, 3) }" :style="{ '--roll-duration': scrollDuration(ownerRanking, 6) }">
                <div class="roll-track">
                  <button v-for="owner in ownerRanking" :key="owner.owner" type="button" class="rank-row" @click="openApp('orders')">
                    <span class="rank-no">{{ owner.rank }}</span>
                    <div>
                      <strong>{{ owner.owner }}</strong>
                      <span>{{ owner.orderCount }} 笔订单 / {{ owner.opportunityCount }} 个商机</span>
                      <i :style="{ width: owner.rate + '%' }"></i>
                    </div>
                    <em>{{ formatCurrency(owner.orderAmount) }}</em>
                  </button>
                </div>
                <div v-if="shouldAutoScroll(ownerRanking, 3)" class="roll-track" aria-hidden="true">
                  <button v-for="owner in ownerRanking" :key="'loop-' + owner.owner" type="button" class="rank-row" tabindex="-1" @click="openApp('orders')">
                    <span class="rank-no">{{ owner.rank }}</span>
                    <div>
                      <strong>{{ owner.owner }}</strong>
                      <span>{{ owner.orderCount }} 笔订单 / {{ owner.opportunityCount }} 个商机</span>
                      <i :style="{ width: owner.rate + '%' }"></i>
                    </div>
                    <em>{{ formatCurrency(owner.orderAmount) }}</em>
                  </button>
                </div>
              </div>
              <div v-if="ownerRanking.length === 0" class="empty-tip">暂无负责人数据</div>
            </div>
          </section>

          <section class="box alert-box">
            <div class="box-hdr">
              风险预警
              <span>{{ riskItems.length }} 项</span>
            </div>
            <div class="alert-list roll-viewport" :class="{ 'is-rolling': shouldAutoScroll(riskItems, 2) }">
              <div v-if="riskItems.length" class="roll-content" :class="{ rolling: shouldAutoScroll(riskItems, 2) }" :style="{ '--roll-duration': scrollDuration(riskItems, 7) }">
                <div class="roll-track">
                  <button v-for="item in riskItems" :key="item.key" type="button" class="alert-row" :class="`alert-${item.type}`" @click="openApp(item.appKey)">
                    <span class="alert-icon">{{ item.type === 'danger' ? '!' : '△' }}</span>
                    <div>
                      <strong>{{ item.label }} · {{ item.title }}</strong>
                      <span>{{ item.desc }}</span>
                    </div>
                  </button>
                </div>
                <div v-if="shouldAutoScroll(riskItems, 2)" class="roll-track" aria-hidden="true">
                  <button v-for="item in riskItems" :key="'loop-' + item.key" type="button" class="alert-row" :class="`alert-${item.type}`" tabindex="-1" @click="openApp(item.appKey)">
                    <span class="alert-icon">{{ item.type === 'danger' ? '!' : '△' }}</span>
                    <div>
                      <strong>{{ item.label }} · {{ item.title }}</strong>
                      <span>{{ item.desc }}</span>
                    </div>
                  </button>
                </div>
              </div>
              <div v-if="riskItems.length === 0" class="system-ok"><span>✓</span> 经营风险正常</div>
            </div>
          </section>

          <section class="box receivable-box">
            <div class="box-hdr">
              应收排行
              <span>{{ receivableCustomers.length }} 家</span>
            </div>
            <div class="heat-list roll-viewport" :class="{ 'is-rolling': shouldAutoScroll(receivableCustomers, 3) }">
              <div v-if="receivableCustomers.length" class="roll-content" :class="{ rolling: shouldAutoScroll(receivableCustomers, 3) }" :style="{ '--roll-duration': scrollDuration(receivableCustomers, 6) }">
                <div class="roll-track">
                  <button v-for="customer in receivableCustomers" :key="customer.id || customer.customer_no" type="button" class="heat-row" @click="openApp('customers')">
                    <div class="heat-top">
                      <span>{{ customer.name }}</span>
                      <strong>{{ formatCurrency(customer.receivable_balance) }}</strong>
                    </div>
                    <div class="heat-track">
                      <i :style="{ width: receivableRate(customer) + '%' }"></i>
                    </div>
                    <em>{{ customer.owner_name || '-' }} / 额度 {{ formatCurrency(customer.credit_limit) }}</em>
                  </button>
                </div>
                <div v-if="shouldAutoScroll(receivableCustomers, 3)" class="roll-track" aria-hidden="true">
                  <button v-for="customer in receivableCustomers" :key="'loop-' + (customer.id || customer.customer_no)" type="button" class="heat-row" tabindex="-1" @click="openApp('customers')">
                    <div class="heat-top">
                      <span>{{ customer.name }}</span>
                      <strong>{{ formatCurrency(customer.receivable_balance) }}</strong>
                    </div>
                    <div class="heat-track">
                      <i :style="{ width: receivableRate(customer) + '%' }"></i>
                    </div>
                    <em>{{ customer.owner_name || '-' }} / 额度 {{ formatCurrency(customer.credit_limit) }}</em>
                  </button>
                </div>
              </div>
              <div v-if="receivableCustomers.length === 0" class="empty-tip">暂无应收客户</div>
            </div>
          </section>

          <section class="box action-box">
            <div class="box-hdr">
              本周行动
              <span>{{ actionItems.length }} 项</span>
            </div>
            <div class="action-list roll-viewport" :class="{ 'is-rolling': shouldAutoScroll(actionItems, 2) }">
              <div v-if="actionItems.length" class="roll-content" :class="{ rolling: shouldAutoScroll(actionItems, 2) }" :style="{ '--roll-duration': scrollDuration(actionItems, 7) }">
                <div class="roll-track">
                  <button v-for="item in actionItems" :key="item.key" type="button" class="action-row" @click="openApp(item.appKey)">
                    <span>{{ item.label }}</span>
                    <div>
                      <strong>{{ item.title }}</strong>
                      <em>{{ item.desc }}</em>
                    </div>
                  </button>
                </div>
                <div v-if="shouldAutoScroll(actionItems, 2)" class="roll-track" aria-hidden="true">
                  <button v-for="item in actionItems" :key="'loop-' + item.key" type="button" class="action-row" tabindex="-1" @click="openApp(item.appKey)">
                    <span>{{ item.label }}</span>
                    <div>
                      <strong>{{ item.title }}</strong>
                      <em>{{ item.desc }}</em>
                    </div>
                  </button>
                </div>
              </div>
              <div v-if="actionItems.length === 0" class="empty-tip">暂无行动事项</div>
            </div>
          </section>
        </aside>
      </main>
      </section>
    </div>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import request from '@/utils/request'
import { pushAiContext } from '@/utils/ai-context'
import {
  formatSalesCockpitCurrency as formatCurrency,
  formatSalesCockpitRefreshTime as formatRefreshTime,
  formatSalesCockpitScrollDuration as scrollDuration,
  normalizeSalesCockpitRows as toRows,
  selectActiveSalesCustomers,
  selectActiveSalesFollowUps,
  selectActiveSalesOpportunities,
  selectActiveSalesOrders,
  selectActiveSalesPayments,
  shouldAutoScrollSalesCockpitRows as shouldAutoScroll
} from '@/domain/sales-cockpit-presentation-policy.js'
import {
  buildSalesCockpitKpiCards,
  buildSalesCockpitStats,
  buildSalesCreditUsage,
  buildSalesOpportunityFunnel,
  buildSalesOrderStageStats,
  buildSalesPaymentGauge
} from '@/domain/sales-cockpit-summary-policy.js'
import {
  buildSalesOwnerPerformance,
  buildSalesOwnerRanking,
  calculateSalesReceivableRate,
  selectSalesReceivableCustomers
} from '@/domain/sales-cockpit-ranking-policy.js'
import {
  buildSalesActionItems,
  buildSalesRiskItems
} from '@/domain/sales-cockpit-risk-action-policy.js'
import { buildSalesActivityEvents } from '@/domain/sales-cockpit-activity-policy.js'
import { buildSalesCockpitAiContext } from '@/domain/sales-cockpit-context-policy.js'
import { buildSalesCockpitQueryRequests } from '@/domain/sales-cockpit-query-policy.js'

const router = useRouter()
const rootRef = ref(null)
const loading = ref(false)
const isFullscreen = ref(false)
const screenRef = ref(null)
const clock = ref('')
const lastUpdatedAt = ref('')
const refreshCountdown = ref(60)
const customers = ref([])
const orders = ref([])
const opportunities = ref([])
const payments = ref([])
const followUps = ref([])

let clockTimer = null
let refreshTimer = null
let resizeObserver = null
let resizeFrame = 0
const refreshIntervalSeconds = 60
const cockpitDesignWidth = 1600
const cockpitDesignHeight = 900
const cockpitFrame = ref({
  scale: 1,
  width: cockpitDesignWidth,
  height: cockpitDesignHeight
})

const cockpitScaleVars = computed(() => ({
  '--screen-width': `${cockpitDesignWidth}px`,
  '--screen-height': `${cockpitDesignHeight}px`,
  '--stage-width': `${cockpitFrame.value.width}px`,
  '--stage-height': `${cockpitFrame.value.height}px`,
  '--cockpit-scale': cockpitFrame.value.scale
}))

const activeCustomers = computed(() => selectActiveSalesCustomers(customers.value))
const activeOrders = computed(() => selectActiveSalesOrders(orders.value))
const activePayments = computed(() => selectActiveSalesPayments(payments.value))
const activeOpportunities = computed(() => selectActiveSalesOpportunities(opportunities.value))
const activeFollowUps = computed(() => selectActiveSalesFollowUps(followUps.value))
const lastUpdatedText = computed(() => formatRefreshTime(lastUpdatedAt.value))

const stats = computed(() => buildSalesCockpitStats({
  customers: activeCustomers.value,
  orders: activeOrders.value,
  opportunities: opportunities.value,
  activeOpportunities: activeOpportunities.value,
  payments: activePayments.value,
  followUps: activeFollowUps.value
}))
const kpiCards = computed(() => buildSalesCockpitKpiCards(stats.value))
const opportunityFunnel = computed(() => buildSalesOpportunityFunnel(activeOpportunities.value))
const orderStageStats = computed(() => buildSalesOrderStageStats(activeOrders.value))
const creditUsage = computed(() => buildSalesCreditUsage({
  customers: activeCustomers.value,
  receivableBalance: stats.value.receivableBalance
}))
const totalCreditLimit = computed(() => creditUsage.value.totalCreditLimit)
const creditUsageRate = computed(() => creditUsage.value.rate)
const paymentGauge = computed(() => buildSalesPaymentGauge(stats.value.paymentRate))
const paymentRateCapped = computed(() => paymentGauge.value.rate)
const paymentGaugeColor = computed(() => paymentGauge.value.color)
const paymentGaugeDash = computed(() => paymentGauge.value.dash)

const receivableCustomers = computed(() => selectSalesReceivableCustomers(activeCustomers.value))
const receivableRate = (customer) => calculateSalesReceivableRate(customer, receivableCustomers.value)
const ownerPerformance = computed(() => buildSalesOwnerPerformance({
  orders: activeOrders.value,
  opportunities: activeOpportunities.value
}))
const ownerRanking = computed(() => buildSalesOwnerRanking(ownerPerformance.value))

const riskItems = computed(() => buildSalesRiskItems({
  referenceTime: new Date(),
  orders: activeOrders.value,
  opportunities: activeOpportunities.value,
  receivableCustomers: receivableCustomers.value
}))
const actionItems = computed(() => buildSalesActionItems({
  referenceTime: new Date(),
  followUps: activeFollowUps.value,
  opportunities: activeOpportunities.value
}))

const salesEvents = computed(() => buildSalesActivityEvents({
  orders: activeOrders.value,
  payments: activePayments.value,
  followUps: activeFollowUps.value
}))

const buildCockpitContext = () => buildSalesCockpitAiContext({
  stats: stats.value,
  kpis: kpiCards.value,
  funnel: opportunityFunnel.value,
  ownerPerformance: ownerPerformance.value,
  receivableCustomers: receivableCustomers.value,
  risks: riskItems.value,
  actions: actionItems.value,
  events: salesEvents.value
})

const syncCockpitContext = () => {
  pushAiContext(buildCockpitContext())
}

const updateCockpitScale = () => {
  const root = rootRef.value
  if (!root) return
  const style = window.getComputedStyle(root)
  const paddingX = parseFloat(style.paddingLeft || 0) + parseFloat(style.paddingRight || 0)
  const paddingY = parseFloat(style.paddingTop || 0) + parseFloat(style.paddingBottom || 0)
  const availableWidth = Math.max(root.clientWidth - paddingX, 320)
  const availableHeight = Math.max(root.clientHeight - paddingY, 180)
  const scale = Math.min(availableWidth / cockpitDesignWidth, availableHeight / cockpitDesignHeight)
  const nextScale = Math.max(0.2, Number(scale.toFixed(4)))
  cockpitFrame.value = {
    scale: nextScale,
    width: Math.round(cockpitDesignWidth * nextScale),
    height: Math.round(cockpitDesignHeight * nextScale)
  }
}

const scheduleCockpitScale = () => {
  if (resizeFrame) cancelAnimationFrame(resizeFrame)
  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = 0
    updateCockpitScale()
  })
}

const loadCockpitData = async () => {
  loading.value = true
  try {
    const [customerRows, orderRows, opportunityRows, paymentRows, followRows] = await Promise.all(
      buildSalesCockpitQueryRequests().map((config) => request(config))
    )
    customers.value = toRows(customerRows)
    orders.value = toRows(orderRows)
    opportunities.value = toRows(opportunityRows)
    payments.value = toRows(paymentRows)
    followUps.value = toRows(followRows)
    lastUpdatedAt.value = new Date().toISOString()
    refreshCountdown.value = refreshIntervalSeconds
  } catch (error) {
    console.warn('加载销售驾驶舱失败', error)
  } finally {
    loading.value = false
    syncCockpitContext()
  }
}

const openApp = async (key) => {
  await router.push(`/app/${key}`)
}

const goApps = () => {
  router.push('/apps')
}

const updateClock = () => {
  clock.value = new Date().toLocaleString('zh-CN', { hour12: false })
  refreshCountdown.value = Math.max(refreshCountdown.value - 1, 0)
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
  scheduleCockpitScale()
}

onMounted(() => {
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  window.addEventListener('resize', scheduleCockpitScale)
  if (window.ResizeObserver && rootRef.value) {
    resizeObserver = new ResizeObserver(scheduleCockpitScale)
    resizeObserver.observe(rootRef.value)
  }
  scheduleCockpitScale()
  syncCockpitContext()
  loadCockpitData()
  refreshTimer = setInterval(loadCockpitData, refreshIntervalSeconds * 1000)
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
  if (refreshTimer) clearInterval(refreshTimer)
  if (resizeObserver) resizeObserver.disconnect()
  if (resizeFrame) cancelAnimationFrame(resizeFrame)
  window.removeEventListener('resize', scheduleCockpitScale)
  document.removeEventListener('fullscreenchange', handleFullscreenChange)
})

watch([stats, kpiCards, opportunityFunnel, ownerPerformance, receivableCustomers, riskItems, actionItems, salesEvents], syncCockpitContext, { deep: true })
</script>

<style scoped>
.sales-cockpit {
  --bg: #020617;
  --panel: rgba(8, 20, 38, 0.76);
  --panel-strong: rgba(12, 29, 54, 0.88);
  --border: rgba(56, 189, 248, 0.34);
  --border-soft: rgba(125, 211, 252, 0.16);
  --glow: rgba(56, 189, 248, 0.12);
  --glow-strong: rgba(56, 189, 248, 0.26);
  --text1: #f8fafc;
  --text2: #94a3b8;
  --text3: #64748b;
  --c-primary: #38bdf8;
  --c-accent: #a78bfa;
  --c-green: #34d399;
  --c-amber: #fbbf24;
  --c-red: #fb7185;
  --c-cyan: #22d3ee;
  --track: rgba(148, 163, 184, 0.18);
  --grid-line: rgba(56, 189, 248, 0.06);
  --scan-color: rgba(56, 189, 248, 0.035);
  --screen-width: 1600px;
  --screen-height: 900px;
  --stage-width: 1600px;
  --stage-height: 900px;
  --cockpit-scale: 1;
  position: relative;
  width: 100%;
  min-width: 0;
  min-height: min(720px, 100vh);
  height: 100%;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 12px;
  color: var(--text1);
  background: var(--bg);
  font-family: "DIN Alternate", "Helvetica Neue", "PingFang SC", sans-serif;
}

.sales-cockpit.fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  width: 100vw;
  height: 100vh;
  min-height: 0;
  overflow: hidden;
  padding: 0;
}

.sales-cockpit:fullscreen {
  width: 100vw;
  height: 100vh;
  min-height: 0;
  overflow: hidden;
  padding: 12px;
  background: var(--bg);
}

.hud-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-color: var(--bg);
  background-image:
    radial-gradient(circle at 50% 12%, rgba(14, 165, 233, 0.2), transparent 28%),
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px);
  background-size: 100% 100%, 38px 38px, 38px 38px;
  animation: bgShift 22s linear infinite;
}

.scan-line {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background: repeating-linear-gradient(0deg, transparent 0, var(--scan-color) 2px, transparent 4px);
}

.screen-stage {
  position: relative;
  z-index: 2;
  width: var(--stage-width);
  height: var(--stage-height);
  flex: 0 0 auto;
  overflow: visible;
}

.screen-shell {
  position: relative;
  width: var(--screen-width);
  height: var(--screen-height);
  aspect-ratio: 16 / 9;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transform: scale(var(--cockpit-scale));
  transform-origin: top left;
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(2, 6, 23, 0.96)),
    radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.13), transparent 55%);
  box-shadow: 0 0 44px rgba(14, 165, 233, 0.18);
}

.screen-shell:fullscreen {
  width: var(--screen-width);
  height: var(--screen-height);
  aspect-ratio: 16 / 9;
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.94), rgba(2, 6, 23, 0.98)),
    radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.13), transparent 55%);
}

.hud-header {
  height: 58px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 0 18px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(90deg, rgba(8, 20, 38, 0.9), rgba(15, 23, 42, 0.62), rgba(8, 20, 38, 0.9));
  box-shadow: 0 0 24px var(--glow);
  backdrop-filter: blur(12px);
}

.hdr-left,
.hdr-right,
.live-badge,
.box-hdr,
.event-row,
.rank-row,
.alert-row,
.action-row,
.heat-top {
  display: flex;
  align-items: center;
}

.hdr-left {
  width: 310px;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
}

.hdr-title {
  color: var(--c-primary);
  font-size: 19px;
  font-weight: 900;
  letter-spacing: 2px;
  line-height: 1.2;
  text-shadow: 0 0 12px var(--glow-strong);
}

.hdr-icon {
  margin-right: 7px;
  font-size: 13px;
}

.hdr-sub {
  margin-top: 3px;
  color: var(--text3);
  font-size: 11px;
  letter-spacing: 4px;
}

.hdr-center {
  flex: 1;
  display: flex;
  justify-content: center;
  min-width: 0;
}

.live-badge {
  max-width: 100%;
  gap: 10px;
  padding: 6px 24px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.08);
  box-shadow: inset 0 0 14px var(--glow);
  color: var(--c-primary);
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--c-green);
  animation: pulse 2s infinite;
}

.live-count {
  color: var(--text2);
  font-size: 12px;
  font-weight: 500;
}

.live-freshness {
  color: rgba(203, 213, 225, 0.84);
}

.hdr-right {
  width: 380px;
  justify-content: flex-end;
  gap: 8px;
}

.clock {
  min-width: 170px;
  color: var(--c-primary);
  font-size: 16px;
  font-weight: 800;
  letter-spacing: 1px;
  text-align: right;
}

.hdr-btn {
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: transparent;
  color: var(--c-primary);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.icon-btn {
  width: 32px;
  padding: 0;
  font-size: 16px;
}

.hdr-btn:hover {
  background: var(--glow);
}

.hud-body {
  position: relative;
  flex: 1;
  display: flex;
  gap: 12px;
  min-height: 0;
  padding: 12px;
  overflow: hidden;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  height: 100%;
}

.col-left {
  width: 360px;
  flex-shrink: 0;
}

.col-center {
  flex: 1;
  min-width: 0;
}

.col-right {
  width: 430px;
  flex-shrink: 0;
}

.box {
  position: relative;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--panel);
  box-shadow: inset 0 0 20px var(--glow);
  backdrop-filter: blur(12px);
}

.box::before,
.box::after {
  content: "";
  position: absolute;
  z-index: 3;
  width: 14px;
  height: 14px;
  border: 2px solid var(--c-primary);
  opacity: 0.68;
  pointer-events: none;
}

.box::before {
  top: -1px;
  left: -1px;
  border-right: 0;
  border-bottom: 0;
}

.box::after {
  right: -1px;
  bottom: -1px;
  border-top: 0;
  border-left: 0;
}

.box-hdr {
  min-height: 31px;
  flex-shrink: 0;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(90deg, var(--glow), transparent);
  color: var(--c-primary);
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 1px;
}

.box-hdr span {
  color: var(--text2);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0;
}

.kpi-box {
  flex: 3;
}

.gauge-box {
  flex: 2.6;
}

.logs-box {
  flex: 4.4;
}

.command-box {
  flex: 1;
}

.rank-box {
  flex: 2.6;
}

.alert-box {
  flex: 2.4;
}

.receivable-box {
  flex: 2.5;
}

.action-box {
  flex: 2.5;
}

.kpi-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  min-height: 0;
  padding: 8px;
}

.kpi {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px 3px;
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.06);
  text-align: center;
}

.kpi-val {
  max-width: 100%;
  overflow: hidden;
  color: var(--c-primary);
  font-size: 17px;
  font-weight: 900;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kpi-label {
  color: var(--text2);
  font-size: 10px;
  line-height: 1.2;
}

.kpi-sub {
  max-width: 100%;
  overflow: hidden;
  color: var(--text3);
  font-size: 9px;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tone-indigo .kpi-val,
.tone-teal .kpi-val {
  color: var(--c-accent);
}

.tone-green .kpi-val {
  color: var(--c-green);
}

.tone-orange .kpi-val {
  color: var(--c-amber);
}

.tone-red .kpi-val {
  color: var(--c-red);
}

.gauge-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px 0;
}

.gauge-svg {
  width: 100%;
  max-width: 220px;
  height: auto;
}

.gauge-fill {
  transition: stroke-dasharray 0.8s ease;
  filter: drop-shadow(0 0 8px currentColor);
}

.gauge-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  padding: 0 10px 10px;
}

.gauge-meta div {
  min-width: 0;
  padding: 7px 8px;
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.45);
}

.gauge-meta span,
.gauge-meta strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gauge-meta span {
  color: var(--text2);
  font-size: 10px;
}

.gauge-meta strong {
  margin-top: 3px;
  color: var(--text1);
  font-size: 13px;
}

.danger {
  color: var(--c-red) !important;
}

.marquee-container {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 6px;
}

.marquee-content {
  display: flex;
  flex-direction: column;
}

.scrolling {
  animation: scrollUp linear infinite;
}

.marquee-container:hover .scrolling {
  animation-play-state: paused;
}

.event-track {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.event-row {
  width: 100%;
  min-width: 0;
  gap: 6px;
  padding: 5px 6px;
  border: 1px solid var(--border-soft);
  border-radius: 3px;
  background: rgba(56, 189, 248, 0.06);
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.event-row:hover {
  border-color: var(--border);
  background: rgba(56, 189, 248, 0.12);
}

.event-time {
  width: 38px;
  flex-shrink: 0;
  color: var(--text3);
  font-size: 10px;
}

.event-badge {
  flex-shrink: 0;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: 800;
}

.event-order {
  background: rgba(56, 189, 248, 0.14);
  color: var(--c-primary);
}

.event-payment {
  background: rgba(52, 211, 153, 0.14);
  color: var(--c-green);
}

.event-follow {
  background: rgba(251, 191, 36, 0.14);
  color: var(--c-amber);
}

.event-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--text1);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-amount {
  max-width: 70px;
  flex-shrink: 0;
  overflow: hidden;
  color: var(--text2);
  font-size: 11px;
  font-weight: 700;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-main {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) 210px;
  gap: 10px;
  padding: 12px;
}

.hero-metric {
  min-width: 0;
  padding: 16px 18px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background:
    linear-gradient(135deg, rgba(56, 189, 248, 0.16), rgba(15, 23, 42, 0.28)),
    radial-gradient(circle at right center, rgba(167, 139, 250, 0.22), transparent 48%);
  box-shadow: inset 0 0 20px rgba(56, 189, 248, 0.11);
}

.hero-metric span,
.hero-metric em,
.hero-side span {
  color: var(--text2);
  font-size: 12px;
  font-style: normal;
}

.hero-metric strong {
  display: block;
  max-width: 100%;
  margin-top: 10px;
  overflow: hidden;
  color: var(--text1);
  font-size: 42px;
  font-weight: 900;
  line-height: 1.05;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-shadow: 0 0 20px rgba(56, 189, 248, 0.28);
}

.hero-metric em {
  display: block;
  margin-top: 9px;
}

.hero-side {
  display: grid;
  grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: 6px;
}

.hero-side div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 8px 10px;
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.06);
}

.hero-side strong {
  display: block;
  max-width: 100%;
  margin-top: 5px;
  overflow: hidden;
  color: var(--c-primary);
  font-size: 20px;
  font-weight: 900;
  line-height: 1.05;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.funnel-stage {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 12px 12px;
}

.funnel-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--text2);
  font-size: 12px;
}

.funnel-title strong {
  color: var(--c-primary);
  font-size: 12px;
}

.funnel-row {
  min-width: 0;
  display: grid;
  grid-template-columns: 112px minmax(0, 1fr) 90px;
  align-items: center;
  gap: 10px;
  padding: 7px 9px;
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  background: rgba(15, 23, 42, 0.36);
  color: inherit;
  cursor: pointer;
}

.funnel-row:hover {
  border-color: var(--border);
  background: rgba(56, 189, 248, 0.1);
}

.funnel-meta {
  min-width: 0;
}

.funnel-meta span,
.funnel-meta strong,
.funnel-row em {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.funnel-meta span {
  color: var(--text1);
  font-size: 13px;
  font-weight: 800;
}

.funnel-meta strong,
.funnel-row em {
  color: var(--text2);
  font-size: 11px;
  font-style: normal;
}

.funnel-bar {
  height: 14px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.15);
}

.funnel-bar i {
  display: block;
  width: var(--funnel-width);
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--c-primary), var(--c-accent));
  box-shadow: 0 0 14px rgba(56, 189, 248, 0.32);
}

.center-bottom {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 210px;
  gap: 10px;
  padding: 0 12px 12px;
}

.order-radar,
.target-board {
  min-width: 0;
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.05);
}

.mini-title {
  padding: 7px 9px 0;
  color: var(--text2);
  font-size: 11px;
  font-weight: 800;
}

.stage-strip {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
  padding: 7px 8px 9px;
}

.stage-cell {
  min-width: 0;
}

.stage-cell span,
.stage-cell strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stage-cell span {
  color: var(--text2);
  font-size: 10px;
}

.stage-cell strong {
  margin: 3px 0;
  color: var(--text1);
  font-size: 16px;
}

.stage-cell i,
.credit-meter i,
.rank-row i,
.heat-track i {
  display: block;
  height: 4px;
  border-radius: 999px;
  background: linear-gradient(90deg, var(--c-primary), var(--c-green));
}

.credit-meter {
  position: relative;
  padding: 9px;
}

.credit-meter strong,
.credit-meter span {
  display: block;
}

.credit-meter strong {
  color: var(--c-amber);
  font-size: 22px;
  line-height: 1;
}

.credit-meter span {
  margin: 5px 0 8px;
  overflow: hidden;
  color: var(--text2);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-list,
.alert-list,
.heat-list,
.action-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 7px;
  scrollbar-width: thin;
  scrollbar-color: rgba(56, 189, 248, 0.38) rgba(15, 23, 42, 0.3);
}

.rank-list::-webkit-scrollbar,
.alert-list::-webkit-scrollbar,
.heat-list::-webkit-scrollbar,
.action-list::-webkit-scrollbar {
  width: 5px;
}

.rank-list::-webkit-scrollbar-thumb,
.alert-list::-webkit-scrollbar-thumb,
.heat-list::-webkit-scrollbar-thumb,
.action-list::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.36);
}

.roll-viewport.is-rolling {
  overflow: hidden;
}

.roll-content,
.roll-track {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.roll-content.rolling {
  animation: rollList var(--roll-duration, 28s) linear infinite;
}

.roll-viewport:hover .roll-content.rolling {
  animation-play-state: paused;
}

.rank-row,
.alert-row,
.heat-row,
.action-row {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  background: rgba(56, 189, 248, 0.055);
  color: inherit;
  cursor: pointer;
  text-align: left;
}

.rank-row:hover,
.alert-row:hover,
.heat-row:hover,
.action-row:hover {
  border-color: var(--border);
  background: rgba(56, 189, 248, 0.12);
}

.rank-row {
  gap: 8px;
  padding: 6px 7px;
}

.rank-no {
  width: 26px;
  flex-shrink: 0;
  color: var(--c-primary);
  font-size: 14px;
  font-weight: 900;
}

.rank-row div,
.alert-row div,
.action-row div {
  flex: 1;
  min-width: 0;
}

.rank-row strong,
.rank-row span,
.rank-row em,
.alert-row strong,
.alert-row span,
.action-row strong,
.action-row em,
.heat-row span,
.heat-row strong,
.heat-row em {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: normal;
  overflow-wrap: anywhere;
}

.rank-row strong,
.alert-row strong,
.action-row strong {
  display: block;
  color: var(--text1);
  font-size: 12px;
  line-height: 1.35;
}

.rank-row span,
.alert-row span,
.action-row em,
.heat-row em {
  display: block;
  margin-top: 2px;
  color: var(--text2);
  font-size: 10px;
  font-style: normal;
  line-height: 1.35;
}

.rank-row i {
  margin-top: 5px;
  background: linear-gradient(90deg, var(--c-accent), var(--c-primary));
}

.rank-row em {
  width: 86px;
  flex-shrink: 0;
  color: var(--c-green);
  font-size: 12px;
  font-style: normal;
  font-weight: 900;
  text-align: right;
}

.alert-row {
  gap: 8px;
  padding: 7px 8px;
}

.alert-icon {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 13px;
  font-weight: 900;
}

.alert-danger {
  border-left: 3px solid var(--c-red);
}

.alert-danger .alert-icon {
  background: rgba(251, 113, 133, 0.14);
  color: var(--c-red);
}

.alert-warning {
  border-left: 3px solid var(--c-amber);
}

.alert-warning .alert-icon {
  background: rgba(251, 191, 36, 0.14);
  color: var(--c-amber);
}

.heat-row {
  display: block;
  padding: 7px 8px;
}

.heat-top {
  justify-content: space-between;
  gap: 8px;
}

.heat-top span {
  min-width: 0;
  color: var(--text1);
  font-size: 12px;
  font-weight: 800;
}

.heat-top strong {
  width: 92px;
  flex-shrink: 0;
  color: var(--c-red);
  font-size: 12px;
  text-align: right;
}

.heat-track {
  height: 4px;
  margin: 6px 0 4px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.16);
}

.heat-track i {
  height: 100%;
  background: linear-gradient(90deg, var(--c-amber), var(--c-red));
}

.action-row {
  gap: 8px;
  padding: 7px 8px;
}

.action-row > span {
  width: 38px;
  flex-shrink: 0;
  padding: 2px 0;
  border: 1px solid var(--border-soft);
  border-radius: 3px;
  color: var(--c-primary);
  font-size: 10px;
  font-weight: 800;
  text-align: center;
}

.empty-tip,
.system-ok {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text3);
  font-size: 12px;
  text-align: center;
}

.system-ok {
  gap: 6px;
  color: var(--c-green);
  font-weight: 800;
}

.system-ok span {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(52, 211, 153, 0.14);
}

.live-tag {
  color: var(--c-red) !important;
  font-size: 10px !important;
  letter-spacing: 1px !important;
}

.blink-dot {
  animation: blink 1s infinite;
}

@keyframes bgShift {
  0% { background-position: 0 0, 0 0, 0 0; }
  100% { background-position: 0 0, 38px 38px, 38px 38px; }
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.72); }
  70% { box-shadow: 0 0 0 7px rgba(52, 211, 153, 0); }
  100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
}

@keyframes scrollUp {
  0% { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}

@keyframes rollList {
  0% { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

@media (max-width: 1180px), (max-height: 680px) {
  .hud-header {
    height: 52px;
    padding: 0 14px;
  }

  .hud-body {
    gap: 8px;
    padding: 8px;
  }

  .col {
    gap: 8px;
  }

  .hdr-left {
    width: 270px;
  }

  .hdr-right {
    width: 340px;
  }

  .hdr-title {
    font-size: 17px;
  }

  .hero-metric strong {
    font-size: 34px;
  }

  .command-main,
  .center-bottom {
    grid-template-columns: minmax(0, 1fr) 180px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .hud-bg,
  .pulse-dot,
  .scrolling,
  .roll-content.rolling,
  .blink-dot {
    animation: none !important;
  }

  .gauge-fill {
    transition: none;
  }
}
</style>
