// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { defineConfig, devices } from '@playwright/test'

const baseURL = (process.env.EISCORE_E2E_BASE_URL || process.env.EISCORE_BASE_URL || 'http://localhost:8080')
  .replace(/\/+$/, '')
const isRemoteTarget = !/^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(baseURL)
const configuredRetries = process.env.EISCORE_E2E_RETRIES
const configuredWorkers = process.env.EISCORE_E2E_WORKERS
const retries = configuredRetries === undefined ? (isRemoteTarget ? 1 : 0) : Number(configuredRetries)
const workers = configuredWorkers === undefined ? (isRemoteTarget ? 1 : undefined) : Number(configuredWorkers)

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: {
    timeout: 15_000
  },
  retries,
  workers,
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
