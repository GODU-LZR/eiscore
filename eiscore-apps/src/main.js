import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { createPinia } from 'pinia'
import {
  renderWithQiankun,
  qiankunWindow
} from 'vite-plugin-qiankun/dist/helper'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'

import App from './App.vue'
import routes from './router'

let app = null
let router = null
let history = null

function render(props = {}) {
  const { container } = props
  const pinia = createPinia()

  history = createWebHistory(
    qiankunWindow.__POWERED_BY_QIANKUN__ ? '/apps/' : '/'
  )
  router = createRouter({
    history,
    routes
  })

  app = createApp(App)

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
  app.mount(containerEl)
}

renderWithQiankun({
  mount(props) {
    render(props)
  },
  bootstrap() {},
  unmount() {
    app?.unmount()
  },
  update() {}
})

if (!qiankunWindow.__POWERED_BY_QIANKUN__) {
  render()
}
