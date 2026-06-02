<template>
  <div class="sales-dashboard">
    <div class="dashboard-header">
      <div class="header-text">
        <h2>销售看板</h2>
        <p>销售指标、风险事项、订单回款概览</p>
      </div>
      <div class="header-actions">
        <el-button plain icon="Back" @click="goApps">返回应用列表</el-button>
        <el-button plain icon="Refresh" :loading="overviewLoading" @click="loadSalesOverview">
          刷新
        </el-button>
      </div>
    </div>

    <div class="overview-strip" v-loading="overviewLoading">
      <div v-for="stat in kpiCards" :key="stat.key" class="stat-tile" :class="`stat-${stat.tone}`">
        <div class="stat-label">{{ stat.label }}</div>
        <div class="stat-value">{{ stat.value }}</div>
        <div class="stat-sub">{{ stat.sub }}</div>
      </div>
    </div>

    <div class="overview-grid">
      <section class="overview-panel">
        <div class="section-head">
          <h3>订单状态</h3>
          <span>{{ overviewStats.orderCount }} 笔</span>
        </div>
        <div class="breakdown-list">
          <div v-for="item in orderStatusBreakdown" :key="item.label" class="breakdown-row">
            <div class="breakdown-top">
              <span>{{ item.label }}</span>
              <strong>{{ item.count }}</strong>
            </div>
            <div class="breakdown-bar">
              <i :style="{ width: `${item.rate}%` }"></i>
            </div>
          </div>
          <el-empty v-if="!orderStatusBreakdown.length" description="暂无订单" :image-size="60" />
        </div>
      </section>

      <section class="overview-panel">
        <div class="section-head">
          <h3>客户等级</h3>
          <span>{{ overviewStats.customerCount }} 家</span>
        </div>
        <div class="breakdown-list">
          <div v-for="item in customerLevelBreakdown" :key="item.label" class="breakdown-row">
            <div class="breakdown-top">
              <span>{{ item.label }}</span>
              <strong>{{ item.count }}</strong>
            </div>
            <div class="breakdown-bar customer">
              <i :style="{ width: `${item.rate}%` }"></i>
            </div>
          </div>
          <el-empty v-if="!customerLevelBreakdown.length" description="暂无客户" :image-size="60" />
        </div>
      </section>

      <section class="overview-panel">
        <div class="section-head">
          <h3>回款核销</h3>
          <span>{{ overviewStats.paymentCount }} 笔</span>
        </div>
        <div class="breakdown-list">
          <div v-for="item in paymentVerifyBreakdown" :key="item.label" class="breakdown-row">
            <div class="breakdown-top">
              <span>{{ item.label }}</span>
              <strong>{{ item.count }}</strong>
            </div>
            <div class="breakdown-bar payment">
              <i :style="{ width: `${item.rate}%` }"></i>
            </div>
          </div>
          <el-empty v-if="!paymentVerifyBreakdown.length" description="暂无回款" :image-size="60" />
        </div>
      </section>

      <section class="overview-panel">
        <div class="section-head">
          <h3>跟进结果</h3>
          <span>{{ overviewStats.followCount }} 条</span>
        </div>
        <div class="breakdown-list">
          <div v-for="item in followResultBreakdown" :key="item.label" class="breakdown-row">
            <div class="breakdown-top">
              <span>{{ item.label }}</span>
              <strong>{{ item.count }}</strong>
            </div>
            <div class="breakdown-bar follow">
              <i :style="{ width: `${item.rate}%` }"></i>
            </div>
          </div>
          <el-empty v-if="!followResultBreakdown.length" description="暂无跟进" :image-size="60" />
        </div>
      </section>

      <section class="overview-panel">
        <div class="section-head">
          <h3>商机阶段</h3>
          <span>{{ overviewStats.opportunityCount }} 个</span>
        </div>
        <div class="breakdown-list">
          <div v-for="item in opportunityStageBreakdown" :key="item.label" class="breakdown-row">
            <div class="breakdown-top">
              <span>{{ item.label }}</span>
              <strong>{{ item.count }}</strong>
            </div>
            <div class="breakdown-bar opportunity">
              <i :style="{ width: `${item.rate}%` }"></i>
            </div>
          </div>
          <el-empty v-if="!opportunityStageBreakdown.length" description="暂无商机" :image-size="60" />
        </div>
      </section>
    </div>

    <div class="recent-grid">
      <section class="overview-panel">
        <div class="section-head">
          <h3>最近订单</h3>
          <el-button type="primary" link @click="openAppByKey('orders')">查看全部</el-button>
        </div>
        <div class="recent-list">
          <div v-for="order in recentOrders" :key="order.id || order.order_no" class="recent-item">
            <div class="recent-main">
              <span class="recent-code">{{ order.order_no }}</span>
              <el-tag size="small" effect="plain">{{ order.order_status || '-' }}</el-tag>
            </div>
            <div class="recent-name">{{ order.customer_name }}</div>
            <div class="recent-meta">
              <span>{{ formatDate(order.order_date) }}</span>
              <span>{{ formatCurrency(order.total_amount) }}</span>
            </div>
          </div>
          <el-empty v-if="!recentOrders.length" description="暂无订单" :image-size="60" />
        </div>
      </section>

      <section class="overview-panel">
        <div class="section-head">
          <h3>最近回款</h3>
          <el-button type="primary" link @click="openAppByKey('payments')">查看全部</el-button>
        </div>
        <div class="recent-list">
          <div v-for="payment in recentPayments" :key="payment.id || payment.payment_no" class="recent-item">
            <div class="recent-main">
              <span class="recent-code">{{ payment.payment_no }}</span>
              <el-tag size="small" effect="plain" :type="payment.verify_status === '已核销' ? 'success' : 'warning'">
                {{ payment.verify_status || '-' }}
              </el-tag>
            </div>
            <div class="recent-name">{{ payment.customer_name }}</div>
            <div class="recent-meta">
              <span>{{ formatDate(payment.payment_date) }}</span>
              <span>{{ formatCurrency(payment.amount) }}</span>
            </div>
          </div>
          <el-empty v-if="!recentPayments.length" description="暂无回款" :image-size="60" />
        </div>
      </section>

      <section class="overview-panel">
        <div class="section-head">
          <h3>最近跟进</h3>
          <el-button type="primary" link @click="openAppByKey('follow_ups')">查看全部</el-button>
        </div>
        <div class="recent-list">
          <div v-for="follow in recentFollowUps" :key="follow.id || follow.follow_no" class="recent-item">
            <div class="recent-main">
              <span class="recent-code">{{ follow.follow_no }}</span>
              <el-tag size="small" effect="plain">{{ follow.follow_result || '-' }}</el-tag>
            </div>
            <div class="recent-name">{{ follow.customer_name }}</div>
            <div class="recent-meta">
              <span>{{ formatDate(follow.follow_date) }}</span>
              <span>{{ follow.follow_type || '-' }}</span>
            </div>
          </div>
          <el-empty v-if="!recentFollowUps.length" description="暂无跟进" :image-size="60" />
        </div>
      </section>

      <section class="overview-panel">
        <div class="section-head">
          <h3>重点商机</h3>
          <el-button type="primary" link @click="openAppByKey('opportunities')">查看全部</el-button>
        </div>
        <div class="recent-list">
          <div v-for="opportunity in topOpportunities" :key="opportunity.id || opportunity.opportunity_no" class="recent-item">
            <div class="recent-main">
              <span class="recent-code">{{ opportunity.opportunity_no }}</span>
              <el-tag size="small" effect="plain">{{ opportunity.stage || '-' }}</el-tag>
            </div>
            <div class="recent-name">{{ opportunity.opportunity_name }}</div>
            <div class="recent-meta">
              <span>{{ opportunity.customer_name }}</span>
              <span>{{ formatCurrency(opportunity.expected_amount) }}</span>
            </div>
          </div>
          <el-empty v-if="!topOpportunities.length" description="暂无商机" :image-size="60" />
        </div>
      </section>

      <section class="overview-panel">
        <div class="section-head">
          <h3>应收客户排行</h3>
          <el-button type="primary" link @click="openAppByKey('customers')">查看客户</el-button>
        </div>
        <div class="rank-list">
          <div v-for="customer in receivableCustomers" :key="customer.id || customer.customer_no" class="rank-item">
            <div class="rank-main">
              <span class="rank-name">{{ customer.name }}</span>
              <strong>{{ formatCurrency(customer.receivable_balance) }}</strong>
            </div>
            <div class="rank-meta">
              <span>{{ customer.level || '-' }}</span>
              <span>{{ customer.owner_name || '-' }}</span>
              <span>额度 {{ formatCurrency(customer.credit_limit) }}</span>
            </div>
          </div>
          <el-empty v-if="!receivableCustomers.length" description="暂无应收客户" :image-size="60" />
        </div>
      </section>
    </div>

    <section class="overview-panel action-panel">
      <div class="section-head">
        <h3>待处理事项</h3>
        <span>{{ actionItems.length }} 项</span>
      </div>
      <div class="action-list">
        <div v-for="item in actionItems" :key="item.key" class="action-item">
          <el-tag size="small" effect="plain" :type="item.type">{{ item.label }}</el-tag>
          <div class="action-content">
            <div class="action-title">{{ item.title }}</div>
            <div class="action-desc">{{ item.desc }}</div>
          </div>
          <el-button type="primary" link @click="openAppByKey(item.appKey)">处理</el-button>
        </div>
        <el-empty v-if="!actionItems.length" description="暂无待处理事项" :image-size="60" />
      </div>
    </section>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { SALES_APPS } from '@/utils/sales-apps'
