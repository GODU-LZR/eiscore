// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createRouter, createWebHistory } from 'vue-router'
import { h } from 'vue'
import Layout from '@/layout/index.vue'
import { getToken, isTokenExpired, clearAuthStorage } from '@/utils/auth'
import { canonicalizeMicroChainPath } from '@/utils/micro-path'
import { getEnterpriseConfig } from '@/platform/enterprise-config'
import { resolveEnterpriseNavigation } from '@/platform/enterprise-routing'

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
      path: '/eiscore',
      name: 'eiscore-landing',
      component: () => import('../views/EiscoreLanding.vue'),
      meta: { requiresAuth: false, publicLanding: true }
    },
    {
      path: '/embed/:feature(digital-twin|smart-bi)',
      name: 'embed-feature',
      component: () => import('../views/EmbedView.vue'),
      meta: { requiresAuth: true }
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
          path: 'document-intake',
          name: 'document-intake',
          component: () => import('../views/DocumentIntakeCenter.vue')
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
          path: 'company-site/:page(.*)*',
          name: 'company-site',
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
  return querySkip || path.startsWith('/ide') || path.startsWith('/embed/')
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

  const enterpriseNavigation = resolveEnterpriseNavigation({
    path: canonicalPath,
    enterpriseConfig: getEnterpriseConfig(window),
    mobileDevice: isMobileDevice(),
    skipMobileRedirect: shouldSkipMobileRedirect(to),
    publicLanding: !!to.meta.publicLanding
  })
  if (enterpriseNavigation.type === 'redirect') {
    next({
      path: enterpriseNavigation.path,
      query: { module_unavailable: enterpriseNavigation.moduleId },
      replace: true
    })
    return
  }
  if (enterpriseNavigation.type === 'external') {
    window.location.href = enterpriseNavigation.path
    return
  }

  const token = getToken()
  const expired = isTokenExpired(token)
  if (to.meta.requiresAuth && (!token || expired)) {
    clearAuthStorage()
    next({ path: '/login', query: { redirect: to.fullPath } })
  } else if (to.path === '/login' && token && !expired) {
    const redirect = typeof to.query.redirect === 'string' ? to.query.redirect : ''
    const safeRedirect = /^\/(?!\/)/.test(redirect) ? redirect : '/'
    next(safeRedirect)
  } else {
    next()
  }
})

export default router
