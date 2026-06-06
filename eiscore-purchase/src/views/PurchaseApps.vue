<template>
  <div class="purchase-apps">
    <div class="apps-header">
      <div class="header-text">
        <h2>采购应用</h2>
        <p>选择一个应用进入管理</p>
      </div>
    </div>

    <el-row :gutter="20" class="apps-grid">
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
              <div class="app-card-footer">
                <span class="app-count">{{ getAppCountText(app) }}</span>
                <span class="app-enter">进入</span>
              </div>
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

import { computed, nextTick, onMounted, reactive, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Box, Memo, Monitor, OfficeBuilding, Tickets } from '@element-plus/icons-vue'
import { PURCHASE_APPS } from '@/utils/purchase-apps'
import { hasPerm } from '@/utils/permission'
import request from '@/utils/request'
import { pushAiContext } from '@/utils/ai-context'

const router = useRouter()
const iconMap = { Box, Memo, Monitor, OfficeBuilding, Tickets }
const appCounts = reactive({})
const loadingCounts = reactive({})

const visibleApps = computed(() => PURCHASE_APPS.filter((app) => app.key !== 'dashboard' && (!app.perm || hasPerm(app.perm))))

const moduleTips = [
  '供应商档案用于维护供应商等级、联系人、付款条件和交期。',
  '采购需求用于维护物料需求、需求日期、来源部门和建议供应商。',
  '采购订单用于维护下单数量、单价、金额、预计到货和执行状态。',
  '到货跟踪用于维护到货数量、IQC结果、入库单号和异常处理。'
]

const buildPurchaseOverviewContext = () => {
  const apps = visibleApps.value.map((app) => ({
    key: app.key,
    name: app.name,
    desc: app.desc,
    route: `/purchase${app.route}`,
    viewId: app.viewId,
    apiUrl: app.apiUrl,
    recordCount: appCounts[app.key] ?? null,
      columns: (app.staticColumns || []).map((col) => ({
      label: col.label,
      prop: col.prop,
      type: col.type || 'text',
      options: col.options || []
    }))
  }))

  return {
    app: 'purchase',
    view: 'purchase_apps',
    viewId: 'purchase_apps',
    profile: 'public',
    aiScene: 'purchase_overview',
    allowImport: false,
    allowFormula: false,
    apps,
    dataStats: {
      totalCount: apps.length,
      appNames: apps.map((app) => app.name),
      recordCounts: apps.reduce((acc, app) => {
        acc[app.key] = app.recordCount
        return acc
      }, {})
    },
    moduleTips
  }
}

const syncPurchaseOverviewContext = () => {
  pushAiContext(buildPurchaseOverviewContext())
}

const loadAppCounts = async () => {
  await Promise.all(visibleApps.value.map(async (app) => {
    loadingCounts[app.key] = true
    try {
      if (!app.apiUrl) {
        appCounts[app.key] = null
        return
      }
      const rows = await request({
        url: `${app.apiUrl}?select=id&status=neq.deleted&limit=1000`,
        method: 'get',
        headers: { 'Accept-Profile': 'public' }
      })
      appCounts[app.key] = Array.isArray(rows) ? rows.length : 0
    } catch (e) {
      appCounts[app.key] = null
    } finally {
      loadingCounts[app.key] = false
    }
  }))
  syncPurchaseOverviewContext()
}

const getAppCountText = (app) => {
  if (loadingCounts[app.key]) return '加载中'
  if (appCounts[app.key] === null || appCounts[app.key] === undefined) return '暂无统计'
  return `${appCounts[app.key]} 条记录`
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

onMounted(() => {
  syncPurchaseOverviewContext()
  loadAppCounts()
})

watch(visibleApps, () => {
  syncPurchaseOverviewContext()
  loadAppCounts()
})
</script>

<style scoped>
.purchase-apps {
  min-height: 100vh;
  box-sizing: border-box;
  padding: 20px;
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
  display: flex;
  color: inherit;
  text-decoration: none;
  height: 100%;
}

.app-card {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 136px;
  margin-bottom: 20px;
  cursor: pointer;
  border-radius: 10px;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.app-card :deep(.el-card__body) {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.app-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(64, 158, 255, 0.15);
}

.app-card-body {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
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
.tone-green { background: #67c23a; }
.tone-orange { background: #e6a23c; }
.tone-teal { background: #14b8a6; }
.tone-indigo { background: #6366f1; }

.app-info {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.app-name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.app-desc {
  display: -webkit-box;
  overflow: hidden;
  font-size: 12px;
  color: #909399;
  line-height: 18px;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.app-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: auto;
  padding-top: 14px;
}

.app-count,
.app-enter {
  font-size: 12px;
}

.app-count {
  color: #909399;
}

.app-enter {
  color: #409eff;
}

:global(#app.dark) .purchase-apps {
  background-color: #0b0f14;
}

:global(#app.dark) .header-text h2,
:global(#app.dark) .header-text p,
:global(#app.dark) .app-name,
:global(#app.dark) .app-desc,
:global(#app.dark) .app-enter {
  color: #f3f4f6;
}

:global(#app.dark) .app-card {
  background-color: #111827;
  border-color: #1f2937;
}
</style>
