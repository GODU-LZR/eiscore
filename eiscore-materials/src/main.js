// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { renderWithQiankun, qiankunWindow } from 'vite-plugin-qiankun/dist/helper'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { patchElMessage } from '@/utils/message-patch'
import { installEisThemeSync } from '@shared/eis-theme-sync'

patchElMessage()

const MICRO_APP_NAME = 'eiscore-materials'
const DEV_STANDALONE_PORT = '8081'

let app = null
let themeDispose = null

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

function hasQiankunHostContainer() {
  return typeof document !== 'undefined' && !!document.querySelector('#subapp-viewport')
}

function shouldRenderStandalone() {
  if (isRunningInQiankun() || hasQiankunHostContainer()) return false
  if (import.meta.env.DEV) return window.location.port === DEV_STANDALONE_PORT
  return true
}

function resolveMountTarget(container) {
  if (container) {
    const target = container.querySelector('#app')
    if (!target) console.warn(`[${MICRO_APP_NAME}] missing #app inside qiankun container`)
    return target
  }
  return document.querySelector('#app')
}

function stripVueHmrMarkers(vnode, seen = new Set()) {
  if (!import.meta.env.DEV || !vnode || typeof vnode !== 'object' || seen.has(vnode)) return
  seen.add(vnode)
  const clearType = (type) => {
    if (!type || typeof type !== 'object') return
    try { delete type.__hmrId } catch (e) {}
    if (type.__vccOpts && typeof type.__vccOpts === 'object') {
      try { delete type.__vccOpts.__hmrId } catch (e) {}
    }
  }
  clearType(vnode.type)
  if (vnode.component) {
    clearType(vnode.component.type)
    stripVueHmrMarkers(vnode.component.subTree, seen)
  }
  if (Array.isArray(vnode.children)) {
    vnode.children.forEach((child) => stripVueHmrMarkers(child, seen))
  }
}

function unmountApp() {
  if (themeDispose) {
    themeDispose()
    themeDispose = null
  }
  if (!app) return
  stripVueHmrMarkers(app._instance?.subTree)
  app.unmount()
  app = null
}

function render(props = {}) {
  const { container } = props
  app = createApp(App)

  if (props && typeof props.setGlobalState === 'function') {
    window.__EIS_BASE_ACTIONS__ = props
  }

  app.use(ElementPlus, { locale: zhCn })

  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
  }

  app.use(createPinia())
  app.use(router)

  app.directive('permission', {
    mounted(el, binding) {
      const { value } = binding
      const userInfoStr = localStorage.getItem('user_info')
      const userInfo = userInfoStr ? JSON.parse(userInfoStr) : {}
      const permissions = userInfo.permissions || []
      if (value && value instanceof Array && value.length > 0) {
        const hasPermission = permissions.some(perm => value.includes(perm))
        if (!hasPermission) {
          el.parentNode && el.parentNode.removeChild(el)
        }
      }
    }
  })

  const mountPoint = resolveMountTarget(container)
  if (!mountPoint) return
  themeDispose = installEisThemeSync(mountPoint, { container })
  app.mount(mountPoint)
}

const lifecycle = {
  bootstrap() { console.log('[materials] bootstrap') },
  mount(props) {
    console.log('[materials] mount')
    render(props)
  },
  unmount() {
    console.log('[materials] unmount')
    unmountApp()
  },
  update() {}
}

renderWithQiankun(lifecycle)
ensureQiankunLifecycleBucket(lifecycle)

if (shouldRenderStandalone()) {
  render()
}
