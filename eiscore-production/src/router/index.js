import { createRouter, createWebHistory } from 'vue-router'
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper'

const isSubAppRoute =
  qiankunWindow.__POWERED_BY_QIANKUN__ ||
  (typeof window !== 'undefined' && window.location.pathname.startsWith('/production'))

const router = createRouter({
  history: createWebHistory(isSubAppRoute ? '/production' : '/'),
  routes: [
    { path: '/', redirect: '/apps' },
    {
      path: '/apps',
      name: 'ProductionHome',
      component: () => import('@/views/HomeView.vue')
    },
    { path: '/:pathMatch(.*)*', redirect: '/apps' }
  ]
})

export default router
