// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createRouter, createWebHistory } from 'vue-router'
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper'
import { hasPerm } from '@/utils/permission'

const isSubAppRoute =
  qiankunWindow.__POWERED_BY_QIANKUN__ ||
  (typeof window !== 'undefined' && window.location.pathname.startsWith('/production'))
const ROUTER_BASE = '/production'
const APPS_PATH = '/apps'

const router = createRouter({
  history: createWebHistory(isSubAppRoute ? ROUTER_BASE : '/'),
  routes: [
    {
      path: '/',
      alias: APPS_PATH,
      name: 'ProductionApps',
      component: () => import('@/views/ProductionApps.vue')
    },
    {
      path: '/overview',
      name: 'ProductionOverview',
      meta: { perm: 'module:production' },
      component: () => import('@/views/HomeView.vue')
    },
    {
      path: '/bom',
      name: 'ProductionBom',
      meta: { perm: 'app:mms_bom' },
      component: () => import('@/views/BomManagement.vue')
    },
    {
      path: '/app/:key',
      name: 'ProductionAppView',
      component: () => import('@/views/ProductionAppView.vue'),
      props: true
    },
    { path: '/:pathMatch(.*)*', redirect: APPS_PATH }
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
