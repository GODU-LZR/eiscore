// src/main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia' // 👈 引入
import App from './App.vue'
import router from './router'

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
// 👇👇👇 必须补上这一行！这是暗黑模式的变量定义 👇👇👇
import 'element-plus/theme-chalk/dark/css-vars.css'

import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import { registerQiankun } from './micro'

const app = createApp(App)

app.use(createPinia()) // 👈 挂载 Pinia
app.use(router)
app.use(ElementPlus)
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, component)
}

app.mount('#app')
registerQiankun()