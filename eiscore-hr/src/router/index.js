// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createRouter, createWebHistory } from 'vue-router'
// 1. 引入 qiankun 辅助变量 (用于判断是否在基座中运行)
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper'
import { hasPerm } from '@/utils/permission'

const ROUTER_BASE = '/hr'
const APPS_PATH = '/apps'

const router = createRouter({
  // 3. 🟢 关键配置：设置路由基础路径
  // 刷新时部分场景 __POWERED_BY_QIANKUN__ 可能还未就绪，改为按当前路径兜底判定。
  history: createWebHistory(
    (
      qiankunWindow.__POWERED_BY_QIANKUN__ ||
      (typeof window !== 'undefined' && window.location.pathname.startsWith('/hr'))
    ) ? ROUTER_BASE : '/'
  ),
  routes: [
    {
      path: '/',
      alias: APPS_PATH,
      name: 'HrApps',
      component: () => import('../views/HrApps.vue')
    },
    {
      path: '/app/:key',
      name: 'HrAppView',
      component: () => import('../views/HrAppView.vue'),
      props: true
    },
    {
      path: '/employee',
      name: 'EmployeeList',
      meta: { perm: 'app:hr_employee' },
      component: () => import('../views/EmployeeList.vue') // 挂载组件
    },
    // 🟢 新增详情页路由
    {
      path: '/employee/detail/:id',
      name: 'EmployeeDetail',
      meta: { perm: 'app:hr_employee' },
      component: () => import('../views/EmployeeDetail.vue'),
      props: true // 允许将 route.params.id 作为 props 传给组件
    },
    {
      path: '/org',
      name: 'HrOrgChart',
      meta: { perm: 'app:hr_org' },
      component: () => import('../views/HrOrgChart.vue')
    },
    {
      path: '/acl',
      name: 'HrAclView',
      meta: { perm: 'app:hr_acl' },
      component: () => import('../views/HrAclView.vue')
    },
    {
      path: '/users',
      name: 'HrUserManage',
      meta: { perm: 'app:hr_user' },
      component: () => import('../views/HrUserManage.vue')
    }
  ]
})

router.beforeEach((to, from, next) => {
  const perm = to.meta?.perm
  if (perm && !hasPerm(perm)) {
    return next(APPS_PATH)
  }
  next()
})

export default router
