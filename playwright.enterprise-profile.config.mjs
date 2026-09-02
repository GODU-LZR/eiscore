// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { defineConfig } from '@playwright/test'
import baseConfig from './playwright.config.mjs'

const hostUrl = 'http://127.0.0.1:18000'
const companySiteUrl = 'http://127.0.0.1:8092'

export default defineConfig({
  ...baseConfig,
  testMatch: 'enterprise-profile-merge.spec.mjs',
  timeout: 90_000,
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests/.artifacts/enterprise-profile-playwright-report', open: 'never' }],
    ['json', { outputFile: 'tests/.artifacts/enterprise-profile-playwright-result.json' }]
  ],
  outputDir: 'tests/.artifacts/enterprise-profile-playwright-results',
  use: {
    ...baseConfig.use,
    baseURL: hostUrl,
    video: 'off'
  },
  webServer: [
    {
      command: 'npm --prefix eiscore-base run dev -- --host 127.0.0.1 --port 18000 --strictPort',
      url: `${hostUrl}/settings`,
      timeout: 120_000,
      reuseExistingServer: false
    },
    {
      command: 'npm --prefix eiscore-company-site run dev -- --host 127.0.0.1 --port 8092 --strictPort',
      url: `${companySiteUrl}/company-site/index.html`,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        VITE_DEV_CORS_ORIGIN: hostUrl
      }
    }
  ]
})
