import { createRouter, createWebHistory } from 'vue-router'
import { h } from 'vue'
import Layout from '@/layout/index.vue'

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

  const getAuthToken = () => {
    const raw = localStorage.getItem('auth_token')
    if (!raw) return ''
    try {
      const parsed = JSON.parse(raw)
      if (parsed?.token) return parsed.token
    } catch (e) {
      // ignore
    }
    return raw
  }

  const parseJwtPayload = (token) => {
    try {
      const parts = String(token || '').split('.')
      if (parts.length !== 3) return null
      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
      return JSON.parse(atob(padded))
    } catch (e) {
      return null
    }
  }

  const isTokenExpired = (token) => {
    if (!token) return true
    const payload = parseJwtPayload(token)
    if (!payload || typeof payload.exp !== 'number') return true
    return Date.now() / 1000 >= payload.exp
  }

  const token = getAuthToken()
  const expired = isTokenExpired(token)
  if (to.meta.requiresAuth && (!token || expired)) {
    try {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_info')
    } catch (e) {}
    next('/login')
  } else if (to.path === '/login' && token && !expired) {
    next('/')
  } else {
    next()
  }
})

export default router
