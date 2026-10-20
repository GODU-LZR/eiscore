// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import qiankun from 'vite-plugin-qiankun'
import { createBuildOptions } from '../scripts/vite-build-config.mjs'
import { loadViteDevProxyTargets } from '../scripts/vite-dev-proxy-config.mjs'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const allowedOrigins = (env.VITE_DEV_CORS_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  const proxyTargets = loadViteDevProxyTargets(env)

  return {
    base: '/company-site/',
    plugins: [
      vue(),
      qiankun('eiscore-company-site', { useDevMode: true })
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@shared': fileURLToPath(new URL('../shared', import.meta.url))
      }
    },
    server: {
      port: 8095,
      host: true,
      hmr: false,
      cors: {
        origin: allowedOrigins.length ? allowedOrigins : ['http://localhost:8080']
      },
      fs: {
        allow: ['..']
      },
      proxy: {
        // Keep the company-site login and Harness embed same-origin during
        // local testing. The shared Nginx gateway owns the Harness Web/API
        // routes and their auth handoff contract.
        '/harness-embed-api': {
          target: 'http://127.0.0.1:80',
          changeOrigin: false,
          ws: true
        },
        '/harness-embed-assets': {
          target: 'http://127.0.0.1:80',
          changeOrigin: false
        },
        '/harness-embed-plugins': {
          target: 'http://127.0.0.1:80',
          changeOrigin: false,
          ws: true
        },
        '/harness-embed': {
          target: 'http://127.0.0.1:80',
          changeOrigin: false,
          ws: true
        },
        '/company-site/auth': {
          target: proxyTargets.agent,
          changeOrigin: true,
          ws: true
        },
        '/api': {
          target: proxyTargets.api,
          changeOrigin: true,
          rewrite: (path) => (
            path
              .replace(/^\/api\/workflow\.definitions\b/, '/api/definitions')
              .replace(/^\/api\/workflow\.instances\b/, '/api/instances')
              .replace(/^\/api/, '')
          )
        },
        '/agent/company-site/public': {
          target: env.VITE_COMPANY_SITE_PLATFORM_URL || 'http://127.0.0.1:8080',
          changeOrigin: true,
          rewrite: (path) => path
        },
        '/agent': {
          target: proxyTargets.agent,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/agent/, ''),
          ws: true
        },
        '/company-site/agent': {
          target: proxyTargets.agent,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/company-site\/agent/, ''),
          ws: true
        },
        ...(env.VITE_COMPANY_SITE_PLATFORM_URL ? {
          '^/(?!company-site(?:/|$))': {
            target: env.VITE_COMPANY_SITE_PLATFORM_URL,
            changeOrigin: true,
            ws: true
          }
        } : {})
      }
    },
    build: createBuildOptions()
  }
})
