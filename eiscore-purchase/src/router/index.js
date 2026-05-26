import { createRouter, createWebHistory } from 'vue-router'
import { qiankunWindow } from 'vite-plugin-qiankun/dist/helper'

const isSubAppRoute =
  qiankunWindow.__POWERED_BY_QIANKUN__ ||
  (typeof window !== 'undefined' && window.location.pathname.startsWith('/purchase'))

const router = createRouter({
  history: createWebHistory(isSubAppRoute ? '/purchase' : '/'),
  routes: [
    { path: '/', redirect: '/apps' },
    {
      path: '/apps',
      name: 'PurchaseHome',
      component: () => import('@/views/HomeView.vue')
    },
    { path: '/:pathMatch(.*)*', redirect: '/apps' }
  ]
})

export default router
