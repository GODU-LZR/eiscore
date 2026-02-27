import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import qiankun from 'vite-plugin-qiankun'

const useDevMode = true
const enablePollingWatch = String(process.env.VITE_FLASH_WATCH_POLLING || 'true').toLowerCase() !== 'false'

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
    watch: enablePollingWatch
      ? {
        usePolling: true,
        interval: Number(process.env.VITE_FLASH_WATCH_POLLING_INTERVAL || 220)
      }
      : undefined,
    hmr: {
      // In iframe/srcdoc preview, Vite's built-in overlay can throw "Illegal constructor".
      // Keep HMR active but suppress overlay to avoid breaking Flash preview rendering.
      overlay: false
    },
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
