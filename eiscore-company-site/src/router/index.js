// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createRouter, createWebHistory } from 'vue-router'
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper'

const isSubAppRoute =
  qiankunWindow.__POWERED_BY_QIANKUN__ ||
  (typeof window !== 'undefined' && window.location.pathname.startsWith('/company-site'))

const ROUTER_BASE = '/company-site'

const router = createRouter({
  history: createWebHistory(isSubAppRoute ? ROUTER_BASE : '/'),
  routes: [
    {
      path: '/',
      name: 'CompanySiteOps',
      component: () => import('@/views/CompanySiteOps.vue')
    },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

export default router
