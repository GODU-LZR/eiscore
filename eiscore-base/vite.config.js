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
  server: {
    port: 8080,
    host: '0.0.0.0',
    cors: true,
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const rawPath = req.url ? req.url.split('?')[0] : ''
        const isMicroRoute =
          rawPath.startsWith('/materials') ||
          rawPath.startsWith('/hr') ||
          rawPath.startsWith('/apps')
        const isDevAsset =
          rawPath.includes('/@vite') ||
          rawPath.includes('/src/') ||
          rawPath.includes('/node_modules/') ||
          rawPath.includes('/@id/') ||
          rawPath.includes('/@fs/') ||
          rawPath.endsWith('/favicon.ico') ||
          rawPath.includes('/__vite_ping')
        const isDocumentNav =
          req.headers['sec-fetch-dest'] === 'document' ||
          String(req.headers.accept || '').includes('text/html')

        // For deep-link refresh, always serve host index.html first so Vue Router + qiankun can mount.
        // Sub-app assets/HMR still proxy via /materials|/hr|/apps prefixed asset paths.
        if (isMicroRoute && isDocumentNav && !isDevAsset) {
          req.url = '/'
          next()
          return
        }

        const redirectMap = {
          '/apps': '/apps/',
          '/hr': '/hr/',
          '/materials': '/materials/'
        }
        const target = redirectMap[rawPath]
        if (target) {
          res.statusCode = 302
          res.setHeader('Location', target)
          res.end()
          return
        }
        next()
      })
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => (
          path
            .replace(/^\/api\/workflow\.definitions\b/, '/api/definitions')
            .replace(/^\/api\/workflow\.instances\b/, '/api/instances')
            .replace(/^\/api/, '')
        )
      },
      '/rpc': {
        target: 'http://localhost:3000/rpc',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/rpc/, '')
      },
      '/hr': {
        target: 'http://localhost:8082',
        changeOrigin: true,
        ws: true,
        bypass: (req) => {
          const accept = String(req.headers.accept || '')
          const isDocument = req.headers['sec-fetch-dest'] === 'document' || accept.includes('text/html')
          return isDocument ? '/index.html' : undefined
        }
      },
      '/materials': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        ws: true,
        bypass: (req) => {
          const accept = String(req.headers.accept || '')
          const isDocument = req.headers['sec-fetch-dest'] === 'document' || accept.includes('text/html')
          return isDocument ? '/index.html' : undefined
        }
      },
      '/apps': {
        target: 'http://localhost:8083',
        changeOrigin: true,
        ws: true,
        bypass: (req) => {
          const accept = String(req.headers.accept || '')
          const isDocument = req.headers['sec-fetch-dest'] === 'document' || accept.includes('text/html')
          return isDocument ? '/index.html' : undefined
        }
      },
      
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)), // 🟢 修复：这里加了逗号
      'vue': 'vue/dist/vue.esm-bundler.js'
    },
  },
})
