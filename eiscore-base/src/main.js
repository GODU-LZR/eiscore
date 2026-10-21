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

const waitWithTimeout = (promise, timeout = 12000) => new Promise((resolve) => {
  const timer = window.setTimeout(resolve, timeout)
  Promise.resolve(promise).then(resolve, resolve).finally(() => window.clearTimeout(timer))
})

const waitForWindowLoad = () => {
  if (document.readyState === 'complete') return Promise.resolve()
  return waitWithTimeout(new Promise((resolve) => window.addEventListener('load', resolve, { once: true })))
}

const waitForPublicLandingContent = () => {
  if (!/^\/(?:login(?:\/|$)|services\/(?:quality-delivery|technical-support)(?:\/|$))/.test(window.location.pathname) || window.__EISCORE_INITIAL_CONTENT_READY__) {
    return Promise.resolve()
  }
  return waitWithTimeout(new Promise((resolve) => {
    window.addEventListener('eiscore:initial-content-ready', resolve, { once: true })
  }))
}

const waitForImage = (image) => {
  if (image.complete) return Promise.resolve()
  return waitWithTimeout(new Promise((resolve) => {
    image.addEventListener('load', resolve, { once: true })
    image.addEventListener('error', resolve, { once: true })
  }))
}

const waitForInitialPageResources = async () => {
  const isPublicLanding = /^\/(?:login(?:\/|$)|services\/(?:quality-delivery|technical-support)(?:\/|$))/.test(window.location.pathname)
  if (!isPublicLanding) return

  await Promise.all([
    waitForWindowLoad(),
    waitForPublicLandingContent(),
    waitWithTimeout(document.fonts?.ready?.catch?.(() => {}))
  ])

  await new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))
  })

  const visibleImages = [...document.querySelectorAll('#app img')].filter((image) => {
    const bounds = image.getBoundingClientRect()
    return bounds.width > 0 && bounds.height > 0 &&
      bounds.top < window.innerHeight && bounds.bottom > 0 &&
      bounds.left < window.innerWidth && bounds.right > 0
  })
  await Promise.all(visibleImages.map(waitForImage))
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
  const enterpriseConfig = await bootstrapEnterpriseConfig({
    isProduction: import.meta.env.PROD,
    onWarning: ({ code }) => console.warn(`[enterprise-config] ${code}`)
  })
  const themeColor = enterpriseConfig.branding.themeColor
  const rootStyle = document.documentElement.style
  rootStyle.setProperty('--eis-bootstrap-theme-color', themeColor)
  rootStyle.setProperty('--eis-bootstrap-theme-rgb', themeColor.slice(1).match(/.{2}/g).map((part) => parseInt(part, 16)).join(','))
  if (enterpriseConfig.branding.surfaceColor) {
    rootStyle.setProperty('--eis-bootstrap-surface-color', enterpriseConfig.branding.surfaceColor)
  } else {
    rootStyle.removeProperty('--eis-bootstrap-surface-color')
  }
  mountHostApplication()

  // Start qiankun only after the authenticated layout has rendered its sub-app mount point.
  await router.isReady()
  await waitForInitialPageResources()
  dismissBootstrapLoading()
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