import { hasPerm } from '@/utils/permission'
import { pushAiContext } from '@/utils/ai-context'
import request from '@/utils/request'

const router = useRouter()
const overviewLoading = ref(false)
const customers = ref([])
const orders = ref([])
const opportunities = ref([])
const payments = ref([])
const followUps = ref([])

const visibleApps = computed(() => SALES_APPS.filter((app) => !app.perm || hasPerm(app.perm)))

const toRows = (value) => (Array.isArray(value) ? value : [])

const toAmount = (value) => {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

const sumBy = (rows, prop) => rows.reduce((total, row) => total + toAmount(row?.[prop]), 0)

const getDateTime = (value) => {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isFinite(time) ? time : 0
}

const formatDate = (value) => {
  if (!value) return '-'
  return String(value).slice(0, 10)
}

const formatAmount = (value) => {
  const amount = toAmount(value)
  const abs = Math.abs(amount)
  if (abs >= 10000) {
    return `${(amount / 10000).toFixed(abs >= 1000000 ? 0 : 1)}万`
  }
  return amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

const formatCurrency = (value) => `¥${formatAmount(value)}`

const countBy = (rows, prop) => {
  return rows.reduce((acc, row) => {
    const label = row?.[prop] || '未设置'
    acc[label] = (acc[label] || 0) + 1
    return acc
  }, {})
}

const buildBreakdown = (rows, prop) => {
  const counts = countBy(rows, prop)
  const total = rows.length || 0
  return Object.entries(counts)
    .map(([label, count]) => ({
      label,
      count,
      rate: total ? Math.max(6, Math.round((count / total) * 100)) : 0
    }))
    .sort((a, b) => b.count - a.count)
}

const activeCustomers = computed(() => customers.value.filter((row) => row?.status !== 'deleted'))
const activeOrders = computed(() => orders.value.filter((row) => row?.status !== 'deleted' && row?.order_status !== '已取消'))
const activeOpportunities = computed(() => opportunities.value.filter((row) => row?.status !== 'deleted' && !['输单', '搁置'].includes(row?.stage)))
const activePayments = computed(() => payments.value.filter((row) => row?.status !== 'deleted'))
const activeFollowUps = computed(() => followUps.value.filter((row) => row?.status !== 'deleted'))

const overviewStats = computed(() => {
  const orderAmount = sumBy(activeOrders.value, 'total_amount')
  const opportunityAmount = sumBy(activeOpportunities.value, 'expected_amount')
  const opportunityWeightedAmount = activeOpportunities.value.reduce((sum, row) => {
    return sum + toAmount(row?.expected_amount) * toAmount(row?.probability) / 100
  }, 0)
  const paymentAmount = sumBy(activePayments.value, 'amount')
  const receivableFromCustomers = sumBy(activeCustomers.value, 'receivable_balance')
  const pendingVerifyCount = activePayments.value.filter((row) => row?.verify_status !== '已核销').length
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const riskLimit = today.getTime() + 3 * 24 * 60 * 60 * 1000
  const deliveryRiskCount = activeOrders.value.filter((row) => {
    if (!row?.delivery_date || ['已完成', '已取消'].includes(row.order_status)) return false
    return getDateTime(row.delivery_date) <= riskLimit
  }).length
  const pendingFollowCount = activeFollowUps.value.filter((row) => {
    if (!row?.next_follow_at || ['已成交', '无效'].includes(row.follow_result)) return false
    return getDateTime(row.next_follow_at) <= riskLimit
  }).length
  const overdueFollowCount = activeFollowUps.value.filter((row) => {
    if (!row?.next_follow_at || ['已成交', '无效'].includes(row.follow_result)) return false
    return getDateTime(row.next_follow_at) < today.getTime()
  }).length
  const overdueOpportunityCount = activeOpportunities.value.filter((row) => {
    if (!row?.expected_close_date || ['赢单', '输单', '搁置'].includes(row.stage)) return false
    return getDateTime(row.expected_close_date) < today.getTime()
  }).length

  return {
    customerCount: activeCustomers.value.length,
    strategicCustomerCount: activeCustomers.value.filter((row) => ['战略客户', '重点客户'].includes(row?.level)).length,
    orderCount: activeOrders.value.length,
    opportunityCount: activeOpportunities.value.length,
    paymentCount: activePayments.value.length,
    followCount: activeFollowUps.value.length,
    opportunityAmount,
    opportunityWeightedAmount,
    orderAmount,
    paymentAmount,
    receivableBalance: receivableFromCustomers || Math.max(orderAmount - paymentAmount, 0),
    paymentRate: orderAmount ? Math.round((paymentAmount / orderAmount) * 1000) / 10 : 0,
    pendingVerifyCount,
    deliveryRiskCount,
    pendingFollowCount,
    overdueFollowCount,
    overdueOpportunityCount
  }
})

const kpiCards = computed(() => [
  {
    key: 'customers',
    label: '客户数',
    value: `${overviewStats.value.customerCount}`,
    sub: `战略/重点 ${overviewStats.value.strategicCustomerCount} 家`,
    tone: 'blue'
  },
  {
    key: 'orders',
    label: '订单金额',
    value: formatCurrency(overviewStats.value.orderAmount),
    sub: `${overviewStats.value.orderCount} 笔有效订单`,
    tone: 'green'
  },
  {
    key: 'opportunities',
    label: '商机金额',
    value: formatCurrency(overviewStats.value.opportunityAmount),
    sub: `加权 ${formatCurrency(overviewStats.value.opportunityWeightedAmount)}`,
    tone: 'indigo'
  },
  {
    key: 'payments',
    label: '回款金额',
    value: formatCurrency(overviewStats.value.paymentAmount),
    sub: `回款率 ${overviewStats.value.paymentRate}%`,
    tone: 'orange'
  },
  {
    key: 'receivable',
    label: '应收余额',
    value: formatCurrency(overviewStats.value.receivableBalance),
    sub: `待核销 ${overviewStats.value.pendingVerifyCount} 笔`,
    tone: 'red'
  },
  {
    key: 'delivery',
    label: '交付风险',
    value: `${overviewStats.value.deliveryRiskCount}`,
    sub: '3天内到期或已到期',
    tone: 'purple'
  },
  {
    key: 'follow',
    label: '待跟进',
    value: `${overviewStats.value.pendingFollowCount}`,
    sub: `逾期 ${overviewStats.value.overdueFollowCount} 项`,
    tone: 'teal'
  }
])

const orderStatusBreakdown = computed(() => buildBreakdown(activeOrders.value, 'order_status'))
const customerLevelBreakdown = computed(() => buildBreakdown(activeCustomers.value, 'level'))
const opportunityStageBreakdown = computed(() => buildBreakdown(activeOpportunities.value, 'stage'))
const paymentVerifyBreakdown = computed(() => buildBreakdown(activePayments.value, 'verify_status'))
const followResultBreakdown = computed(() => buildBreakdown(activeFollowUps.value, 'follow_result'))

const recentOrders = computed(() => {
  return [...activeOrders.value]
    .sort((a, b) => getDateTime(b?.order_date || b?.created_at) - getDateTime(a?.order_date || a?.created_at))
    .slice(0, 5)
})

const recentPayments = computed(() => {
  return [...activePayments.value]
    .sort((a, b) => getDateTime(b?.payment_date || b?.created_at) - getDateTime(a?.payment_date || a?.created_at))
    .slice(0, 5)
})

const recentFollowUps = computed(() => {
  return [...activeFollowUps.value]
    .sort((a, b) => getDateTime(b?.follow_date || b?.created_at) - getDateTime(a?.follow_date || a?.created_at))
    .slice(0, 5)
})

const topOpportunities = computed(() => {
  return [...activeOpportunities.value]
    .sort((a, b) => {
      const weightedB = toAmount(b?.expected_amount) * toAmount(b?.probability) / 100
      const weightedA = toAmount(a?.expected_amount) * toAmount(a?.probability) / 100
      return weightedB - weightedA
    })
    .slice(0, 5)
})

const receivableCustomers = computed(() => {
  return [...activeCustomers.value]
    .filter((row) => toAmount(row?.receivable_balance) > 0)
    .sort((a, b) => toAmount(b.receivable_balance) - toAmount(a.receivable_balance))
    .slice(0, 5)
})

const statusBreakdowns = computed(() => ({
  orderStatus: orderStatusBreakdown.value,
  customerLevel: customerLevelBreakdown.value,
  opportunityStage: opportunityStageBreakdown.value,
  paymentVerifyStatus: paymentVerifyBreakdown.value,
  followResult: followResultBreakdown.value
}))

const actionItems = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const riskLimit = today.getTime() + 3 * 24 * 60 * 60 * 1000
  const deliveryRisks = activeOrders.value
    .filter((row) => {
      if (!row?.delivery_date || ['已完成', '已取消'].includes(row.order_status)) return false
      return getDateTime(row.delivery_date) <= riskLimit
    })
    .sort((a, b) => getDateTime(a.delivery_date) - getDateTime(b.delivery_date))
    .slice(0, 3)
    .map((row) => ({
      key: `delivery-${row.id || row.order_no}`,
      appKey: 'orders',
      type: 'danger',
      label: '交付',
      title: `${row.order_no || '未编号订单'} ${row.order_status || ''}`,
      desc: `${row.customer_name || '-'}，交付日期 ${formatDate(row.delivery_date)}，金额 ${formatCurrency(row.total_amount)}`
    }))

  const receivableRisks = activeCustomers.value
    .filter((row) => toAmount(row?.receivable_balance) > 0)
    .sort((a, b) => toAmount(b.receivable_balance) - toAmount(a.receivable_balance))
    .slice(0, 3)
    .map((row) => ({
      key: `receivable-${row.id || row.customer_no}`,
      appKey: 'customers',
      type: 'warning',
      label: '应收',
      title: row.name || row.customer_no || '未命名客户',
      desc: `余额 ${formatCurrency(row.receivable_balance)}，信用额度 ${formatCurrency(row.credit_limit)}，负责人 ${row.owner_name || '-'}`
    }))

  const verifyRisks = activePayments.value
    .filter((row) => row?.verify_status && row.verify_status !== '已核销')
    .sort((a, b) => getDateTime(b.payment_date) - getDateTime(a.payment_date))
    .slice(0, 3)
    .map((row) => ({
      key: `payment-${row.id || row.payment_no}`,
      appKey: 'payments',
      type: 'info',
      label: '核销',
      title: `${row.payment_no || '未编号回款'} ${row.verify_status}`,
      desc: `${row.customer_name || '-'}，到账 ${formatCurrency(row.amount)}，日期 ${formatDate(row.payment_date)}`
    }))

  const opportunityRisks = activeOpportunities.value
    .filter((row) => {
      if (!row?.expected_close_date || ['赢单', '输单', '搁置'].includes(row.stage)) return false
      return getDateTime(row.expected_close_date) <= riskLimit
    })
    .sort((a, b) => getDateTime(a.expected_close_date) - getDateTime(b.expected_close_date))
    .slice(0, 3)
    .map((row) => ({
      key: `opportunity-${row.id || row.opportunity_no}`,
      appKey: 'opportunities',
      type: getDateTime(row.expected_close_date) < today.getTime() ? 'danger' : 'warning',
      label: '商机',
      title: `${row.opportunity_no || '未编号商机'} ${row.stage || ''}`,
      desc: `${row.customer_name || '-'}，预计成交 ${formatDate(row.expected_close_date)}，金额 ${formatCurrency(row.expected_amount)}`
    }))

  const followRisks = activeFollowUps.value
    .filter((row) => {
      if (!row?.next_follow_at || ['已成交', '无效'].includes(row.follow_result)) return false
      return getDateTime(row.next_follow_at) <= riskLimit
    })
    .sort((a, b) => getDateTime(a.next_follow_at) - getDateTime(b.next_follow_at))
    .slice(0, 3)
    .map((row) => ({
      key: `follow-${row.id || row.follow_no}`,
      appKey: 'follow_ups',
      type: getDateTime(row.next_follow_at) < today.getTime() ? 'danger' : 'success',
      label: '跟进',
      title: `${row.customer_name || '未命名客户'} ${row.follow_result || ''}`,
      desc: `下次跟进 ${formatDate(row.next_follow_at)}，负责人 ${row.owner_name || '-'}，方式 ${row.follow_type || '-'}`
    }))

  return [...deliveryRisks, ...opportunityRisks, ...followRisks, ...receivableRisks, ...verifyRisks].slice(0, 10)
})

