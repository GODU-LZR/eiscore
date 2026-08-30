// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const readSource = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const directSessionPattern = /localStorage\.(?:getItem|setItem|removeItem)\(\s*['"](?:auth_token|user_info)['"]/

const authAdapter = readSource('eiscore-base/src/utils/auth.js')
for (const name of ['USER_INFO_KEY', 'getUserInfoText', 'setUserInfo']) {
  assert.match(authAdapter, new RegExp(`\\b${name}\\b`))
}

const layout = readSource('eiscore-base/src/layout/index.vue')
for (const name of [
  'USER_INFO_KEY',
  'getAuthHeader',
  'getToken',
  'getUserInfo',
  'getUserInfoText',
  'parseJwtPayload',
  'setUserInfo'
]) {
  assert.match(layout, new RegExp(`\\b${name}\\b`))
}
assert.match(layout, /event\.key\s*!==\s*USER_INFO_KEY/)
assert.match(layout, /lastUserInfoStr\s*=\s*getUserInfoText\(\)/)
assert.match(layout, /const current\s*=\s*getUserInfoText\(\)/)
assert.doesNotMatch(layout, directSessionPattern)
assert.doesNotMatch(layout, /\batob\b/)

const permission = readSource('eiscore-base/src/utils/permission.js')
assert.match(permission, /import\s*\{\s*getUserInfo\s*\}\s*from\s*['"]@\/utils\/auth['"]/)
assert.doesNotMatch(permission, /\blocalStorage\b/)
assert.doesNotMatch(permission, /JSON\.parse/)

console.log('PASS: host layout and permission session migration')
