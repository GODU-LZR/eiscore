// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

const repoRoot = dirname(fileURLToPath(import.meta.url))
const playwrightLibPath = resolve(repoRoot, 'tests/.artifacts/playwright-libs/root/usr/lib/x86_64-linux-gnu')

if (existsSync(playwrightLibPath)) {
  process.env.LD_LIBRARY_PATH = process.env.LD_LIBRARY_PATH
    ? `${playwrightLibPath}:${process.env.LD_LIBRARY_PATH}`
    : playwrightLibPath
}

const baseURL = (process.env.EISCORE_E2E_BASE_URL || process.env.EISCORE_BASE_URL || 'http://localhost:8080')
  .replace(/\/+$/, '')
const isRemoteTarget = !/^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(baseURL)
const configuredRetries = process.env.EISCORE_E2E_RETRIES
const configuredWorkers = process.env.EISCORE_E2E_WORKERS
const retries = configuredRetries === undefined ? (isRemoteTarget ? 1 : 0) : Number(configuredRetries)
const workers = configuredWorkers === undefined ? (isRemoteTarget ? 1 : undefined) : Number(configuredWorkers)
const chromiumExecutablePath = String(process.env.EISCORE_E2E_CHROMIUM_EXECUTABLE_PATH || '').trim()
const video = process.env.EISCORE_E2E_VIDEO || (chromiumExecutablePath ? 'off' : 'retain-on-failure')
const chromiumProjectUse = { ...devices['Desktop Chrome'] }
if (chromiumExecutablePath) {
  chromiumProjectUse.launchOptions = {
    ...(chromiumProjectUse.launchOptions || {}),
    executablePath: chromiumExecutablePath
  }
}

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
    video
  },
  projects: [
    {
      name: 'chromium',
      use: chromiumProjectUse
    }
  ]
})
