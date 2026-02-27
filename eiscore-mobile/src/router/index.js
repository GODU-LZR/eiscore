import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory('/mobile/'),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false, title: '登录' }
    },
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
      meta: { requiresAuth: true, title: '工作台' }
    },
    {
      path: '/pda',
      redirect: '/check'
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
    // 企业经营助手模块
    {
      path: '/enterprise',
      name: 'EnterpriseAssistant',
      component: () => import('@/views/assistant/EnterpriseAssistant.vue'),
      meta: { requiresAuth: true, title: '经营助手' }
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

  if (to.meta.requiresAuth === false) {
    next()
    return
  }

  // 检查 token
  const raw = localStorage.getItem('auth_token')
  let token = ''
  try {
    const parsed = JSON.parse(raw)
    token = parsed?.token || ''
  } catch {
    token = raw || ''
  }

  if (!token) {
    next({ name: 'login', query: { redirect: to.fullPath } })
    return
  }

  // 简单检查过期
  try {
    const parts = token.split('.')
    if (parts.length === 3) {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      if (payload.exp && Date.now() / 1000 >= payload.exp) {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('user_info')
        next({ name: 'login', query: { redirect: to.fullPath } })
        return
      }
    }
  } catch {
    // ignore parse errors
  }

  next()
})

export default router
