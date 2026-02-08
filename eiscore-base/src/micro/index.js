import { registerMicroApps, start, initGlobalState } from 'qiankun'
import { setBootstrapMaxTime, setMountMaxTime, setUnmountMaxTime } from 'single-spa'
import apps from './apps'
import { aiBridge } from '@/utils/ai-bridge' 

/**
 * 初始化微前端架构
 * 包含：子应用注册、全局状态管理、AI通信桥接
 */
export function registerQiankun() {
  // Dev mode sub-apps are served by Vite and may take longer than single-spa default 4s.
  // Relax lifecycle deadlines to prevent false timeout failures on slower machines.
  setBootstrapMaxTime(20000, false, 10000)
  setMountMaxTime(20000, false, 10000)
  setUnmountMaxTime(15000, false, 8000)

  // 1. 注册子应用
  registerMicroApps(apps, {
    beforeLoad: app => {
    },
    beforeMount: [
      app => {
      }
    ],
    afterMount: [
      app => {
      }
    ],
    afterUnmount: [
      app => {
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
  start({
    prefetch: false,
    sandbox: {
      experimentalStyleIsolation: true
    }
  })
}
