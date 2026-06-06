// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createRouter, createWebHistory } from 'vue-router'
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper'

const isSubAppRoute =
  qiankunWindow.__POWERED_BY_QIANKUN__ ||
  (typeof window !== 'undefined' && window.location.pathname.startsWith('/decision'))

const router = createRouter({
  history: createWebHistory(isSubAppRoute ? '/decision' : '/'),
  routes: [
    {
      path: '/',
      alias: ['/apps'],
      name: 'DecisionHome',
      component: () => import('@/views/DecisionHome.vue'),
      meta: { title: '决策支持' }
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

export default router
