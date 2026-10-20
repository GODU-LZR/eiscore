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
      redirect: '/huizhong'
    },
    {
      path: '/huizhong',
      name: 'HuizhongSite',
      component: () => import('@/views/HuizhongSite.vue'),
      meta: { title: '广东惠众消防科技有限公司 · 消防设备与技术服务' }
    },
    { path: '/:pathMatch(.*)*', redirect: '/huizhong' }
  ]
})

router.afterEach((to) => {
  if (typeof document !== 'undefined' && to.meta?.title) {
    document.title = String(to.meta.title)
  }
})

export default router
