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
}

bootstrap().catch(() => {
  console.error('[enterprise-config] mobile bootstrap failed')
  renderEnterpriseConfigFailure()
})
