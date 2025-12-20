import { createApp } from 'vue'
import App from './App.vue'
import { renderWithQiankun, qiankunWindow } from 'vite-plugin-qiankun/dist/helper'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

let app = null

// 封装渲染函数
function render(props = {}) {
  const { container } = props
  app = createApp(App)
  app.use(ElementPlus)
  // 如果在基座里，挂载到 container 内部；否则挂载到 #app
  const mountPoint = container ? container.querySelector('#app') : '#app'
  app.mount(mountPoint)
}

// 核心：导出生命周期
renderWithQiankun({
  bootstrap() { console.log('[hr] bootstrap') },
  mount(props) {
    console.log('[hr] mount')
    render(props)
  },
  unmount() {
    console.log('[hr] unmount')
    app.unmount()
    app = null
  },
  update() {}
})

// 独立运行时逻辑
if (!qiankunWindow.__POWERED_BY_QIANKUN__) {
  render()
}