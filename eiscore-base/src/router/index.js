import { createRouter, createWebHistory } from 'vue-router'
import Layout from '@/layout/index.vue'

// --- 🔴 修复点：在这里定义 EmptyView ---
// 这是一个极其简单的组件，只渲染一个空 div，
// 作用是让路由匹配成功，从而保证 Layout 不会被卸载。
const EmptyView = { template: '<div></div>' }

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { requiresAuth: false } // 登录页不需要认证
    },
    {
      path: '/',
      component: Layout,
      meta: { requiresAuth: true }, // 这一组都需要认证
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('../views/HomeView.vue')
        },
        // 微前端子应用的路由 (/materials, /hr) 会自动匹配到 Layout，
        // 也会继承 requiresAuth: true
        {
          path: 'settings',
          name: 'settings',
          component: () => import('../views/SettingsView.vue')
        },
        {
          path: 'materials/:page*', // :page* 允许匹配 /materials/abc 等子路径
          name: 'materials',
          // 这里使用了上面定义的 EmptyView
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

// 🔐 全局前置守卫
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('auth_token')
  
  // 1. 如果去的是需要认证的页面，且没有 Token
  if (to.meta.requiresAuth && !token) {
    next('/login') // 强制踢回登录页
  } 
  // 2. 如果已经登录了，还想去登录页 (防止重复登录)
  else if (to.path === '/login' && token) {
    next('/')
  }
  // 3. 放行
  else {
    next()
  }
})

export default router