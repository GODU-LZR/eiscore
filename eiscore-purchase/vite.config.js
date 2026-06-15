// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import qiankun from 'vite-plugin-qiankun'
import { createBuildOptions } from '../scripts/vite-build-config.mjs'

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
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        '@shared': fileURLToPath(new URL('../shared', import.meta.url))
      }
    },
    server: {
      port: 8088,
      host: true,
      hmr: false,
      cors: {
        origin: allowedOrigins.length ? allowedOrigins : ['http://localhost:8080']
      },
      fs: {
        allow: ['..']
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
        '/purchase/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          rewrite: (path) => (
            path
              .replace(/^\/purchase\/api\/workflow\.definitions\b/, '/api/definitions')
              .replace(/^\/purchase\/api\/workflow\.instances\b/, '/api/instances')
              .replace(/^\/purchase\/api/, '')
          )
        },
        '/agent': {
          target: 'http://localhost:8078',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/agent/, ''),
          ws: true
        },
        '/purchase/agent': {
          target: 'http://localhost:8078',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/purchase\/agent/, ''),
          ws: true
        }
      }
    },
    build: createBuildOptions()
  }
})
