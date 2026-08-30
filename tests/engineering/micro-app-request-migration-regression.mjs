// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')

for (const [moduleId, expectedAccept] of [
  ['quality', false],
  ['equipment', true]
]) {
  const requestPath = resolve(repoRoot, `eiscore-${moduleId}/src/utils/request.js`)
  const source = readFileSync(requestPath, 'utf8')
  assert.match(source, /createPlatformAxiosClient/)
  assert.match(source, /from '@eiscore\/platform\/axios-client'/)
  assert.match(source, /axios,\s*\n\s*getAccessToken: getToken/)
  assert.match(source, /defaultProfile: 'public'/)
  assert.match(source, /timeoutMs: 8000/)
  assert.match(source, /clearAuthAndRedirect\('\/login'\)/)
  assert.doesNotMatch(source, /axios\.create|interceptors\.(request|response)/)
  if (expectedAccept) assert.match(source, /defaultAccept: 'application\/json'/)
  else assert.doesNotMatch(source, /defaultAccept:/)
}

console.log('PASS: quality and equipment Request migration contract')
