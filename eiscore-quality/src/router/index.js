// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createRouter, createWebHistory } from 'vue-router'
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper'

const isSubAppRoute =
  qiankunWindow.__POWERED_BY_QIANKUN__ ||
  (typeof window !== 'undefined' && window.location.pathname.startsWith('/quality'))

const router = createRouter({
  history: createWebHistory(isSubAppRoute ? '/quality' : '/'),
  routes: [
    {
      path: '/',
      alias: ['/apps'],
      name: 'QualityApps',
      component: () => import('@/views/QualityApps.vue'),
      meta: { title: '质量模块' }
    },
    {
      path: '/dashboard',
      name: 'QualityHome',
      component: () => import('@/views/QualityHome.vue'),
      meta: { title: '质量总览' }
    },
    {
      path: '/app/:key',
      name: 'QualityAppView',
      component: () => import('@/views/QualityAppView.vue'),
      props: true,
      meta: { title: '质量应用' }
    },
    {
      path: '/document/:id',
      name: 'QualityDocumentDetail',
      component: () => import('@/views/QualityDocumentDetail.vue'),
      props: true,
      meta: { title: '质量表单' }
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

export default router
