import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

// Vant 组件按需引入（通过 unplugin-vue-components 自动注册）
// 这里只需要引入全局样式
import 'vant/lib/index.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
