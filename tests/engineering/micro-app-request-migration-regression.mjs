// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')

for (const [moduleId, timeoutMs, defaultProfile, expectedAccept, expectedSilence, expectedBusinessMessage] of [
  ['quality', 8000, 'public', false, false, false],
  ['equipment', 8000, 'public', true, false, false],
  ['purchase', 5000, 'public', false, true, false],
  ['sales', 5000, 'public', false, true, false],
  ['hr', 5000, 'hr', false, false, false],
  ['apps', 8000, 'app_center', false, false, false],
  ['production', 8000, 'scm', false, false, true],
  ['materials', 5000, '', false, false, false]
]) {
  const requestPath = resolve(repoRoot, `eiscore-${moduleId}/src/utils/request.js`)
  const source = readFileSync(requestPath, 'utf8')
  assert.match(source, /createPlatformAxiosClient/)
  assert.match(source, /from '@eiscore\/platform\/axios-client'/)
  assert.match(source, /axios,\s*\n\s*getAccessToken: getToken/)
  if (defaultProfile) {
    assert.match(source, new RegExp(`defaultProfile: '${defaultProfile}'`))
  } else {
    assert.match(source, /defaultProfile: \(_config, \{ path \}\) => resolveDefaultProfile\(path\)/)
    assert.match(source, /SCM_ENDPOINTS/)
  }
  assert.match(source, new RegExp(`timeoutMs: ${timeoutMs}`))
  assert.match(source, /clearAuthAndRedirect\('\/login'\)/)
  assert.doesNotMatch(source, /axios\.create|interceptors\.(request|response)/)
  if (expectedAccept) assert.match(source, /defaultAccept: 'application\/json'/)
  else assert.doesNotMatch(source, /defaultAccept:/)
  if (expectedSilence) {
    assert.match(source, /shouldNotifyError:/)
    assert.match(source, /config\.silentError !== true/)
    assert.match(source, /config\.suppressErrorMessage !== true/)
  } else {
    assert.doesNotMatch(source, /shouldNotifyError:/)
  }
  if (expectedBusinessMessage) {
    assert.match(source, /resolveErrorMessage:/)
    assert.match(source, /error\?\.response\?\.data\?\.message/)
  } else {
    assert.doesNotMatch(source, /resolveErrorMessage:/)
  }
}

console.log('PASS: profile-aware Request migration contract (8 applications)')

{
  const source = readFileSync(resolve(repoRoot, 'eiscore-base/src/utils/request.js'), 'utf8')
  assert.match(source, /createPlatformAxiosClient/)
  assert.match(source, /service: 'auto'/)
  assert.match(source, /timeoutMs: 10000/)
  assert.match(source, /unauthorizedMessage: '未授权，请重新登录'/)
  assert.match(source, /shouldHandleUnauthorized:/)
  assert.match(source, /context\.service === 'agent'/)
  assert.match(source, /context\.path\.startsWith\('\/ai\/'\)/)
  assert.match(source, /error\?\.response\?\.status !== 404/)
  assert.match(source, /网络连接超时或断开/)
  assert.doesNotMatch(source, /axios\.create|interceptors\.(request|response)/)
}

console.log('PASS: host dual-service Request migration contract')
