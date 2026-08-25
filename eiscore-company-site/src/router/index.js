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
    {
      path: '/cue-builder',
      name: 'CueBuilder',
      component: () => import('@/views/CueBuilder.vue'),
      meta: { title: '3D 定制器与 BOM' }
    },
    {
      path: '/factory-demo',
      name: 'FactoryDemo',
      component: () => import('@/views/FactoryDemo.vue'),
      meta: { title: '全厂演示调度台' }
    },
    {
      path: '/jinwei',
      name: 'JinweiSite',
      component: () => import('@/views/JinweiSite.vue'),
      meta: { title: '湛江市经纬网厂 · 网具制造' }
    },
    {
      path: '/jinwei/manufacturing',
      name: 'JinweiManufacturing',
      component: () => import('@/views/JinweiManufacturing.vue'),
      meta: { title: '经纬制造协同台' }
    },
    { path: '/:pathMatch(.*)*', redirect: '/' }
  ]
})

router.afterEach((to) => {
  if (typeof document !== 'undefined' && to.meta?.title) {
    document.title = String(to.meta.title)
  }
})

export default router
