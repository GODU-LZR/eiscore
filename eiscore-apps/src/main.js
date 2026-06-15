// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

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
import { hasPerm, getPermissions } from '@/utils/permission'
import { installFlashRuntimeBridge } from '@/utils/flash-runtime-bridge'
import { getToken, isTokenExpired, clearAuthAndRedirect } from '@/utils/auth'
import { installEisThemeSync } from '@shared/eis-theme-sync'

import App from './App.vue'
import routes from './router'

patchElMessage()

const MICRO_APP_NAME = 'eiscore-apps'
const DEV_STANDALONE_PORT = '8083'

let app = null
let router = null
let history = null
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

function isStandalonePreviewRoute() {
  if (typeof window === 'undefined') return false
  const pathname = String(window.location.pathname || '')
  return (
    pathname === '/apps/preview/flash-draft' ||
    pathname.startsWith('/apps/preview/') ||
    pathname === '/flash-preview/apps/preview/flash-draft' ||
    pathname.startsWith('/flash-preview/apps/preview/')
  )
}

function ensureStandaloneAuth() {
  if (typeof window === 'undefined') return true
  if (isRunningInQiankun() || hasQiankunHostContainer()) return true
  if (isStandalonePreviewRoute()) return true

  const token = getToken()
  if (!token || isTokenExpired(token)) {
    clearAuthAndRedirect('/login')
    return false
  }
  return true
}

function shouldRenderStandalone() {
  if (!ensureStandaloneAuth()) return false
  if (isRunningInQiankun() || hasQiankunHostContainer()) return false
  if (isStandalonePreviewRoute()) return true
  if (import.meta.env.DEV) return window.location.port === DEV_STANDALONE_PORT
  return true
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
  router = null
  history = null
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
  const canAccessAppCenterManage = () => hasPerm('module:app') || hasPerm('module:apps')
  const canAccessAppCenterEntry = () => {
    if (canAccessAppCenterManage()) return true
    return getPermissions().some((perm) => typeof perm === 'string' && perm.startsWith('app:app_'))
  }
  router.beforeEach((to, from, next) => {
    if (!isRunningInQiankun() && !isStandalonePreviewRoute()) {
      const token = getToken()
      if (!token || isTokenExpired(token)) {
        clearAuthAndRedirect('/login')
        return
      }
    }
    if (to.meta?.requiresManage && !canAccessAppCenterManage()) {
      return next('/')
    }
    if (to.meta?.requiresEntry && !canAccessAppCenterEntry()) {
      return next('/')
    }
    next()
  })

  app = createApp(App)
  installFlashRuntimeBridge(app)

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
  if (!containerEl) {
    console.warn(`[${MICRO_APP_NAME}] missing mount target`)
    return
  }
  themeDispose = installEisThemeSync(containerEl, { container })
  app.mount(containerEl)
}

const lifecycle = {
  mount(props) {
    render(props)
  },
  bootstrap() {},
  unmount() {
    unmountApp()
  },
  update() {}
}

renderWithQiankun(lifecycle)
ensureQiankunLifecycleBucket(lifecycle)

if (shouldRenderStandalone()) {
  render()
}
