<template>
  <div class="sales-cockpit" :class="{ fullscreen: isFullscreen }">
    <div class="hud-bg"></div>
    <div class="scan-line"></div>

    <section ref="screenRef" class="screen-shell">
      <header class="hud-header">
        <div class="hdr-left">
          <div class="hdr-title"><span class="hdr-icon">◆</span>销售经营驾驶舱</div>
          <div class="hdr-sub">SALES COMMAND CENTER</div>
        </div>
        <div class="hdr-center">
          <div class="live-badge">
            <span class="pulse-dot"></span>
            <span>{{ loading ? '数据刷新中' : '经营实时监控' }}</span>
            <span class="live-count">{{ stats.orderCount }} 笔订单</span>
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
              <div class="marquee-content" :class="{ scrolling: salesEvents.length > 5 }" :style="{ animationDuration: Math.max(salesEvents.length * 3, 14) + 's' }">
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
            <div class="rank-list">
              <button v-for="owner in ownerRanking" :key="owner.owner" type="button" class="rank-row" @click="openApp('orders')">
                <span class="rank-no">{{ owner.rank }}</span>
                <div>
                  <strong>{{ owner.owner }}</strong>
                  <span>{{ owner.orderCount }} 笔订单 / {{ owner.opportunityCount }} 个商机</span>
                  <i :style="{ width: owner.rate + '%' }"></i>
                </div>
                <em>{{ formatCurrency(owner.orderAmount) }}</em>
              </button>
              <div v-if="ownerRanking.length === 0" class="empty-tip">暂无负责人数据</div>
            </div>
          </section>

          <section class="box alert-box">
            <div class="box-hdr">
              风险预警
              <span>{{ riskItems.length }} 项</span>
            </div>
            <div class="alert-list">
              <button v-for="item in riskItems" :key="item.key" type="button" class="alert-row" :class="`alert-${item.type}`" @click="openApp(item.appKey)">
                <span class="alert-icon">{{ item.type === 'danger' ? '!' : '△' }}</span>
                <div>
                  <strong>{{ item.label }} · {{ item.title }}</strong>
                  <span>{{ item.desc }}</span>
                </div>
              </button>
              <div v-if="riskItems.length === 0" class="system-ok"><span>✓</span> 经营风险正常</div>
            </div>
          </section>

          <section class="box receivable-box">
            <div class="box-hdr">
              应收排行
              <span>{{ receivableCustomers.length }} 家</span>
            </div>
            <div class="heat-list">
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
              <div v-if="receivableCustomers.length === 0" class="empty-tip">暂无应收客户</div>
            </div>
          </section>

          <section class="box action-box">
            <div class="box-hdr">
              本周行动
              <span>{{ actionItems.length }} 项</span>
            </div>
            <div class="action-list">
              <button v-for="item in actionItems" :key="item.key" type="button" class="action-row" @click="openApp(item.appKey)">
                <span>{{ item.label }}</span>
                <div>
                  <strong>{{ item.title }}</strong>
                  <em>{{ item.desc }}</em>
                </div>
              </button>
              <div v-if="actionItems.length === 0" class="empty-tip">暂无行动事项</div>
            </div>
          </section>
        </aside>
      </main>
    </section>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import request from '@/utils/request'
import { pushAiContext } from '@/utils/ai-context'

const router = useRouter()
const loading = ref(false)
const isFullscreen = ref(false)
const screenRef = ref(null)
const clock = ref('')
const customers = ref([])
const orders = ref([])
const opportunities = ref([])
const payments = ref([])
const followUps = ref([])

let clockTimer = null
let refreshTimer = null

