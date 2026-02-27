import { registerMicroApps, start, initGlobalState } from 'qiankun'
import { setBootstrapMaxTime, setMountMaxTime, setUnmountMaxTime, addErrorHandler, unloadApplication } from 'single-spa'
import apps from './apps'
import { aiBridge } from '@/utils/ai-bridge' 

/**
 * 初始化微前端架构
 * 包含：子应用注册、全局状态管理、AI通信桥接
 */
export function registerQiankun() {
  if (window.__EIS_QIANKUN_STARTED__) return
  const MAX_AUTO_RECOVERY = 2
  const RECOVERY_WINDOW_MS = 12000
  const retryMap = window.__EIS_QIANKUN_RETRY_MAP__ || {}
  window.__EIS_QIANKUN_RETRY_MAP__ = retryMap

  const waitForContainer = (selector, timeoutMs = 12000) => new Promise((resolve) => {
    const existed = document.querySelector(selector)
    if (existed) {
      resolve(existed)
      return
    }

    let settled = false
    const timer = window.setTimeout(() => {
      if (settled) return
      settled = true
      observer.disconnect()
      resolve(null)
    }, timeoutMs)

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector)
      if (!el || settled) return
      settled = true
      window.clearTimeout(timer)
      observer.disconnect()
      resolve(el)
    })

    observer.observe(document.body, { childList: true, subtree: true })
  })

  waitForContainer('#subapp-viewport').then((containerEl) => {
    if (!containerEl) {
      console.error('[Qiankun] container #subapp-viewport not ready, retry start later')
      if (!window.__EIS_QIANKUN_RETRY_TIMER__) {
        window.__EIS_QIANKUN_RETRY_TIMER__ = window.setTimeout(() => {
          window.__EIS_QIANKUN_RETRY_TIMER__ = null
          registerQiankun()
        }, 1500)
      }
      return
    }

  // Dev mode sub-apps are served by Vite and may take longer than single-spa default 4s.
  // Relax lifecycle deadlines to prevent false timeout failures on slower machines.
  setBootstrapMaxTime(60000, false, 15000)
  setMountMaxTime(60000, false, 15000)
  setUnmountMaxTime(20000, false, 8000)

  if (!window.__EIS_QIANKUN_ERROR_HANDLER_READY__) {
    addErrorHandler((error) => {
      const message = String(error?.message || '')
      const appName = String(error?.appOrParcelName || '')
      const target = ['eiscore-apps', 'eiscore-materials', 'eiscore-hr']
        .find((name) => appName === name || message.includes(name))
      if (!target) return

      const now = Date.now()
      const state = retryMap[target] || { count: 0, ts: 0 }
      const elapsed = now - (state.ts || 0)
      const nextCount = elapsed > RECOVERY_WINDOW_MS ? 1 : state.count + 1
      retryMap[target] = { count: nextCount, ts: now }
      if (nextCount > MAX_AUTO_RECOVERY) {
        console.error(`[Qiankun] ${target} failed repeatedly, stop auto recover`, error)
        return
      }

      console.warn(`[Qiankun] auto recover ${target}, attempt ${nextCount}`, error)
      unloadApplication(target, { waitForUnmount: false })
        .catch(() => {})
        .finally(() => {
          window.setTimeout(() => {
            window.dispatchEvent(new PopStateEvent('popstate'))
          }, 120)
        })
    })
    window.__EIS_QIANKUN_ERROR_HANDLER_READY__ = true
  }

  // 1. 注册子应用
  registerMicroApps(apps, {
    beforeLoad: app => {
      window.dispatchEvent(new CustomEvent('eis:micro-loading', { detail: { app: app?.name || '', loading: true } }))
    },
    beforeMount: [
      app => {
      }
    ],
    afterMount: [
      app => {
        window.dispatchEvent(new CustomEvent('eis:micro-loading', { detail: { app: app?.name || '', loading: false } }))
      }
    ],
    afterUnmount: [
      app => {
        window.dispatchEvent(new CustomEvent('eis:micro-loading', { detail: { app: app?.name || '', loading: false } }))
      }
    ]
  })

  // 2. 初始化全局状态 (Global AI Bus 的核心通道)
  // 初始状态包含 user 信息和 context (AI 上下文)
  const actions = initGlobalState({
    user: 'admin',
    user_info: null,
    context: null,  // 用于子应用上报页面信息给 AI
    command: null
  })

  // 3. 将 actions 交给 AI Bridge 托管
  // 这样 AiBridge 就能监听到子应用发来的 Context，也能向子应用发送指令
  if (aiBridge && typeof aiBridge.initActions === 'function') {
    aiBridge.initActions(actions)
  } else {
    console.error('[Micro] aiBridge initActions method missing! Please check utils/ai-bridge.js')
  }

  // 监听状态变更（可选，用于调试通讯链路）
  actions.onGlobalStateChange((state, prev) => {
    const incoming = state?.user_info || state?.user || null
    if (incoming && typeof incoming === 'object') {
      try {
        localStorage.setItem('user_info', JSON.stringify(incoming))
        window.dispatchEvent(new CustomEvent('user-info-updated'))
      } catch (e) {}
    }
  })

  // 4. 启动 Qiankun
  const useStyleIsolation = !import.meta.env.DEV
  start({
    prefetch: 'all',
    singular: true,
    sandbox: {
      experimentalStyleIsolation: useStyleIsolation
    }
  })
  window.__EIS_QIANKUN_STARTED__ = true
  })
}