const loadSalesOverview = async () => {
  overviewLoading.value = true
  try {
    const [customerRows, orderRows, opportunityRows, paymentRows, followRows] = await Promise.all([
      request({ url: '/sales_customers?select=*&status=neq.deleted&order=created_at.desc&limit=200', method: 'get' }),
      request({ url: '/sales_orders?select=*&status=neq.deleted&order_status=neq.%E5%B7%B2%E5%8F%96%E6%B6%88&order=order_date.desc&limit=200', method: 'get' }),
      request({ url: '/sales_opportunities?select=*&status=neq.deleted&order=expected_close_date.asc&limit=200', method: 'get' }),
      request({ url: '/sales_payments?select=*&status=neq.deleted&order=payment_date.desc&limit=200', method: 'get' }),
      request({ url: '/sales_follow_ups?select=*&status=neq.deleted&order=follow_date.desc&limit=200', method: 'get' })
    ])
    customers.value = toRows(customerRows)
    orders.value = toRows(orderRows)
    opportunities.value = toRows(opportunityRows)
    payments.value = toRows(paymentRows)
    followUps.value = toRows(followRows)
  } catch (error) {
    console.warn('加载销售看板失败', error)
  } finally {
    overviewLoading.value = false
    syncSalesOverviewContext()
  }
}

