// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { defineConfig, devices } from '@playwright/test'

const baseURL = (process.env.EISCORE_E2E_BASE_URL || process.env.EISCORE_BASE_URL || 'http://localhost:8080')
  .replace(/\/+$/, '')

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 15_000
  },
  fullyParallel: false,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'tests/.artifacts/playwright-report', open: 'never' }],
    ['json', { outputFile: 'tests/.artifacts/playwright-result.json' }]
  ],
  outputDir: 'tests/.artifacts/playwright-results',
  use: {
    baseURL,
    viewport: { width: 1440, height: 900 },
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
})
