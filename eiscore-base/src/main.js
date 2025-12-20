import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

// 👇 1. 引入注册函数
import { registerQiankun } from './micro'

const app = createApp(App)

app.use(router)
app.use(ElementPlus)

app.mount('#app')

// 👇 2. 启动微前端
registerQiankun()