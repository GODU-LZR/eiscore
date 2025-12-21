import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { renderWithQiankun, qiankunWindow } from 'vite-plugin-qiankun/dist/helper'

let app

// 封装 render 函数
function render(props = {}) {
  const { container } = props
  app = createApp(App)
  
  app.use(createPinia())
  app.use(router)

  // 注册权限指令 (鉴权逻辑)
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

// 初始化 qiankun
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

// 独立运行时直接渲染
if (!qiankunWindow.__POWERED_BY_QIANKUN__) {
  render()
}