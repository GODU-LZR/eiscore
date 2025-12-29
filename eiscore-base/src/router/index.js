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
          path: 'materials/:page*',
          name: 'materials',
          component: EmptyView
        },
        {
          path: 'hr/:page*',
          name: 'hr',
          component: EmptyView
        }
      ]
    }
  ]
})

router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('auth_token')
  if (to.meta.requiresAuth && !token) {
    next('/login')
  } else if (to.path === '/login' && token) {
    next('/')
  } else {
    next()
  }
})

export default router
