// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import {
  loadEnterpriseConfig,
  publishEnterpriseConfig
} from '@eiscore/platform/enterprise-config'

// Vant 组件按需引入（通过 unplugin-vue-components 自动注册）
// 这里只需要引入全局样式
import 'vant/lib/index.css'

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
  if (!/^\/(?:mobile\/)?login(?:\/|$)/.test(window.location.pathname) || window.__EISCORE_INITIAL_CONTENT_READY__) {
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
  const isPublicLanding = /^\/(?:mobile\/)?login(?:\/|$)/.test(window.location.pathname)
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

const mountMobileApplication = () => {
  const app = createApp(App)
  app.use(createPinia())
  app.use(router)
  app.mount('#app')
}

const renderEnterpriseConfigFailure = () => {
  const root = document.querySelector('#app')
  if (!root) return
  root.textContent = '系统配置加载失败，请联系管理员。'
  root.setAttribute('data-eiscore-bootstrap', 'config-error')
}

const bootstrap = async () => {
  const enterpriseConfig = await loadEnterpriseConfig({
    globalConfig: globalThis.__EISCORE_ENTERPRISE_CONFIG__,
    required: import.meta.env.PROD,
    onWarning: ({ code }) => console.warn(`[enterprise-config] ${code}`)
  })
  publishEnterpriseConfig(enterpriseConfig, globalThis)
  mountMobileApplication()
  await waitForInitialPageResources()
  dismissBootstrapLoading()
}

bootstrap().catch(() => {
  console.error('[enterprise-config] mobile bootstrap failed')
  removeBootstrapLoading()
  renderEnterpriseConfigFailure()
})
