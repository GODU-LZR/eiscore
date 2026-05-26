import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import { renderWithQiankun, qiankunWindow } from 'vite-plugin-qiankun/dist/helper'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

const MICRO_APP_NAME = 'eiscore-sales'

let app = null
let themeObserver = null

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
  app = createApp(App)

  if (props && typeof props.setGlobalState === 'function') {
    window.__EIS_BASE_ACTIONS__ = props
  }

  app.use(ElementPlus, { locale: zhCn })
  app.use(router)

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

const lifecycle = {
  bootstrap() { console.log('[sales] bootstrap') },
  mount(props) {
    console.log('[sales] mount')
    render(props)
  },
  unmount() {
    console.log('[sales] unmount')
    app.unmount()
    app = null
    if (themeObserver) {
      themeObserver.disconnect()
      themeObserver = null
    }
  },
  update() {}
}

renderWithQiankun(lifecycle)
ensureQiankunLifecycleBucket(lifecycle)

if (!isRunningInQiankun()) {
  render()
}
