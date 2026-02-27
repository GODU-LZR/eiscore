import { createApp } from 'vue'
import { createRouter, createWebHistory, createMemoryHistory } from 'vue-router'
import { createPinia } from 'pinia'
import {
  renderWithQiankun,
  qiankunWindow
} from 'vite-plugin-qiankun/dist/helper'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { patchElMessage } from '@/utils/message-patch'

import App from './App.vue'
import routes from './router'

patchElMessage()

const MICRO_APP_NAME = 'eiscore-apps'

let app = null
let router = null
let history = null

function isRunningInQiankun() {
  if (typeof window === 'undefined') return false
  return Boolean(
    qiankunWindow.__POWERED_BY_QIANKUN__ ||
    window.__POWERED_BY_QIANKUN__ ||
    window.proxy?.__POWERED_BY_QIANKUN__ ||
    window.__INJECTED_PUBLIC_PATH_BY_QIANKUN__
  )
}

function ensureQiankunLifecycleBucket(lifecycle) {
  if (typeof window === 'undefined') return
  window.moudleQiankunAppLifeCycles = window.moudleQiankunAppLifeCycles || {}
  window.moudleQiankunAppLifeCycles[MICRO_APP_NAME] = lifecycle
}

function render(props = {}) {
  const { container } = props
  const pinia = createPinia()

  const pathname = typeof window !== 'undefined' ? String(window.location.pathname || '') : ''
  const href = typeof window !== 'undefined' ? String(window.location.href || '') : ''
  const protocol = typeof window !== 'undefined' ? String(window.location.protocol || '') : ''
  const isPreviewProxyRoute = pathname.startsWith('/flash-preview/apps')
  const isAppsRoute = pathname.startsWith('/apps')
  const isSubAppRoute = qiankunWindow.__POWERED_BY_QIANKUN__ || isAppsRoute
  const isInlineSnapshotRoute = protocol === 'about:' || protocol === 'blob:' || href.startsWith('about:srcdoc')
  const historyBase = isPreviewProxyRoute ? '/flash-preview/apps/' : (isSubAppRoute ? '/apps/' : '/')

  history = isInlineSnapshotRoute
    ? createMemoryHistory('/')
    : createWebHistory(historyBase)
  router = createRouter({
    history,
    routes
  })

  app = createApp(App)

  // Register all Element Plus icons
  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
  }

  app.use(pinia)
  app.use(router)
  app.use(ElementPlus)

  const containerEl = container
    ? container.querySelector('#app')
    : document.getElementById('app')
  app.mount(containerEl)
}

const lifecycle = {
  mount(props) {
    render(props)
  },
  bootstrap() {},
  unmount() {
    app?.unmount()
  },
  update() {}
}

renderWithQiankun(lifecycle)
ensureQiankunLifecycleBucket(lifecycle)

if (!isRunningInQiankun()) {
  render()
}