const toRows = (value) => (Array.isArray(value) ? value : [])
const toAmount = (value) => {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}
const sumBy = (rows, prop) => rows.reduce((sum, row) => sum + toAmount(row?.[prop]), 0)
const getDateTime = (value) => {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}
const formatDate = (value) => value ? String(value).slice(0, 10) : '-'
const formatTime = (value) => {
  if (!value) return '--:--'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '--:--'
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
const formatAmount = (value) => {
  const amount = toAmount(value)
  const abs = Math.abs(amount)
  if (abs >= 100000000) return `${(amount / 100000000).toFixed(abs >= 1000000000 ? 1 : 2)}亿`
  if (abs >= 10000) return `${(amount / 10000).toFixed(abs >= 1000000 ? 0 : 1)}万`
  return amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}
const formatCurrency = (value) => `¥${formatAmount(value)}`
const clampRate = (value) => Math.max(0, Math.min(100, Math.round(toAmount(value))))

const activeCustomers = computed(() => customers.value.filter((row) => row?.status !== 'deleted'))
const activeOrders = computed(() => orders.value.filter((row) => row?.status !== 'deleted' && row?.order_status !== '已取消'))
const activePayments = computed(() => payments.value.filter((row) => row?.status !== 'deleted'))
const activeOpportunities = computed(() => opportunities.value.filter((row) => row?.status !== 'deleted' && !['输单', '搁置'].includes(row?.stage)))
const activeFollowUps = computed(() => followUps.value.filter((row) => row?.status !== 'deleted'))

const totalCreditLimit = computed(() => sumBy(activeCustomers.value, 'credit_limit'))
const creditUsageRate = computed(() => {
  if (!totalCreditLimit.value) return 0
  return Math.min(100, Math.round((stats.value.receivableBalance / totalCreditLimit.value) * 1000) / 10)
})

const stats = computed(() => {
  const orderAmount = sumBy(activeOrders.value, 'total_amount')
  const paymentAmount = sumBy(activePayments.value, 'amount')
  const opportunityAmount = sumBy(activeOpportunities.value, 'expected_amount')
  const weightedOpportunityAmount = activeOpportunities.value.reduce((sum, row) => {
    return sum + toAmount(row.expected_amount) * toAmount(row.probability) / 100
  }, 0)
  const receivableBalance = sumBy(activeCustomers.value, 'receivable_balance') || Math.max(orderAmount - paymentAmount, 0)
  const closedOpportunities = opportunities.value.filter((row) => row?.status !== 'deleted' && ['赢单', '输单'].includes(row?.stage))
  const wonOpportunities = closedOpportunities.filter((row) => row?.stage === '赢单')
  return {
    customerCount: activeCustomers.value.length,
    strategicCustomerCount: activeCustomers.value.filter((row) => ['战略客户', '重点客户'].includes(row?.level)).length,
    opportunityCount: activeOpportunities.value.length,
    orderCount: activeOrders.value.length,
    paymentCount: activePayments.value.length,
    followCount: activeFollowUps.value.length,
    orderAmount,
    paymentAmount,
    opportunityAmount,
    weightedOpportunityAmount,
    receivableBalance,
    avgOrderAmount: activeOrders.value.length ? orderAmount / activeOrders.value.length : 0,
    winRate: closedOpportunities.length ? Math.round((wonOpportunities.length / closedOpportunities.length) * 1000) / 10 : 0,
    paymentRate: orderAmount ? Math.round((paymentAmount / orderAmount) * 1000) / 10 : 0,
    pendingVerifyCount: activePayments.value.filter((row) => row?.verify_status !== '已核销').length
  }
})

const kpiCards = computed(() => [
  { key: 'customers', label: '客户总数', value: `${stats.value.customerCount}`, sub: `战略/重点 ${stats.value.strategicCustomerCount} 家`, tone: 'blue' },
  { key: 'opportunities', label: '商机管道', value: formatCurrency(stats.value.opportunityAmount), sub: `${stats.value.opportunityCount} 个活跃商机`, tone: 'indigo' },
  { key: 'weighted', label: '加权预测', value: formatCurrency(stats.value.weightedOpportunityAmount), sub: '按赢率折算', tone: 'teal' },
  { key: 'orders', label: '有效订单', value: formatCurrency(stats.value.orderAmount), sub: `${stats.value.orderCount} 笔订单`, tone: 'green' },
  { key: 'payments', label: '回款金额', value: formatCurrency(stats.value.paymentAmount), sub: `回款率 ${stats.value.paymentRate}%`, tone: 'orange' },
  { key: 'receivable', label: '应收余额', value: formatCurrency(stats.value.receivableBalance), sub: `待核销 ${stats.value.pendingVerifyCount} 笔`, tone: 'red' }
])

const opportunityFunnel = computed(() => {
  const order = ['初步接洽', '需求确认', '方案报价', '商务谈判', '赢单']
  const totalAmount = sumBy(activeOpportunities.value, 'expected_amount') || 1
  return order
    .map((stage) => {
      const rows = activeOpportunities.value.filter((row) => row?.stage === stage)
      const amount = sumBy(rows, 'expected_amount')
      return {
        label: stage,
        count: rows.length,
        amount,
        rate: Math.max(8, Math.round((amount / totalAmount) * 100))
      }
    })
    .filter((item) => item.count > 0)
})

const paymentRateCapped = computed(() => clampRate(stats.value.paymentRate))
const paymentGaugeColor = computed(() => {
  if (paymentRateCapped.value >= 80) return 'var(--c-green)'
  if (paymentRateCapped.value >= 50) return 'var(--c-amber)'
  return 'var(--c-red)'
})
const paymentGaugeDash = computed(() => {
  const total = 257.61
  const filled = total * paymentRateCapped.value / 100
  return `${filled} ${total - filled}`
})

const orderStageStats = computed(() => {
  const stages = ['草稿', '已确认', '生产中', '已发货', '已完成']
  const total = activeOrders.value.length || 1
  return stages.map((label) => {
    const count = activeOrders.value.filter((row) => row?.order_status === label).length
    return { label, count, rate: Math.max(count ? 8 : 0, Math.round((count / total) * 100)) }
  })
})

const receivableCustomers = computed(() => {
  return [...activeCustomers.value]
    .filter((row) => toAmount(row?.receivable_balance) > 0)
    .sort((a, b) => toAmount(b.receivable_balance) - toAmount(a.receivable_balance))
    .slice(0, 6)
})

const maxReceivable = computed(() => Math.max(...receivableCustomers.value.map((row) => toAmount(row.receivable_balance)), 0))
const receivableRate = (customer) => {
  if (!maxReceivable.value) return 0
  return Math.max(8, Math.round((toAmount(customer?.receivable_balance) / maxReceivable.value) * 100))
}

const ownerPerformance = computed(() => {
  const map = new Map()
  const ensure = (owner) => {
    const key = owner || '未设置'
    if (!map.has(key)) map.set(key, { owner: key, orderCount: 0, orderAmount: 0, opportunityCount: 0, opportunityAmount: 0 })
    return map.get(key)
  }
  activeOrders.value.forEach((row) => {
    const item = ensure(row.owner_name)
    item.orderCount += 1
    item.orderAmount += toAmount(row.total_amount)
  })
  activeOpportunities.value.forEach((row) => {
    const item = ensure(row.owner_name)
    item.opportunityCount += 1
    item.opportunityAmount += toAmount(row.expected_amount)
  })
  return Array.from(map.values())
    .sort((a, b) => (b.orderAmount + b.opportunityAmount * 0.4) - (a.orderAmount + a.opportunityAmount * 0.4))
    .slice(0, 6)
})

const ownerRanking = computed(() => {
  const max = Math.max(...ownerPerformance.value.map((row) => row.orderAmount), 0)
  return ownerPerformance.value.map((row, index) => ({
    ...row,
    rank: String(index + 1).padStart(2, '0'),
    rate: max ? Math.max(8, Math.round((row.orderAmount / max) * 100)) : 0
  }))
})

const riskItems = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const riskLimit = today.getTime() + 3 * 24 * 60 * 60 * 1000
  const delivery = activeOrders.value
    .filter((row) => row?.delivery_date && !['已完成', '已取消'].includes(row.order_status) && getDateTime(row.delivery_date) <= riskLimit)
    .slice(0, 3)
    .map((row) => ({
      key: `delivery-${row.id}`,
      appKey: 'orders',
      label: '交付',
      type: 'danger',
      title: row.order_no || '未编号订单',
      desc: `${row.customer_name || '-'}，交付 ${formatDate(row.delivery_date)}`
    }))
  const opportunity = activeOpportunities.value
    .filter((row) => row?.expected_close_date && !['赢单', '输单', '搁置'].includes(row.stage) && getDateTime(row.expected_close_date) <= riskLimit)
    .slice(0, 3)
    .map((row) => ({
      key: `opportunity-${row.id}`,
      appKey: 'opportunities',
      label: '商机',
      type: getDateTime(row.expected_close_date) < today.getTime() ? 'danger' : 'warning',
      title: row.opportunity_name || row.opportunity_no,
      desc: `${row.stage || '-'}，预计成交 ${formatDate(row.expected_close_date)}`
    }))
  const receivable = receivableCustomers.value.slice(0, 3).map((row) => ({
    key: `receivable-${row.id}`,
    appKey: 'customers',
    label: '应收',
    type: 'warning',
    title: row.name || row.customer_no,
    desc: `应收 ${formatCurrency(row.receivable_balance)}，负责人 ${row.owner_name || '-'}`
  }))
  return [...delivery, ...opportunity, ...receivable].slice(0, 8)
})

