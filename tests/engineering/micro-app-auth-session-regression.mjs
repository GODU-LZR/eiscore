// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const fullAuthAdapters = [
  'eiscore-apps',
  'eiscore-hr',
  'eiscore-materials',
  'eiscore-sales',
  'eiscore-purchase',
  'eiscore-production'
]
const minimalAuthAdapters = ['eiscore-quality', 'eiscore-equipment']
const allMicroApps = [...fullAuthAdapters, ...minimalAuthAdapters]

for (const app of allMicroApps) {
  const sourcePath = `${app}/src/utils/auth.js`
  const source = readFileSync(resolve(repoRoot, sourcePath), 'utf8')
  const manifest = JSON.parse(readFileSync(resolve(repoRoot, app, 'package.json'), 'utf8'))
  const lock = JSON.parse(readFileSync(resolve(repoRoot, app, 'package-lock.json'), 'utf8'))

  assert.match(source, /@eiscore\/platform\/auth-session/, `${sourcePath} must adapt the platform session`)
  assert.doesNotMatch(source, /\blocalStorage\b/, `${sourcePath} must not access browser storage directly`)
  assert.doesNotMatch(source, /\batob\b/, `${sourcePath} must not decode JWT independently`)
  assert.match(source, /loginPath\s*=\s*['"]\/login['"]/, `${sourcePath} must preserve its login route`)
  assert.equal(manifest.dependencies?.['@eiscore/platform'], 'file:../packages/eiscore-platform')
  assert.equal(lock.packages?.['']?.dependencies?.['@eiscore/platform'], 'file:../packages/eiscore-platform')
  assert.equal(lock.packages?.['node_modules/@eiscore/platform']?.resolved, '../packages/eiscore-platform')
}

for (const app of fullAuthAdapters) {
  const source = readFileSync(resolve(repoRoot, app, 'src/utils/auth.js'), 'utf8')
  for (const exportedName of [
    'parseStoredToken',
    'getToken',
    'getAuthHeader',
    'parseJwtPayload',
    'isTokenExpired',
    'clearAuthStorage',
    'redirectToLogin',
    'clearAuthAndRedirect'
  ]) {
    const exportPattern = new RegExp(`export (?:const\\s+${exportedName}\\b|\\{[^}]*\\b${exportedName}\\b)`)
    assert.match(source, exportPattern, `${app} must preserve ${exportedName}`)
  }
}

for (const app of minimalAuthAdapters) {
  const source = readFileSync(resolve(repoRoot, app, 'src/utils/auth.js'), 'utf8')
  for (const exportedName of ['parseStoredToken', 'getToken', 'clearAuthStorage', 'clearAuthAndRedirect']) {
    const exportPattern = new RegExp(`export (?:const\\s+${exportedName}\\b|\\{[^}]*\\b${exportedName}\\b)`)
    assert.match(source, exportPattern, `${app} must preserve ${exportedName}`)
  }
}

console.log(`PASS: micro-app auth session migration (${allMicroApps.length} applications)`)
