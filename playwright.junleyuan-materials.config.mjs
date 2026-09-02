// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { defineConfig } from '@playwright/test'
import baseConfig from './playwright.config.mjs'

const companySiteUrl = 'http://127.0.0.1:8092'

export default defineConfig({
  ...baseConfig,
  testMatch: 'junleyuan-materials.spec.mjs',
  workers: 1,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests/.artifacts/junleyuan-materials-playwright-report', open: 'never' }],
    ['json', { outputFile: 'tests/.artifacts/junleyuan-materials-playwright-result.json' }]
  ],
  outputDir: 'tests/.artifacts/junleyuan-materials-playwright-results',
  use: {
    ...baseConfig.use,
    baseURL: companySiteUrl,
    video: 'off'
  },
  webServer: {
    command: 'npm --prefix eiscore-company-site run dev -- --host 127.0.0.1 --port 8092 --strictPort',
    url: `${companySiteUrl}/company-site/`,
    timeout: 120_000,
    reuseExistingServer: false
  }
})
