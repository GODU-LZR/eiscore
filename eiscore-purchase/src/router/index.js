// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createRouter, createWebHistory } from 'vue-router'
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper'
import { hasPerm } from '@/utils/permission'
import { findPurchaseApp } from '@/utils/purchase-apps'

const isSubAppRoute =
  qiankunWindow.__POWERED_BY_QIANKUN__ ||
  (typeof window !== 'undefined' && window.location.pathname.startsWith('/purchase'))
const ROUTER_BASE = '/purchase'
const APPS_PATH = '/apps'

const router = createRouter({
  history: createWebHistory(isSubAppRoute ? ROUTER_BASE : '/'),
  routes: [
    {
      path: '/',
      alias: APPS_PATH,
      name: 'PurchaseHome',
      component: () => import('@/views/PurchaseApps.vue')
    },
    {
      path: '/dashboard',
      name: 'PurchaseDashboard',
      component: () => import('@/views/PurchaseDashboard.vue'),
      meta: { perm: 'app:purchase_dashboard' }
    },
    {
      path: '/app/:key',
      name: 'PurchaseAppView',
      component: () => import('@/views/PurchaseAppView.vue'),
      props: true
    },
    {
      path: '/document/:id',
      name: 'PurchaseDocumentDetail',
      component: () => import('@/views/PurchaseDocumentDetail.vue'),
      props: true
    },
    { path: '/:pathMatch(.*)*', redirect: APPS_PATH }
  ]
})

router.beforeEach((to, from, next) => {
  let requiredPerm = to.meta?.perm
  if (!requiredPerm && to.name === 'PurchaseAppView') {
    const app = findPurchaseApp(to.params?.key)
    requiredPerm = app?.perm
  }
  if (!requiredPerm && to.name === 'PurchaseDocumentDetail') {
    const app = findPurchaseApp(to.query?.appKey || 'suppliers')
    requiredPerm = app?.perm
  }
  if (requiredPerm && !hasPerm(requiredPerm)) {
    return next(APPS_PATH)
  }
  next()
})

export default router