const actionItems = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const weekLimit = today.getTime() + 7 * 24 * 60 * 60 * 1000
  const followActions = activeFollowUps.value
    .filter((row) => row?.next_follow_at && !['已成交', '无效'].includes(row.follow_result) && getDateTime(row.next_follow_at) <= weekLimit)
    .slice(0, 4)
    .map((row) => ({
      key: `follow-${row.id}`,
      appKey: 'follow_ups',
      label: '跟进',
      title: row.customer_name || row.follow_no,
      desc: `${formatDate(row.next_follow_at)} ${row.follow_type || ''}，${row.owner_name || '-'}`
    }))
  const opportunityActions = activeOpportunities.value
    .filter((row) => row?.next_action && !['赢单', '输单', '搁置'].includes(row.stage))
    .slice(0, 4)
    .map((row) => ({
      key: `opp-${row.id}`,
      appKey: 'opportunities',
      label: '商机',
      title: row.opportunity_name || row.opportunity_no,
      desc: `${row.stage || '-'}，${row.next_action}`
    }))
  return [...opportunityActions, ...followActions].slice(0, 8)
})

const salesEvents = computed(() => {
  const events = []
  activeOrders.value.forEach((row) => {
    events.push({
      key: `order-${row.id || row.order_no}`,
      appKey: 'orders',
      type: '订单',
      tone: 'order',
      date: row.order_date,
      time: formatTime(row.order_date),
      title: row.customer_name || row.order_no,
      amount: formatCurrency(row.total_amount)
    })
  })
  activePayments.value.forEach((row) => {
    events.push({
      key: `payment-${row.id || row.payment_no}`,
      appKey: 'payments',
      type: '回款',
      tone: 'payment',
      date: row.payment_date,
      time: formatTime(row.payment_date),
      title: row.customer_name || row.payment_no,
      amount: formatCurrency(row.amount)
    })
  })
  activeFollowUps.value.forEach((row) => {
    events.push({
      key: `follow-${row.id || row.follow_no}`,
      appKey: 'follow_ups',
      type: '跟进',
      tone: 'follow',
      date: row.follow_date,
      time: formatTime(row.follow_date),
      title: row.customer_name || row.follow_no,
      amount: row.follow_result || '-'
    })
  })
  return events
    .sort((a, b) => getDateTime(b.date) - getDateTime(a.date))
    .slice(0, 12)
})

