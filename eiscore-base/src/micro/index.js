import { registerMicroApps, start, initGlobalState } from 'qiankun'
import apps from './apps'
import { aiBridge } from '@/utils/ai-bridge' 

/**
 * 初始化微前端架构
 * 包含：子应用注册、全局状态管理、AI通信桥接
 */
export function registerQiankun() {
  // 1. 注册子应用
  registerMicroApps(apps, {
    beforeLoad: app => {
      console.log('before load app.name====>>>>>', app.name)
    },
    beforeMount: [
      app => {
        console.log('[LifeCycle] before mount %c%s', 'color: green;', app.name)
      }
    ],
    afterMount: [
      app => {
        console.log('[LifeCycle] after mount %c%s', 'color: green;', app.name)
      }
    ],
    afterUnmount: [
      app => {
        console.log('[LifeCycle] after unmount %c%s', 'color: green;', app.name)
      }
    ]
  })

  // 2. 初始化全局状态 (Global AI Bus 的核心通道)
  // 初始状态包含 user 信息和 context (AI 上下文)
  const actions = initGlobalState({
    user: 'admin', 
    context: null  // 用于子应用上报页面信息给 AI
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
    // console.log('[Base] Global State Change:', state, prev)
  })

  // 4. 启动 Qiankun
  start({
    sandbox: {
      experimentalStyleIsolation: true
    }
  })
}