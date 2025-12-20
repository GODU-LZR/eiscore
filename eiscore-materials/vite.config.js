import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import qiankun from 'vite-plugin-qiankun' // 引入插件

export default defineConfig({
  plugins: [
    vue(),
    // 👇 这里必须和基座 apps.js 里的 name 一致
    qiankun('eiscore-materials', {
      useDevMode: true
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  server: {
    port: 8081, // 👈 端口 8081
    headers: {
      'Access-Control-Allow-Origin': '*' // 允许基座跨域加载
    }
  }
})