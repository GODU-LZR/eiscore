// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const readSource = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const directSessionPattern = /localStorage\.(?:getItem|setItem|removeItem)\(\s*['"](?:auth_token|user_info)['"]/

const baseMain = readSource('eiscore-base/src/main.js')
for (const obsoleteFetchGuard of [
  /clearAuthAndRedirect/,
  /window\.fetch\s*=/,
  /originalFetch/,
  /response\.status\s*===\s*401/
]) assert.doesNotMatch(baseMain, obsoleteFetchGuard)
assert.doesNotMatch(baseMain, directSessionPattern)

const mobileRouter = readSource('eiscore-mobile/src/router/index.js')
assert.match(mobileRouter, /from\s*['"]@\/utils\/auth['"]/)
for (const name of ['getToken', 'parseJwt', 'clearAuth']) assert.match(mobileRouter, new RegExp(`\\b${name}\\b`))
assert.match(mobileRouter, /redirectToEnterpriseLogin\(`\/mobile\$\{to\.fullPath\}`\)/)
assert.match(mobileRouter, /const payload = parseJwt\(token\)/)
assert.match(mobileRouter, /payload\.exp\s*&&\s*Date\.now\(\)\s*\/\s*1000\s*>=\s*payload\.exp/)
assert.doesNotMatch(mobileRouter, directSessionPattern)
assert.doesNotMatch(mobileRouter, /\batob\b/)

const mobileHttp = readSource('eiscore-mobile/src/platform/http-client.js')
assert.match(mobileHttp, /from\s*['"]@\/utils\/auth['"]/)
assert.match(mobileHttp, /\bgetToken\b/)
assert.match(mobileHttp, /\bclearAuth\b/)
assert.match(mobileHttp, /onUnauthorized:\s*\(\)\s*=>\s*\{/)
assert.match(mobileHttp, /clearAuth\(\)/)
assert.match(mobileHttp, /redirectToEnterpriseLogin\(\)/)
assert.doesNotMatch(mobileHttp, directSessionPattern)

const mobileRequestCore = readSource('eiscore-mobile/src/api/request-core.js')
assert.match(mobileRequestCore, /error\?\.status\s*===\s*401/)
assert.match(mobileRequestCore, /throw new Error\(['"]登录已过期['"]\)/)

for (const path of [
  'eiscore-mobile/src/api/warehouse.js',
  'eiscore-mobile/src/api/stock.js',
  'eiscore-mobile/src/api/attendance.js',
  'eiscore-mobile/src/api/check.js'
]) {
  const source = readSource(path)
  assert.match(source, /from\s*['"]\.\/request['"]/)
  assert.doesNotMatch(source, /from\s*['"]@\/utils\/auth['"]/)
  assert.doesNotMatch(source, /\bgetToken\b|\bclearAuth\b|res\.status\s*===\s*401/)
  assert.doesNotMatch(source, directSessionPattern)
}

console.log('PASS: host and mobile session invalidation migration')
