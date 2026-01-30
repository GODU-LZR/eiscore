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

let app = null
let themeObserver = null

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

  const mountPoint = container ? container.querySelector('#app') : document.querySelector('#app')
  if (mountPoint) {
    const syncTheme = () => {
      mountPoint.classList.toggle('dark', document.documentElement.classList.contains('dark'))
    }
    syncTheme()
    themeObserver = new MutationObserver(syncTheme)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  }
  app.mount(mountPoint || '#app')
}

renderWithQiankun({
  bootstrap() { console.log('[materials] bootstrap') },
  mount(props) {
    console.log('[materials] mount')
    render(props)
  },
  unmount() {
    console.log('[materials] unmount')
    app.unmount()
    app = null
    if (themeObserver) {
      themeObserver.disconnect()
      themeObserver = null
    }
  },
  update() {}
})

if (!qiankunWindow.__POWERED_BY_QIANKUN__) {
  render()
}
