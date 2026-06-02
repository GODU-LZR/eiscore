// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createRouter, createWebHistory } from 'vue-router'
import { h } from 'vue'
import Layout from '@/layout/index.vue'
import { getToken, isTokenExpired, clearAuthStorage } from '@/utils/auth'

const EmptyView = {
  render: () => h('div')
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { requiresAuth: false }
    },
    {
      path: '/',
      component: Layout,
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('../views/HomeView.vue')
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('../views/SettingsView.vue')
        },
        {
          path: 'ai/enterprise',
          name: 'ai-enterprise',
          component: () => import('../views/EnterpriseAiView.vue')
        },
        {
          path: 'materials/:page(.*)*',
          name: 'materials',
          component: EmptyView
        },
        {
          path: 'hr/:page(.*)*',
          name: 'hr',
          component: EmptyView
        },
        {
          path: 'apps/:page(.*)*',
          name: 'apps',
          component: EmptyView
        },
        {
          path: 'sales/:page(.*)*',
          name: 'sales',
          component: EmptyView
        },
        {
          path: 'purchase/:page(.*)*',
          name: 'purchase',
          component: EmptyView
        },
        {
          path: 'production/:page(.*)*',
          name: 'production',
          component: EmptyView
        }
      ]
    }
  ]
})

// 移动端设备检测：手机/平板访问自动跳转到 /mobile/
const isMobileDevice = () => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua)
    || (window.innerWidth <= 768)
}

router.beforeEach((to, from, next) => {
  // 移动端自动跳转（仅在非 /mobile/ 路径下触发）
  if (isMobileDevice() && !window.__EIS_SKIP_MOBILE_REDIRECT__) {
    const currentPath = window.location.pathname
    if (!currentPath.startsWith('/mobile')) {
      window.location.href = '/mobile/'
      return
    }
  }

  const token = getToken()
  const expired = isTokenExpired(token)
  if (to.meta.requiresAuth && (!token || expired)) {
    clearAuthStorage()
    next('/login')
  } else if (to.path === '/login' && token && !expired) {
    next('/')
  } else {
    next()
  }
})

export default router