const buildSalesOverviewContext = () => {
  const apps = visibleApps.value.map((app) => ({
    key: app.key,
    name: app.name,
    desc: app.desc,
    route: `/sales${app.route}`,
    viewId: app.viewId,
    apiUrl: app.apiUrl,
    columns: (app.staticColumns || []).map((col) => ({
      label: col.label,
      prop: col.prop,
      type: col.type || 'text',
      options: col.options || []
    }))
  }))

  return {
    app: 'sales',
    view: 'sales_dashboard',
    viewId: 'sales_dashboard',
    profile: 'public',
    aiScene: 'sales_dashboard',
    allowImport: false,
    allowFormula: false,
    apps,
    dataStats: {
      totalCount: apps.length,
      appNames: apps.map((app) => app.name),
      customerCount: overviewStats.value.customerCount,
      orderCount: overviewStats.value.orderCount,
      opportunityCount: overviewStats.value.opportunityCount,
      paymentCount: overviewStats.value.paymentCount,
      followCount: overviewStats.value.followCount,
      opportunityAmount: overviewStats.value.opportunityAmount,
      opportunityWeightedAmount: overviewStats.value.opportunityWeightedAmount,
      orderAmount: overviewStats.value.orderAmount,
      paymentAmount: overviewStats.value.paymentAmount,
      receivableBalance: overviewStats.value.receivableBalance,
      paymentRate: overviewStats.value.paymentRate,
      deliveryRiskCount: overviewStats.value.deliveryRiskCount,
      pendingFollowCount: overviewStats.value.pendingFollowCount,
      overdueFollowCount: overviewStats.value.overdueFollowCount,
      overdueOpportunityCount: overviewStats.value.overdueOpportunityCount
    },
    overview: {
      stats: overviewStats.value,
      breakdowns: statusBreakdowns.value,
      actionItems: actionItems.value.map((item) => ({
        category: item.label,
        title: item.title,
        desc: item.desc,
        appKey: item.appKey
      })),
      receivableCustomers: receivableCustomers.value.map((row) => ({
        customerNo: row.customer_no,
        customerName: row.name,
        level: row.level,
        ownerName: row.owner_name,
        creditLimit: toAmount(row.credit_limit),
        receivableBalance: toAmount(row.receivable_balance)
      })),
      recentOrders: recentOrders.value.map((row) => ({
        orderNo: row.order_no,
        customerName: row.customer_name,
        productName: row.product_name,
        orderStatus: row.order_status,
        orderDate: row.order_date,
        totalAmount: toAmount(row.total_amount)
      })),
      topOpportunities: topOpportunities.value.map((row) => ({
        opportunityNo: row.opportunity_no,
        opportunityName: row.opportunity_name,
        customerName: row.customer_name,
        stage: row.stage,
        probability: toAmount(row.probability),
        expectedAmount: toAmount(row.expected_amount),
        expectedCloseDate: row.expected_close_date,
        ownerName: row.owner_name
      })),
      recentPayments: recentPayments.value.map((row) => ({
        paymentNo: row.payment_no,
        orderNo: row.order_no,
        customerName: row.customer_name,
        verifyStatus: row.verify_status,
        paymentDate: row.payment_date,
        amount: toAmount(row.amount)
      })),
      recentFollowUps: recentFollowUps.value.map((row) => ({
        followNo: row.follow_no,
        customerName: row.customer_name,
        followType: row.follow_type,
        followResult: row.follow_result,
        followDate: row.follow_date,
        nextFollowAt: row.next_follow_at,
        ownerName: row.owner_name
      }))
    },
    moduleTips: [
      '客户档案用于维护客户基础资料、信用额度、应收余额和销售负责人。',
      '客户跟进用于维护客户沟通纪要、跟进结果和下次行动计划。',
      '销售商机用于维护客户需求、预计金额、销售阶段和成交概率。',
      '销售订单用于维护订单明细、交付计划、订单状态和销售金额。',
      '回款记录用于维护回款金额、到账日期、核销状态和经办人。'
    ]
  }
}

