<template>
  <div class="decision-apps" data-guide="app-list-page">
    <div class="apps-header" data-guide="app-list-header">
      <div class="header-text">
        <h2>决策支持</h2>
        <p>选择一个驾驶舱进入跨模块经营态势分析</p>
      </div>
    </div>

    <el-row :gutter="20">
      <el-col
        v-for="card in dashboardCards"
        :key="card.key"
        :xs="24"
        :sm="12"
        :md="12"
        :lg="8"
        :xl="8"
      >
        <el-card
          class="app-card"
          data-guide="app-card"
          :data-guide-key="card.key"
          :class="[`attention-${card.card.attentionLevel || 'normal'}`, { disabled: card.disabled }]"
          shadow="hover"
          @click="openDashboard(card)"
        >
          <div class="app-card-body">
            <div class="app-icon" :class="`tone-${card.tone}`">
              <el-icon size="20">
                <component :is="iconMap[card.icon]" />
              </el-icon>
            </div>
            <div class="app-info">
              <div class="app-title-line">
                <div class="app-name">{{ card.title }}</div>
                <span class="app-status" data-guide="app-card-status" :class="`status-${card.card.status}`">{{ card.card.statusText }}</span>
              </div>
              <div class="app-desc">{{ card.desc }}</div>
            </div>
          </div>
          <div class="app-metrics" data-guide="app-card-metrics">
            <div v-for="metric in card.card.metrics" :key="metric.label" class="metric-item">
              <span>{{ metric.label }}</span>
              <strong>{{ metric.value }}</strong>
            </div>
          </div>
          <div class="app-card-footer" data-guide="app-card-enter">
            <span class="app-tag">{{ card.card.brief }}</span>
            <span class="app-enter">进入</span>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, onMounted } from 'vue'
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper'
import {
  Box,
  CircleCheck,
  Monitor,
  ShoppingCart,
  Tools,
  TrendCharts
} from '@element-plus/icons-vue'
import { pushAiContext } from '@/utils/ai-context'
import { cardFromScore, sortByAttention } from '@shared/app-card-attention'

const iconMap = {
  Box,
  CircleCheck,
  Monitor,
  ShoppingCart,
  Tools,
  TrendCharts
}

const baseDashboardCards = [
  {
    key: 'inventory',
    group: 'supply',
    title: '库存大屏',
    icon: 'Box',
    badge: 'MMS / WMS',
    desc: '查看仓库、库位、批次库存和近期出入库动态。',
    route: '/materials/inventory-dashboard',
    status: 'online',
    statusText: '已接入',
    tone: 'cyan',
    scenarios: ['实时库存', '批次流转', '库位热力']
  },
  {
    key: 'sales',
    group: 'business',
    title: '销售驾驶舱',
    icon: 'TrendCharts',
    badge: 'SALES',
    desc: '聚合经营指标、销售漏斗、回款进度和风险预警。',
    route: '/sales/cockpit',
    status: 'online',
    statusText: '已接入',
    tone: 'blue',
    scenarios: ['销售漏斗', '应收风险', '本周行动']
  },
  {
    key: 'purchase',
    group: 'supply',
    title: '采购驾驶舱',
    icon: 'ShoppingCart',
    badge: 'PURCHASE',
    desc: '监控采购需求、订单履约、到货节奏和交付风险。',
    route: '/purchase/dashboard',
    status: 'online',
    statusText: '已接入',
    tone: 'indigo',
    scenarios: ['供应商风险', '到货跟踪', '采购金额']
  },
  {
    key: 'production',
    group: 'manufacturing',
    title: '生产总览',
    icon: 'Tools',
    badge: 'MFG',
    desc: '查看生产建议、工单进度、齐套检查和缺料风险。',
    route: '/production/overview',
    status: 'online',
    statusText: '已接入',
    tone: 'orange',
    scenarios: ['生产建议', '工单进度', '缺料风险']
  },
  {
    key: 'quality',
    group: 'risk',
    title: '质量总览',
    icon: 'CircleCheck',
    badge: 'QUALITY',
    desc: '汇总检验、异常、整改、审核和质量标准。',
    route: '/quality/dashboard',
    status: 'online',
    statusText: '已接入',
    tone: 'green',
    scenarios: ['合格率', 'NCR', '整改闭环']
  },
  {
    key: 'equipment',
    group: 'risk',
    title: '设备总览',
    icon: 'Monitor',
    badge: 'EAM',
    desc: '查看设备台账、点检异常、维保工单和保养计划。',
    route: '/equipment/dashboard',
    status: 'online',
    statusText: '已接入',
    tone: 'slate',
    scenarios: ['健康评分', '设备异常', '维保计划']
  }
]

