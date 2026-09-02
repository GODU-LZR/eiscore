// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { defineConfig } from '@playwright/test'
import baseConfig from './playwright.config.mjs'

const required = (name) => {
  const value = String(process.env[name] || '').trim()
  if (!value) throw new Error(`${name} is required for the destructive full-stack test`)
  return value
}

const baseURL = required('EISCORE_E2E_FULL_STACK_BASE_URL').replace(/\/+$/, '')
const parsedBaseURL = new URL(baseURL)
const isolatedProject = required('EISCORE_E2E_ISOLATED_PROJECT')
const dbContainer = required('EISCORE_E2E_DB_CONTAINER')
const loopbackHosts = new Set(['localhost', '127.0.0.1', '[::1]'])

if (!['http:', 'https:'].includes(parsedBaseURL.protocol) || !loopbackHosts.has(parsedBaseURL.hostname)) {
  throw new Error('EISCORE_E2E_FULL_STACK_BASE_URL must target localhost, 127.0.0.1 or [::1]')
}
if (isolatedProject !== 'eiscore-g35') {
  throw new Error('EISCORE_E2E_ISOLATED_PROJECT must explicitly equal eiscore-g35')
}
if (dbContainer !== `${isolatedProject}-db`) {
  throw new Error('EISCORE_E2E_DB_CONTAINER must be the isolated project database container')
}
required('EISCORE_E2E_ADMIN_USERNAME')
required('EISCORE_E2E_ADMIN_PASSWORD')

export default defineConfig({
  ...baseConfig,
  testDir: './tests/full-stack-e2e',
  testMatch: 'enterprise-profile-merge.spec.mjs',
  timeout: 120_000,
  workers: 1,
  retries: 0,
  fullyParallel: false,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests/.artifacts/enterprise-profile-full-stack-report', open: 'never' }],
    ['json', { outputFile: 'tests/.artifacts/enterprise-profile-full-stack-result.json' }]
  ],
  outputDir: 'tests/.artifacts/enterprise-profile-full-stack-results',
  use: {
    ...baseConfig.use,
    baseURL,
    video: 'off'
  },
  webServer: [
    {
      command: `npm --prefix eiscore-base run dev -- --host ${parsedBaseURL.hostname} --port ${parsedBaseURL.port} --strictPort`,
      url: `${baseURL}/settings`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        VITE_DEV_API_PROXY_TARGET: 'http://127.0.0.1:13000',
        VITE_DEV_AGENT_PROXY_TARGET: 'http://127.0.0.1:18078',
        VITE_FLASH_IDE_PROXY_TARGET: 'http://127.0.0.1:18443'
      }
    },
    {
      command: 'npm --prefix eiscore-company-site run dev -- --host 127.0.0.1 --port 8092 --strictPort',
      url: 'http://127.0.0.1:8092/company-site/index.html',
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        VITE_DEV_CORS_ORIGIN: baseURL
      }
    }
  ]
})
