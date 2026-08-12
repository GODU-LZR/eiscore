// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createRouter, createWebHistory } from 'vue-router'
import { h } from 'vue'
import Layout from '@/layout/index.vue'
import { getToken, isTokenExpired, clearAuthStorage } from '@/utils/auth'
import { canonicalizeMicroChainPath } from '@/utils/micro-path'

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
      meta: { requiresAuth: false, publicLanding: true }
    },
    {
      path: '/company/:pathMatch(.*)*',
      name: 'company-entry',
      component: () => import('../views/LoginView.vue'),
      meta: { requiresAuth: false, publicLanding: true }
    },
    {
      path: '/eiscore',
      name: 'eiscore-landing',
      component: () => import('../views/EiscoreLanding.vue'),
      meta: { requiresAuth: false, publicLanding: true }
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
        },
        {
          path: 'quality/:page(.*)*',
          name: 'quality',
          component: EmptyView
        },
        {
          path: 'equipment/:page(.*)*',
          name: 'equipment',
          component: EmptyView
        },
        {
          path: 'decision/:page(.*)*',
          name: 'decision',
          component: EmptyView
        },
        {
          path: 'company-site/:page(.*)*',
          name: 'company-site',
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

const shouldSkipMobileRedirect = (to) => {
  if (typeof window !== 'undefined' && window.__EIS_SKIP_MOBILE_REDIRECT__) return true
  const path = String(to.path || '')
  const querySkip = String(to.query?.eis_skip_mobile_redirect || '') === '1'
  return querySkip || path.startsWith('/ide')
}

router.beforeEach((to, from, next) => {
  const canonicalPath = canonicalizeMicroChainPath(to.path)
  if (canonicalPath !== to.path) {
    next({
      path: canonicalPath,
      query: to.query,
      hash: to.hash,
      replace: true
    })
    return
  }

  const token = getToken()
  const expired = isTokenExpired(token)

  // 未登录用户先进入统一企业首页/登录页；登录后的内部业务才切换到移动工作台。
  if (token && !expired && isMobileDevice() && !shouldSkipMobileRedirect(to) && !to.meta.publicLanding) {
    const currentPath = window.location.pathname
    if (!currentPath.startsWith('/mobile')) {
      window.location.href = '/mobile/'
      return
    }
  }

  if (to.meta.requiresAuth && (!token || expired)) {
    clearAuthStorage()
    // Force a document navigation so the public static company site owns /login.
    if (typeof window !== 'undefined') {
      window.location.replace('/login')
      return
    }
    next('/login')
  } else if ((to.path === '/login' || to.path === '/company' || to.path.startsWith('/company/')) && token && !expired) {
    next('/')
  } else {
    next()
  }
})

export default router
