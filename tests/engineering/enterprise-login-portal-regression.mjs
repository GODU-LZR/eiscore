// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')

const loginView = read('eiscore-base/src/views/LoginView.vue')
const baseVite = read('eiscore-base/vite.config.js')
const previewPlugin = read('scripts/vite-enterprise-preview.mjs')

for (const marker of [
  'publicProducts',
  'publicSolutions',
  'id="products"',
  'id="solutions"',
  'class="login-form"',
  'v-if="loginVisible"',
  '@click="focusLogin"',
  "route.query.login === '1'",
  'safeRedirect.startsWith(\'/mobile/\')'
]) {
  assert.ok(loginView.includes(marker), `login portal integration lost ${marker}`)
}

assert.match(baseVite, /enterprisePreviewPlugin\(process\.env\.VITE_ENTERPRISE_PREVIEW_PACK\)/)
assert.match(previewPlugin, /apply:\s*'serve'/)
assert.match(previewPlugin, /\/agent\/company-site\/public\/site-config/)
assert.match(previewPlugin, /\/enterprise-assets\//)
assert.match(previewPlugin, /productionApproved/)

const baseRouter = read('eiscore-base/src/router/index.js')
assert.match(baseRouter, /path === '\/login'/)
assert.match(baseRouter, /safeRedirect\.startsWith\('\/mobile\/'\)/)

const mobileRouter = read('eiscore-mobile/src/router/index.js')
assert.match(mobileRouter, /to\.name === 'login'/)
assert.match(mobileRouter, /redirectToEnterpriseLogin\(`\/mobile\$\{to\.fullPath\}`\)/)

const customerHardcodePattern = /广东南派|热带水果|faiusr\.com|海边姑娘|NANPAI/i
for (const path of [
  'eiscore-base/src/views/LoginView.vue',
  'packages/eiscore-platform/src/enterprise-profile.mjs',
  'scripts/vite-enterprise-preview.mjs'
]) {
  assert.doesNotMatch(read(path), customerHardcodePattern, `${path} must remain enterprise-neutral`)
}

console.log('PASS: published company-site content is integrated into the login portal')
