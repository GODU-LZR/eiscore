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
      '@': fileURLToPath(new URL('./src', import.meta.url))
      'vue': 'vue/dist/vue.esm-bundler.js'
    },
  },
  // 👇 核心修改在这里
  server: {
    port: 8080, // 强制指定端口 8080
    host: '0.0.0.0', // 允许局域网访问
    cors: true,
    proxy: {
      // 代理配置：凡是发往 /api 的请求，都转给 PostgREST (端口3000)
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '') // 去掉 /api 前缀
      },
      // 单独代理 /rpc 用于登录函数
      '/rpc': {
        target: 'http://localhost:3000/rpc',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rpc/, '')
      }
    }
  }
})