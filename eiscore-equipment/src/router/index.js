// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createRouter, createWebHistory } from 'vue-router'
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper'

const isSubAppRoute =
  qiankunWindow.__POWERED_BY_QIANKUN__ ||
  (typeof window !== 'undefined' && window.location.pathname.startsWith('/equipment'))

const router = createRouter({
  history: createWebHistory(isSubAppRoute ? '/equipment' : '/'),
  routes: [
    {
      path: '/',
      alias: ['/apps'],
      name: 'EquipmentApps',
      component: () => import('@/views/EquipmentApps.vue'),
      meta: { title: '设备管理' }
    },
    {
      path: '/dashboard',
      name: 'EquipmentHome',
      component: () => import('@/views/EquipmentHome.vue'),
      meta: { title: '设备总览' }
    },
    {
      path: '/app/:key',
      name: 'EquipmentAppView',
      component: () => import('@/views/EquipmentAppView.vue'),
      props: true,
      meta: { title: '设备应用' }
    },
    {
      path: '/document/:id',
      name: 'EquipmentDocumentDetail',
      component: () => import('@/views/EquipmentDocumentDetail.vue'),
      props: true,
      meta: { title: '设备表单' }
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/'
    }
  ]
})

export default router
