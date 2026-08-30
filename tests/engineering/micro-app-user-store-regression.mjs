// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const apps = ['apps', 'hr', 'materials', 'sales', 'purchase', 'production', 'quality', 'equipment']

for (const app of apps) {
  const authSource = readFileSync(resolve(repoRoot, `eiscore-${app}/src/utils/auth.js`), 'utf8')
  const storeSource = readFileSync(resolve(repoRoot, `eiscore-${app}/src/stores/user.js`), 'utf8')
  assert.match(authSource, /export const getUserInfo = \(\) => authSession\.getUserInfo\(\)/)
  assert.match(authSource, /export const setUserInfo = \(userInfo\) => authSession\.setUserInfo\(userInfo\)/)
  assert.match(storeSource, /getUserInfo/)
  assert.match(storeSource, /setUserInfo as persistUserInfo/)
  assert.match(storeSource, /const userInfo = ref\(getUserInfo\(\) \|\| \{\}\)/)
  assert.match(storeSource, /persistUserInfo\(userInfo\.value\)/)
  assert.doesNotMatch(storeSource, /localStorage|JSON\.parse|JSON\.stringify/)
}

console.log(`PASS: micro-app user stores use platform session (${apps.length} applications)`)
