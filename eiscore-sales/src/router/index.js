import { createRouter, createWebHistory } from 'vue-router'
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper'

const isSubAppRoute =
  qiankunWindow.__POWERED_BY_QIANKUN__ ||
  (typeof window !== 'undefined' && window.location.pathname.startsWith('/sales'))

const router = createRouter({
  history: createWebHistory(isSubAppRoute ? '/sales' : '/'),
  routes: [
    { path: '/', redirect: '/apps' },
    {
      path: '/apps',
      name: 'SalesHome',
      component: () => import('@/views/HomeView.vue')
    },
    { path: '/:pathMatch(.*)*', redirect: '/apps' }
  ]
})

export default router
