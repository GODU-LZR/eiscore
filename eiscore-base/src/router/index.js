import { createRouter, createWebHistory } from 'vue-router'
import { h } from 'vue' // 引入 h 函数
import Layout from '@/layout/index.vue'

// 🟢 修复：使用 render 函数代替 template
// 这样不需要配置 vite alias 也能完美运行
const EmptyView = {
  render: () => h('div') // 渲染一个空的 div
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
        // 微前端子应用路由
        {
          // 匹配 /materials, /materials/abc ...
          path: 'materials/:page*', 
          name: 'materials',
          component: EmptyView 
        },
        {
          // 匹配 /hr, /hr/employee ...
          path: 'hr/:page*',
          name: 'hr',
          component: EmptyView
        }
      ]
    }
  ]
})

// 全局前置守卫
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