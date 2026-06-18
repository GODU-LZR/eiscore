// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { renderWithQiankun, qiankunWindow } from 'vite-plugin-qiankun/dist/helper'

// 🟢 1. 引入 Element Plus 及其样式
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
// 引入中文语言包 (可选，推荐)
import zhCn from 'element-plus/es/locale/lang/zh-cn'
// 引入图标 (如果用到了 Icon)
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { patchElMessage } from '@/utils/message-patch'
import { installEisThemeSync } from '@shared/eis-theme-sync'
// BPMN 样式与字体（用于部门架构图）
import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css'

patchElMessage()

const MICRO_APP_NAME = 'eiscore-hr'
const DEV_STANDALONE_PORT = '8082'

let app
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

async function render(props = {}) {
  const { container } = props
  app = createApp(App)
  const currentApp = app

  if (props && typeof props.setGlobalState === 'function') {
    window.__EIS_BASE_ACTIONS__ = props
  }

  // 🟢 2. 注册 Element Plus
  app.use(ElementPlus, {
    locale: zhCn, // 设置为中文
  })
  
  // 注册所有图标 (防止 el-icon 不显示)
  for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
  }

  app.use(createPinia())
  app.use(router)

  // 注册权限指令
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

  const target = resolveMountTarget(container)
  if (!target) return
  await router.isReady().catch(() => {})
  if (app !== currentApp) return
  themeDispose = installEisThemeSync(target, { container })
  app.mount(target)
}

const lifecycle = {
  mount(props) {
    console.log('[HR] mounted')
    return render(props)
  },
  bootstrap() {
    console.log('[HR] bootstrap')
  },
  unmount(props) {
    console.log('[HR] unmount')
    unmountApp()
  },
  update(props) {
    console.log('[HR] update', props)
  }
}

renderWithQiankun(lifecycle)
ensureQiankunLifecycleBucket(lifecycle)

if (shouldRenderStandalone()) {
  render()
}
