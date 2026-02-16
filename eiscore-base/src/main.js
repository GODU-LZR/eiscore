import { createApp } from 'vue'
import { createPinia } from 'pinia' // 👈 引入 Pinia
import App from './App.vue'
import router from './router'

// 🟢 Element Plus 完整引入
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
// 👇👇👇 暗黑模式变量定义 👇👇👇
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { patchElMessage } from '@/utils/message-patch'

// 🟢 确保这里是命名导入，对应 micro/index.js 的 export function
import { registerQiankun } from './micro'

patchElMessage()

const app = createApp(App)

app.use(createPinia()) // 👈 挂载 Pinia
app.use(router)
app.use(ElementPlus)

// 注册所有图标
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.mount('#app')

// Global fetch guard for 401 -> redirect to login
if (typeof window !== 'undefined' && window.fetch) {
  const originalFetch = window.fetch.bind(window)
  window.fetch = async (...args) => {
    const response = await originalFetch(...args)
    try {
      const reqUrl = typeof args[0] === 'string' ? args[0] : args[0]?.url
      const url = reqUrl || response.url || ''
      const isApiCall = url.startsWith('/api') || url.includes(`${window.location.origin}/api`)
      if (isApiCall && response.status === 401 && window.location.pathname !== '/login') {
        try {
          localStorage.removeItem('auth_token')
          localStorage.removeItem('user_info')
        } catch (e) {}
        window.location.href = '/login'
      }
    } catch (e) {
      // ignore
    }
    return response
  }
}

// Start qiankun only after router is ready and layout container can render.
// This avoids intermittent "Target container #subapp-viewport not existed".
router.isReady().then(() => {
  registerQiankun()
})
