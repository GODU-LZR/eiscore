import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import qiankun from 'vite-plugin-qiankun'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const allowedOrigins = (env.VITE_DEV_CORS_ORIGIN || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean)

  return {
    base: '/purchase/',
    plugins: [
      vue(),
      qiankun('eiscore-purchase', { useDevMode: true })
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    },
    server: {
      port: 8088,
      cors: {
        origin: allowedOrigins.length ? allowedOrigins : ['http://localhost:8080']
      }
    }
  }
})