const syncSalesOverviewContext = () => {
  pushAiContext(buildSalesOverviewContext())
}

const openAppByKey = async (key) => {
  const app = visibleApps.value.find((item) => item.key === key)
  if (app) await router.push(app.route)
}

const goApps = () => {
  router.push('/apps')
}

onMounted(() => {
  syncSalesOverviewContext()
  loadSalesOverview()
})
watch([visibleApps, overviewStats, statusBreakdowns, actionItems, receivableCustomers, recentOrders, topOpportunities, recentPayments, recentFollowUps], syncSalesOverviewContext, { deep: true })
</script>

<style scoped>
.sales-dashboard {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 20px;
  background: #f5f7fa;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 16px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
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

.overview-strip {
  display: grid;
  grid-template-columns: repeat(6, minmax(140px, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.stat-tile {
  min-height: 108px;
  box-sizing: border-box;
  padding: 16px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fff;
}

.stat-label {
  font-size: 12px;
  color: #909399;
}

.stat-value {
  margin-top: 10px;
  font-size: 24px;
  line-height: 1.1;
  font-weight: 700;
  color: #303133;
}

.stat-sub {
  margin-top: 10px;
  font-size: 12px;
  color: #606266;
}

.stat-tile.stat-blue { border-top: 3px solid #409eff; }
.stat-tile.stat-green { border-top: 3px solid #67c23a; }
.stat-tile.stat-orange { border-top: 3px solid #e6a23c; }
.stat-tile.stat-red { border-top: 3px solid #f56c6c; }
.stat-tile.stat-purple { border-top: 3px solid #8b5cf6; }
.stat-tile.stat-teal { border-top: 3px solid #14b8a6; }
.stat-tile.stat-indigo { border-top: 3px solid #6366f1; }

.overview-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 14px;
}

.recent-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.action-panel {
  margin-bottom: 18px;
}

.overview-panel {
  min-width: 0;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  background: #fff;
  padding: 14px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.section-head h3 {
  margin: 0;
  font-size: 14px;
  line-height: 1.4;
  font-weight: 700;
  color: #303133;
}

.section-head span {
  font-size: 12px;
  color: #909399;
}

.breakdown-list,
.recent-list,
.rank-list,
.action-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.breakdown-row {
  min-height: 38px;
}

.breakdown-top {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
  font-size: 12px;
  color: #606266;
}

.breakdown-top strong {
  color: #303133;
}

.breakdown-bar {
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: #edf2f7;
}

.breakdown-bar i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #67c23a;
}

.breakdown-bar.customer i {
  background: #409eff;
}

.breakdown-bar.payment i {
  background: #e6a23c;
}

.breakdown-bar.follow i {
  background: #14b8a6;
}

.breakdown-bar.opportunity i {
  background: #6366f1;
}

.recent-item {
  padding-bottom: 10px;
  border-bottom: 1px solid #ebeef5;
}

.recent-item:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.recent-main,
.recent-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.recent-code {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 700;
  color: #303133;
}

.recent-name {
  margin-top: 6px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: #606266;
}

.recent-meta {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}

.rank-item {
  padding-bottom: 10px;
  border-bottom: 1px solid #ebeef5;
}

.rank-item:last-child {
  padding-bottom: 0;
  border-bottom: 0;
}

.rank-main,
.rank-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.rank-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 700;
  color: #303133;
}

.rank-main strong {
  font-size: 13px;
  color: #f56c6c;
}

.rank-meta {
  justify-content: flex-start;
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}

.action-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 10px 0;
  border-bottom: 1px solid #ebeef5;
}

.action-item:last-child {
  border-bottom: 0;
}

.action-content {
  min-width: 0;
}

.action-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 700;
  color: #303133;
}

.action-desc {
  margin-top: 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: #606266;
}

:global(#app.dark) .sales-dashboard {
  background-color: #0b0f14;
}

:global(#app.dark) .header-text h2,
:global(#app.dark) .section-head h3,
:global(#app.dark) .stat-value,
:global(#app.dark) .breakdown-top strong,
:global(#app.dark) .recent-code,
:global(#app.dark) .rank-name,
:global(#app.dark) .action-title {
  color: #f3f4f6;
}

:global(#app.dark) .header-text p,
:global(#app.dark) .section-head span,
:global(#app.dark) .stat-label,
:global(#app.dark) .stat-sub,
:global(#app.dark) .breakdown-top,
:global(#app.dark) .recent-name,
:global(#app.dark) .recent-meta,
:global(#app.dark) .rank-meta,
:global(#app.dark) .action-desc {
  color: #cbd5e1;
}

:global(#app.dark) .stat-tile,
:global(#app.dark) .overview-panel {
  background-color: #111827;
  border-color: #1f2937;
}

:global(#app.dark) .breakdown-bar {
  background: #1f2937;
}

:global(#app.dark) .recent-item,
:global(#app.dark) .rank-item,
:global(#app.dark) .action-item {
  border-bottom-color: #1f2937;
}

@media (max-width: 1180px) {
  .overview-strip {
    grid-template-columns: repeat(3, minmax(150px, 1fr));
  }

  .overview-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 760px) {
  .sales-dashboard {
    padding: 14px;
  }

  .dashboard-header {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }

  .header-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .overview-strip,
  .overview-grid,
  .recent-grid {
    grid-template-columns: 1fr;
  }

  .action-item {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .action-item .el-button {
    grid-column: 2;
    justify-self: flex-start;
  }
}
</style>