const buildCockpitContext = () => ({
  app: 'sales',
  view: 'sales_cockpit',
  viewId: 'sales_cockpit',
  profile: 'public',
  aiScene: 'sales_cockpit',
  allowImport: false,
  allowFormula: false,
  dataStats: stats.value,
  cockpit: {
    kpis: kpiCards.value,
    funnel: opportunityFunnel.value,
    ownerPerformance: ownerPerformance.value,
    receivableCustomers: receivableCustomers.value.map((row) => ({
      customerNo: row.customer_no,
      customerName: row.name,
      ownerName: row.owner_name,
      receivableBalance: toAmount(row.receivable_balance),
      creditLimit: toAmount(row.credit_limit)
    })),
    risks: riskItems.value,
    actions: actionItems.value,
    events: salesEvents.value
  },
  moduleTips: [
    '销售驾驶舱用于面向管理层查看销售经营指标。',
    '商机管道和加权预测用于评估后续销售增长。',
    '风险预警聚合交付、商机逾期和应收问题。'
  ]
})

const syncCockpitContext = () => {
  pushAiContext(buildCockpitContext())
}

const loadCockpitData = async () => {
  loading.value = true
  try {
    const [customerRows, orderRows, opportunityRows, paymentRows, followRows] = await Promise.all([
      request({ url: '/sales_customers?select=*&status=neq.deleted&order=created_at.desc&limit=500', method: 'get' }),
      request({ url: '/sales_orders?select=*&status=neq.deleted&order_status=neq.%E5%B7%B2%E5%8F%96%E6%B6%88&order=order_date.desc&limit=500', method: 'get' }),
      request({ url: '/sales_opportunities?select=*&status=neq.deleted&order=expected_close_date.asc&limit=500', method: 'get' }),
      request({ url: '/sales_payments?select=*&status=neq.deleted&order=payment_date.desc&limit=500', method: 'get' }),
      request({ url: '/sales_follow_ups?select=*&status=neq.deleted&order=follow_date.desc&limit=500', method: 'get' })
    ])
    customers.value = toRows(customerRows)
    orders.value = toRows(orderRows)
    opportunities.value = toRows(opportunityRows)
    payments.value = toRows(paymentRows)
    followUps.value = toRows(followRows)
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
}

const toggleFullscreen = () => {
  const target = screenRef.value || document.documentElement
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
}

onMounted(() => {
  updateClock()
  clockTimer = setInterval(updateClock, 1000)
  document.addEventListener('fullscreenchange', handleFullscreenChange)
  syncCockpitContext()
  loadCockpitData()
  refreshTimer = setInterval(loadCockpitData, 60000)
})

onBeforeUnmount(() => {
  if (clockTimer) clearInterval(clockTimer)
  if (refreshTimer) clearInterval(refreshTimer)
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
  position: relative;
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  color: var(--text1);
  background: var(--bg);
  font-family: "DIN Alternate", "Helvetica Neue", "PingFang SC", sans-serif;
}

.sales-cockpit.fullscreen {
  position: fixed;
  inset: 0;
  z-index: 9999;
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

.screen-shell {
  position: relative;
  z-index: 2;
  width: min(100vw, calc(100vh * 16 / 9));
  height: min(100vh, calc(100vw * 9 / 16));
  aspect-ratio: 16 / 9;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background:
    linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(2, 6, 23, 0.96)),
    radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.13), transparent 55%);
  box-shadow: 0 0 44px rgba(14, 165, 233, 0.18);
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
  width: 23%;
  flex-shrink: 0;
}

.col-center {
  flex: 1;
  min-width: 0;
}

.col-right {
  width: 28%;
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
  display: flex;
  flex-direction: column;
  gap: 5px;
  overflow: hidden;
  padding: 7px;
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
  white-space: nowrap;
}

.rank-row strong,
.alert-row strong,
.action-row strong {
  display: block;
  color: var(--text1);
  font-size: 12px;
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
}

.rank-row i {
  margin-top: 5px;
  background: linear-gradient(90deg, var(--c-accent), var(--c-primary));
}

.rank-row em {
  max-width: 76px;
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
  max-width: 86px;
  flex-shrink: 0;
  color: var(--c-red);
  font-size: 12px;
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
</style>
