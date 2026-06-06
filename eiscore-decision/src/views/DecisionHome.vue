<template>
  <div class="decision-apps">
    <div class="apps-header">
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
        :md="8"
        :lg="6"
      >
        <el-card
          class="app-card"
          :class="{ disabled: card.disabled }"
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
              <div class="app-name">{{ card.title }}</div>
              <div class="app-desc">{{ card.desc }}</div>
            </div>
          </div>
          <div class="app-card-footer">
            <span class="app-tag">{{ card.badge }}</span>
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

import { onMounted } from 'vue'
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

const iconMap = {
  Box,
  CircleCheck,
  Monitor,
  ShoppingCart,
  Tools,
  TrendCharts
}

const dashboardCards = [
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
    dashboards: dashboardCards.map((card) => ({
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
  width: 100%;
  min-height: 136px;
  margin-bottom: 20px;
  cursor: pointer;
  border-radius: 10px;
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
  flex-direction: column;
  min-height: 104px;
}

.app-card-body {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
}

.app-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  color: #fff;
}

.app-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.app-name {
  color: #303133;
  font-size: 15px;
  font-weight: 600;
}

.app-desc {
  color: #909399;
  font-size: 12px;
  line-height: 1.4;
}

.app-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
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
</style>
