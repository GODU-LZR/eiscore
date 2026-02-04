import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import qiankun from 'vite-plugin-qiankun'

const useDevMode = true

const redirectRootPlugin = () => ({
  name: 'redirect-root-to-apps',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url === '/' || req.url === '/index.html') {
        res.statusCode = 302
        res.setHeader('Location', '/apps/')
        res.end()
        return
      }
      next()
    })
  }
})

export default defineConfig({
  base: '/apps/',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('../shared', import.meta.url))
    }
  },
  plugins: [
    vue(),
    qiankun('eiscore-apps', { useDevMode }),
    redirectRootPlugin()
  ],
  server: {
    port: 8083,
    host: true,
    cors: {
      origin: true,
      credentials: true
    },
    headers: {
      'Access-Control-Allow-Origin': 'http://localhost:8080',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Credentials': 'true',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    }
  },
  build: {
    target: 'es2015',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
})
