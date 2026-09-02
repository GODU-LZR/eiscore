// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import qiankun from 'vite-plugin-qiankun'
import { createBuildOptions } from '../scripts/vite-build-config.mjs'
import { sharedFrontendDedupe } from '../scripts/vite-shared-source-config.mjs'
import { loadViteDevProxyTargets } from '../scripts/vite-dev-proxy-config.mjs'

const useDevMode = true
const devProxyTargets = loadViteDevProxyTargets()
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
      dedupe: sharedFrontendDedupe,
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
    host: '127.0.0.1',
    watch: enablePollingWatch
      ? {
        usePolling: true,
        interval: Number(process.env.VITE_FLASH_WATCH_POLLING_INTERVAL || 220)
      }
      : undefined,
    // Child-app HMR shares Vue's global HMR runtime inside the qiankun host.
    // Disable it to avoid stale runtime maps when switching/unmounting micro apps.
    hmr: false,
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
    },
    proxy: {
      '/api': {
        target: devProxyTargets.api,
        changeOrigin: true,
        rewrite: (path) => (
          path
            .replace(/^\/api\/workflow\.definitions\b/, '/api/definitions')
            .replace(/^\/api\/workflow\.instances\b/, '/api/instances')
            .replace(/^\/api/, '')
        )
      },
      '/agent': {
        target: devProxyTargets.agent,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/agent/, ''),
        ws: true
      }
    }
  },
  build: createBuildOptions({
    target: 'es2015',
    cssCodeSplit: true
  })
})
