<template>
  <div class="sales-apps">
    <div class="apps-header">
      <div class="header-text">
        <h2>销售应用</h2>
        <p>选择一个应用进入管理</p>
      </div>
    </div>

    <el-row :gutter="20">
      <el-col
        v-for="app in visibleApps"
        :key="app.key"
        :xs="24"
        :sm="12"
        :md="8"
        :lg="6"
      >
        <router-link :to="app.route" custom v-slot="{ href, navigate }">
          <a
            class="app-card-link"
            :href="href"
            @click="handleNavigate($event, navigate, app)"
          >
            <el-card class="app-card" shadow="hover">
              <div class="app-card-body">
                <div class="app-icon" :class="`tone-${app.tone}`">
                  <el-icon size="20">
                    <component :is="iconMap[app.icon]" />
                  </el-icon>
                </div>
                <div class="app-info">
                  <div class="app-name">{{ app.name }}</div>
                  <div class="app-desc">{{ app.desc }}</div>
                </div>
              </div>
              <div class="app-enter">进入</div>
            </el-card>
          </a>
        </router-link>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, nextTick, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ChatLineSquare, DataAnalysis, DataBoard, Money, Tickets, TrendCharts, User } from '@element-plus/icons-vue'
import { SALES_APPS } from '@/utils/sales-apps'
import { hasPerm } from '@/utils/permission'
import { pushAiContext } from '@/utils/ai-context'

const router = useRouter()
const iconMap = { ChatLineSquare, DataAnalysis, DataBoard, Money, Tickets, TrendCharts, User }

const visibleApps = computed(() => {
  return SALES_APPS.filter((app) => !app.perm || hasPerm(app.perm))
})

const buildSalesAppsContext = () => {
  const apps = visibleApps.value.map((app) => ({
    key: app.key,
    name: app.name,
    desc: app.desc,
    route: `/sales${app.route}`,
    viewId: app.viewId || app.key,
    apiUrl: app.apiUrl || '',
    columns: (app.staticColumns || []).map((col) => ({
      label: col.label,
      prop: col.prop,
      type: col.type || 'text',
      options: col.options || []
    }))
  }))

  return {
    app: 'sales',
    view: 'sales_apps',
    viewId: 'sales_apps',
    profile: 'public',
    aiScene: 'sales_apps',
    allowImport: false,
    allowFormula: false,
    apps,
    dataStats: {
      totalCount: apps.length,
      appNames: apps.map((app) => app.name)
    },
    moduleTips: [
      '销售驾驶舱用于查看经营指标、销售漏斗、回款进度和风险预警。',
      '客户档案用于维护客户基础资料、信用额度、应收余额和销售负责人。',
      '客户跟进用于维护客户沟通纪要、跟进结果和下次行动计划。',
      '销售商机用于维护客户需求、预计金额、销售阶段和成交概率。',
      '销售订单用于维护订单明细、交付计划、订单状态和销售金额。',
      '回款记录用于维护回款金额、到账日期、核销状态和经办人。'
    ]
  }
}

const syncSalesAppsContext = () => {
  pushAiContext(buildSalesAppsContext())
}

const openApp = async (app) => {
  if (!app?.route) return
  await router.push(app.route)
}

const handleNavigate = async (event, navigate, app) => {
  if (!app?.route) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  if (typeof navigate === 'function') {
    navigate(event)
  } else {
    await openApp(app)
  }
  await nextTick()
  if (router.currentRoute.value.path !== app.route) {
    await router.push(app.route)
  }
}

onMounted(syncSalesAppsContext)
watch(visibleApps, syncSalesAppsContext)
</script>

<style scoped>
.sales-apps {
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
  font-size: 20px;
  font-weight: 700;
  color: #303133;
}

.header-text p {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

.app-card-link {
  display: block;
  color: inherit;
  text-decoration: none;
}

.app-card {
  margin-bottom: 20px;
  cursor: pointer;
  border-radius: 8px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.app-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(64, 158, 255, 0.15);
}

.app-card-body {
  display: flex;
  align-items: center;
  gap: 12px;
}

.app-icon {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.tone-blue { background: #409eff; }
.tone-cyan { background: #14b8a6; }
.tone-green { background: #67c23a; }
.tone-indigo { background: #6366f1; }
.tone-orange { background: #e6a23c; }
.tone-purple { background: #8b5cf6; }
.tone-dark { background: #111827; }

.app-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.app-name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.app-desc {
  font-size: 12px;
  color: #909399;
}

.app-enter {
  margin-top: 14px;
  font-size: 12px;
  color: #409eff;
}

:global(#app.dark) .sales-apps {
  background-color: #0b0f14;
}

:global(#app.dark) .header-text h2,
:global(#app.dark) .app-name {
  color: #f3f4f6;
}

:global(#app.dark) .header-text p,
:global(#app.dark) .app-desc,
:global(#app.dark) .app-enter {
  color: #cbd5e1;
}

:global(#app.dark) .app-card {
  background-color: #111827;
  border-color: #1f2937;
}

@media (max-width: 760px) {
  .sales-apps {
    padding: 14px;
  }

  .apps-header {
    align-items: stretch;
    flex-direction: column;
    gap: 12px;
  }
}
</style>
