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
        if (req.url === '/apps' || req.url?.startsWith('/apps?')) {
          res.statusCode = 302
          res.setHeader('Location', '/apps/')
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
      
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)), // 🟢 修复：这里加了逗号
      'vue': 'vue/dist/vue.esm-bundler.js'
    },
  },
})
