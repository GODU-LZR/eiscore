import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)), // 🟢 修复：这里加了逗号
      'vue': 'vue/dist/vue.esm-bundler.js'
    },
  },
  server: {
    port: 8080,       // 基座运行在 8080 (Swagger 之前已经改到 8079 了，不会冲突)
    host: '0.0.0.0',  // 允许局域网访问
    cors: true,
    proxy: {
      // 🟢 代理配置：让开发环境也能访问后端 API
      // 前端请求 /api/xxx -> 转发给 http://localhost:3000/xxx (PostgREST)
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '') 
      },
      // 🟢 单独代理 /rpc 用于登录函数 (PostgREST 的函数调用路径)
      '/rpc': {
        target: 'http://localhost:3000/rpc',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rpc/, '')
      }
    }
  }
})