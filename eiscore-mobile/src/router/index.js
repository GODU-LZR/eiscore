// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createRouter, createWebHistory } from 'vue-router'
import { clearAuth, getToken, parseJwt, redirectToEnterpriseLogin } from '@/utils/auth'

const router = createRouter({
  history: createWebHistory('/mobile/'),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false, title: '伦度机电' }
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { requiresAuth: true, title: '工作台' }
    },
    {
      path: '/pda',
      name: 'PdaEntry',
      component: () => import('@/views/pda/PdaEntry.vue'),
      meta: { requiresAuth: true, title: 'PDA盘点' }
    },
    // 盘点模块
    {
      path: '/check',
      name: 'CheckOverview',
      component: () => import('@/views/check/CheckOverview.vue'),
      meta: { requiresAuth: true, title: '库存盘点' }
    },
    {
      path: '/check/warehouse/:code',
      name: 'CheckWarehouse',
      component: () => import('@/views/check/CheckWarehouse.vue'),
      meta: { requiresAuth: true, title: '仓库详情' },
      props: true
    },
    {
      path: '/check/location/:code',
      name: 'CheckLocation',
      component: () => import('@/views/check/CheckLocation.vue'),
      meta: { requiresAuth: true, title: '库位盘点' },
      props: true
    },
    {
      path: '/check/material/:id',
      name: 'CheckMaterial',
      component: () => import('@/views/check/CheckMaterial.vue'),
      meta: { requiresAuth: true, title: '物料详情' },
      props: true
    },
    // 仓库查询模块
    {
      path: '/warehouse',
      name: 'WarehouseQuery',
      component: () => import('@/views/warehouse/WarehouseQuery.vue'),
      meta: { requiresAuth: true, title: '仓库查询' }
    },
    // 数据报表模块
    {
      path: '/report',
      name: 'DataReport',
      component: () => import('@/views/report/DataReport.vue'),
      meta: { requiresAuth: true, title: '数据报表' }
    },
    // 扫码出入库模块
    {
      path: '/stock',
      name: 'StockScan',
      component: () => import('@/views/stock/StockScan.vue'),
      meta: { requiresAuth: true, title: '扫码出入库' }
    },
    // 仓储助手模块
    {
      path: '/assistant',
      name: 'WarehouseAssistant',
      component: () => import('@/views/assistant/WarehouseAssistant.vue'),
      meta: { requiresAuth: true, title: '仓储助手' }
    },
    // 智能 BI 模块
    {
      path: '/enterprise',
      name: 'EnterpriseAssistant',
      component: () => import('@/views/assistant/EnterpriseAssistant.vue'),
      meta: { requiresAuth: true, title: '智能 BI' }
    },
    // 考勤模块
    {
      path: '/attendance',
      name: 'AttendanceOverview',
      component: () => import('@/views/attendance/AttendanceOverview.vue'),
      meta: { requiresAuth: true, title: '考勤中心' }
    },
    {
      path: '/attendance/detail/:id',
      name: 'AttendanceDetail',
      component: () => import('@/views/attendance/AttendanceDetail.vue'),
      meta: { requiresAuth: true, title: '考勤详情' },
      props: true
    },
    // 标签打印模块
    {
      path: '/printing',
      name: 'PrintingIndex',
      component: () => import('@/views/printing/PrintingIndex.vue'),
      meta: { requiresAuth: true, title: '标签打印' }
    },
    {
      path: '/printing/label',
      name: 'PrintingLabel',
      component: () => import('@/views/printing/PrintingLabel.vue'),
      meta: { requiresAuth: false, title: '标签预览' }
    },
    {
      // 未匹配路由 → 首页
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

// 路由守卫：校验鉴权
router.beforeEach((to, _from, next) => {
  // 动态标题
  if (to.meta.title) {
    document.title = `${to.meta.title} - 企业移动端`
  }

  if (to.name === 'login') {
    redirectToEnterpriseLogin(to.query.redirect || '/mobile/')
    next(false)
    return
  }

  if (to.meta.requiresAuth === false) {
    next()
    return
  }

  const token = getToken()
  if (!token) {
    redirectToEnterpriseLogin(`/mobile${to.fullPath}`)
    next(false)
    return
  }

  // 保持旧路由兼容：仅在 JWT 明确携带且达到 exp 时拒绝。
  const payload = parseJwt(token)
  if (payload && payload.exp && Date.now() / 1000 >= payload.exp) {
    clearAuth()
    redirectToEnterpriseLogin(`/mobile${to.fullPath}`)
    next(false)
    return
  }

  next()
})

export default router
