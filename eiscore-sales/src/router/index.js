// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createRouter, createWebHistory } from 'vue-router'
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper'

const isSubAppRoute =
  qiankunWindow.__POWERED_BY_QIANKUN__ ||
  (typeof window !== 'undefined' && window.location.pathname.startsWith('/sales'))
const ROUTER_BASE = '/sales'
const APPS_PATH = '/apps'

const router = createRouter({
  history: createWebHistory(isSubAppRoute ? ROUTER_BASE : '/'),
  routes: [
    {
      path: '/',
      alias: APPS_PATH,
      name: 'SalesHome',
      component: () => import('@/views/SalesApps.vue')
    },
    {
      path: '/cockpit',
      name: 'SalesCockpit',
      component: () => import('@/views/SalesCockpit.vue')
    },
    {
      path: '/app/:key',
      name: 'SalesAppView',
      component: () => import('@/views/SalesAppView.vue'),
      props: true
    },
    { path: '/:pathMatch(.*)*', redirect: APPS_PATH }
  ]
})

export default router
