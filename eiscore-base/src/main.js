// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createApp } from 'vue'
import { createPinia } from 'pinia' // 👈 引入 Pinia
import App from './App.vue'
import router from './router'
import { bootstrapEnterpriseConfig, renderEnterpriseConfigFailure } from './platform/enterprise-config'

// 🟢 Element Plus 完整引入
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
// 👇👇👇 暗黑模式变量定义 👇👇👇
import 'element-plus/theme-chalk/dark/css-vars.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { patchElMessage } from '@/utils/message-patch'

patchElMessage()

const dismissBootstrapLoading = () => {
  const loading = document.getElementById('eiscore-bootstrap-loading')
  if (!loading) return
  loading.classList.add('is-dismissing')
  window.setTimeout(() => loading.remove(), 220)
}

const removeBootstrapLoading = () => {
  document.getElementById('eiscore-bootstrap-loading')?.remove()
}

const mountHostApplication = () => {
  const app = createApp(App)
  app.use(createPinia()) // 👈 挂载 Pinia
  app.use(router)
  app.use(ElementPlus)

  // 注册所有图标
  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
  }

  app.mount('#app')
}

let qiankunStartObserver = null
let qiankunModulePromise = null

const loadQiankunModule = () => {
  if (!qiankunModulePromise) {
    qiankunModulePromise = import('./micro')
      .catch((error) => {
        qiankunModulePromise = null
        throw error
      })
  }
  return qiankunModulePromise
}

const stopQiankunStartObserver = () => {
  if (!qiankunStartObserver) return
  qiankunStartObserver.disconnect()
  qiankunStartObserver = null
}

const startQiankunWhenContainerReady = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (window.__EIS_QIANKUN_STARTED__ || window.__EIS_QIANKUN_STARTING__) return

  const tryStart = () => {
    if (window.__EIS_QIANKUN_STARTED__ || window.__EIS_QIANKUN_STARTING__) {
      stopQiankunStartObserver()
      return true
    }
    if (!document.querySelector('#subapp-viewport')) return false
    stopQiankunStartObserver()
    loadQiankunModule()
      .then(({ registerQiankun }) => registerQiankun(window.__EISCORE_ENTERPRISE_CONFIG__))
      .catch((error) => {
        console.error('[Qiankun] load micro runtime failed', error)
      })
    return true
  }

  if (tryStart() || qiankunStartObserver || !document.body) return

  qiankunStartObserver = new MutationObserver(() => {
    tryStart()
  })
  qiankunStartObserver.observe(document.body, { childList: true, subtree: true })
}

const bootstrap = async () => {
  await bootstrapEnterpriseConfig({
    isProduction: import.meta.env.PROD,
    onWarning: ({ code }) => console.warn(`[enterprise-config] ${code}`)
  })
  mountHostApplication()

  // Start qiankun only after the authenticated layout has rendered its sub-app mount point.
  await router.isReady()
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(dismissBootstrapLoading)
  })
  window.requestAnimationFrame(startQiankunWhenContainerReady)
  router.afterEach(() => {
    window.requestAnimationFrame(startQiankunWhenContainerReady)
  })
}

bootstrap().catch(() => {
  console.error('[enterprise-config] host bootstrap failed')
  removeBootstrapLoading()
  renderEnterpriseConfigFailure()
})