const dashboardCards = computed(() => baseDashboardCards
  .map((card) => {
    const scoreMap = {
      production: 72,
      quality: 70,
      equipment: 68,
      inventory: 60,
      purchase: 54,
      sales: 50
    }
    return {
      ...card,
      card: cardFromScore({
        score: scoreMap[card.key] || 30,
        metrics: [
          { label: '状态', value: card.statusText || '已接入' },
          { label: '场景数', value: `${card.scenarios?.length || 0}` }
        ],
        brief: (card.scenarios || []).slice(0, 2).join(' / ') || card.badge
      })
    }
  })
  .sort(sortByAttention))

const isRunningInQiankun = () => {
  if (typeof window === 'undefined') return false
  return Boolean(
    qiankunWindow.__POWERED_BY_QIANKUN__ ||
    window.__POWERED_BY_QIANKUN__ ||
    window.proxy?.__POWERED_BY_QIANKUN__ ||
    window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__
  )
}

const openHostTab = (card) => {
  if (!card?.route || card.disabled) return
  const detail = {
    path: card.route,
    openInNewTab: true,
    tabKey: card.route,
    tabTitle: card.title
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('eis:open-host-tab', { detail }))
    const payload = { type: 'eis:open-host-tab', detail }
    try {
      window.postMessage(payload, window.location.origin)
    } catch (e) {}
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(payload, window.location.origin)
      }
    } catch (e) {}
    if (!isRunningInQiankun()) {
      window.location.href = card.route
    }
  }
}

const openDashboard = (card) => {
  openHostTab(card)
}

const syncAiContext = () => {
  pushAiContext({
    app: 'decision',
    view: 'decision_home',
    viewId: 'decision_home',
    profile: 'public',
    aiScene: 'decision_support',
    allowImport: false,
    allowFormula: false,
    dashboards: dashboardCards.value.map((card) => ({
      key: card.key,
      title: card.title,
      route: card.route,
      group: card.group,
      scenarios: card.scenarios
    })),
    moduleTips: [
      '决策支持模块集中承载各业务域大屏和驾驶舱入口。',
      '入口卡片与其他模块应用卡片保持一致，具体驾驶舱页面继续保持 16:9 自适应展示。',
      '点击卡片进入对应业务模块原始驾驶舱深链，避免重复加载多个大屏。'
    ]
  })
}

onMounted(syncAiContext)
</script>

<style scoped>
.decision-apps {
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
  color: #303133;
  font-size: 20px;
  font-weight: 700;
}

.header-text p {
  margin: 0;
  color: #909399;
  font-size: 12px;
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

.app-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(64, 158, 255, 0.15);
}

.app-card.disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.app-card :deep(.el-card__body) {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
  padding: 14px;
}

.app-card-body {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-height: 48px;
}

.app-icon {
  flex-shrink: 0;
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #fff;
}

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
  color: #303133;
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-desc {
  display: -webkit-box;
  overflow: hidden;
  color: #909399;
  font-size: 12px;
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

.app-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: auto;
  padding-top: 10px;
}

.app-tag {
  min-width: 0;
  overflow: hidden;
  color: #909399;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-enter {
  flex-shrink: 0;
  color: #409eff;
  font-size: 12px;
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

.tone-blue { background: #409eff; }
.tone-cyan { background: #14b8a6; }
.tone-green { background: #67c23a; }
.tone-indigo { background: #6366f1; }
.tone-orange { background: #e6a23c; }
.tone-slate { background: #475569; }

:global(#app.dark) .decision-apps {
  background-color: #0b0f14;
}

:global(#app.dark) .header-text h2,
:global(#app.dark) .app-name {
  color: #f3f4f6;
}

:global(#app.dark) .header-text p,
:global(#app.dark) .app-desc,
:global(#app.dark) .app-tag {
  color: #9ca3af;
}

:global(#app.dark) .app-card {
  background: #111827;
  border-color: #1f2937;
}

:global(#app.dark) .metric-item {
  background: #0f172a;
}

:global(#app.dark) .metric-item strong,
:global(#app.dark) .app-tag {
  color: #f3f4f6;
}

:global(#app.dark) .metric-item span {
  color: #9ca3af;
}
</style>
