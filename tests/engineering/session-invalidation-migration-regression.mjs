// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const readSource = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const directSessionPattern = /localStorage\.(?:getItem|setItem|removeItem)\(\s*['"](?:auth_token|user_info)['"]/

const baseMain = readSource('eiscore-base/src/main.js')
assert.match(baseMain, /import\s*\{\s*clearAuthAndRedirect\s*\}\s*from\s*['"]@\/utils\/auth['"]/)
assert.match(baseMain, /response\.status\s*===\s*401/)
assert.match(baseMain, /clearAuthAndRedirect\(['"]\/login['"]\)/)
assert.doesNotMatch(baseMain, directSessionPattern)

const mobileRouter = readSource('eiscore-mobile/src/router/index.js')
assert.match(mobileRouter, /from\s*['"]@\/utils\/auth['"]/)
for (const name of ['getToken', 'parseJwt', 'clearAuth']) assert.match(mobileRouter, new RegExp(`\\b${name}\\b`))
assert.match(mobileRouter, /query:\s*\{\s*redirect:\s*to\.fullPath\s*\}/)
assert.match(mobileRouter, /const payload = parseJwt\(token\)/)
assert.match(mobileRouter, /payload\.exp\s*&&\s*Date\.now\(\)\s*\/\s*1000\s*>=\s*payload\.exp/)
assert.doesNotMatch(mobileRouter, directSessionPattern)
assert.doesNotMatch(mobileRouter, /\batob\b/)

for (const path of [
  'eiscore-mobile/src/api/warehouse.js',
  'eiscore-mobile/src/api/stock.js',
  'eiscore-mobile/src/api/attendance.js',
  'eiscore-mobile/src/api/check.js'
]) {
  const source = readSource(path)
  assert.match(source, /from\s*['"]@\/utils\/auth['"]/)
  assert.match(source, /\bgetToken\b/)
  assert.match(source, /\bclearAuth\b/)
  assert.match(source, /res\.status\s*===\s*401/)
  assert.match(source, /clearAuth\(\)/)
  assert.match(source, /window\.location\.href\s*=\s*['"]\/mobile\/login['"]/)
  assert.match(source, /throw new Error\(['"]登录已过期['"]\)/)
  assert.doesNotMatch(source, directSessionPattern)
}

console.log('PASS: host and mobile session invalidation migration')
