import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { renderWithQiankun, qiankunWindow } from 'vite-plugin-qiankun/dist/helper'

// 🟢 1. 引入 Element Plus 及其样式
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
// 引入中文语言包 (可选，推荐)
import zhCn from 'element-plus/es/locale/lang/zh-cn'
// 引入图标 (如果用到了 Icon)
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
// BPMN 样式与字体（用于部门架构图）
import 'bpmn-js/dist/assets/diagram-js.css'
import 'bpmn-js/dist/assets/bpmn-js.css'
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css'

let app

function render(props = {}) {
  const { container } = props
  app = createApp(App)

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

  const target = container ? container.querySelector('#app') : '#app'
  app.mount(target)
}

renderWithQiankun({
  mount(props) {
    console.log('[HR] mounted')
    render(props)
  },
  bootstrap() {
    console.log('[HR] bootstrap')
  },
  unmount(props) {
    console.log('[HR] unmount')
    app.unmount()
  },
  update(props) {
    console.log('[HR] update', props)
  }
})

if (!qiankunWindow.__POWERED_BY_QIANKUN__) {
  render()
}
