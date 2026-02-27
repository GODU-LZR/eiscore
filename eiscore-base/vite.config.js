import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

const ideProxyTarget = process.env.VITE_FLASH_IDE_PROXY_TARGET || 'http://localhost:8443'

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
          rawPath.startsWith('/apps') ||
          rawPath.startsWith('/mobile')
        const isAppsDraftPreview =
          rawPath === '/apps/preview/flash-draft' ||
          rawPath.startsWith('/apps/preview/')
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
          req.headers['sec-fetch-mode'] === 'navigate'

        // For deep-link refresh, always serve host index.html first so Vue Router + qiankun can mount.
        // Sub-app assets/HMR still proxy via /materials|/hr|/apps prefixed asset paths.
        // Keep flash draft preview out of host-shell rewrite: it must load pure apps sub-app page.
        // /mobile is a standalone SPA — let it pass through to its own dev server directly.
        const isMobileRoute = rawPath.startsWith('/mobile')
        if (isMicroRoute && isDocumentNav && !isDevAsset && !isAppsDraftPreview && !isMobileRoute) {
          req.url = '/'
          next()
          return
        }

        const redirectMap = {
          '/apps': '/apps/',
          '/hr': '/hr/',
          '/materials': '/materials/',
          '/mobile': '/mobile/'
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
      '/agent': {
        target: 'http://localhost:8078',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/agent/, ''),
        ws: true
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
          const isDocument =
            req.headers['sec-fetch-dest'] === 'document' ||
            req.headers['sec-fetch-mode'] === 'navigate'
          return isDocument ? '/index.html' : undefined
        }
      },
      '/materials': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        ws: true,
        bypass: (req) => {
          const isDocument =
            req.headers['sec-fetch-dest'] === 'document' ||
            req.headers['sec-fetch-mode'] === 'navigate'
          return isDocument ? '/index.html' : undefined
        }
      },
      '/apps': {
        target: 'http://localhost:8083',
        changeOrigin: true,
        ws: true,
        bypass: (req) => {
          const rawPath = (req.url || '').split('?')[0]
          const isPreview =
            rawPath === '/apps/preview/flash-draft' ||
            rawPath.startsWith('/apps/preview/')
          if (isPreview) return undefined
          const isDocument =
            req.headers['sec-fetch-dest'] === 'document' ||
            req.headers['sec-fetch-mode'] === 'navigate'
          return isDocument ? '/index.html' : undefined
        }
      },
      '/flash-preview': {
        target: 'http://localhost:8083',
        changeOrigin: true,
        ws: true,
        rewrite: (path) => path.replace(/^\/flash-preview/, '')
      },
      '/ide': {
        target: ideProxyTarget,
        // Keep original host so code-server's WS origin/host check passes.
        // If host is rewritten to :8443, WS handshake from :8080 gets 403/1006.
        changeOrigin: false,
        secure: false,
        ws: true,
        rewrite: (path) => path.replace(/^\/ide/, '')
      },
      '/mobile': {
        target: 'http://localhost:8084',
        changeOrigin: true,
        ws: true,
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
