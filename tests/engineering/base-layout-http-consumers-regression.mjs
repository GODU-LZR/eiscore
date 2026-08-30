// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const source = readFileSync(resolve(repoRoot, 'eiscore-base/src/layout/index.vue'), 'utf8')

const section = (start, end) => {
  const startIndex = source.indexOf(start)
  const endIndex = source.indexOf(end, startIndex + start.length)
  assert.notEqual(startIndex, -1, `missing section: ${start}`)
  assert.notEqual(endIndex, -1, `missing section boundary: ${end}`)
  return source.slice(startIndex, endIndex)
}

assert.match(source, /import\s*{\s*getHostHttpClient\s*}\s*from\s*['"]@\/platform\/http-client['"]/)
assert.doesNotMatch(source, /\bgetAuthHeader\b/)

const superAdmin = section('const ensureSuperAdminScopes = async () => {', 'const resolveAvatarUrl = async (info) => {')
assert.doesNotMatch(superAdmin, /\bfetch\s*\(|Authorization/)
assert.match(superAdmin, /requestJson\(['"]\/roles\?code=eq\.super_admin['"]/)
assert.match(superAdmin, /requestJson\(['"]\/role_data_scopes\?on_conflict=role_id,module['"]/)
assert.match(superAdmin, /method:\s*['"]POST['"]/)
assert.match(superAdmin, /Prefer:\s*['"]resolution=merge-duplicates['"]/)
assert.match(superAdmin, /body:\s*payload/)
assert.match(superAdmin, /superScopeSynced\.value = true/)

const avatar = section('const resolveAvatarUrl = async (info) => {', 'const fetchUserInfoByToken = async (token) => {')
assert.doesNotMatch(avatar, /\bfetch\s*\(|getAuthHeader|Authorization/)
assert.match(avatar, /requestJson\(`\/files\?id=eq\.\$\{fileId\}&select=content_base64,mime_type`/)
assert.match(avatar, /row\.mime_type \|\| ['"]application\/octet-stream['"]/)
assert.match(avatar, /return \{ \.\.\.info, avatar: ['"]['"] \}/)

const userInfo = section('const fetchUserInfoByToken = async (token) => {', 'const refreshUserInfo = async () => {')
assert.doesNotMatch(userInfo, /\bfetch\s*\(|getAuthHeader/)
assert.match(userInfo, /Authorization:\s*`Bearer \$\{token}`/)
assert.equal((userInfo.match(/`\/(?:v_users_manage|users)\?/g) || []).length, 4)
assert.doesNotMatch(userInfo, /`\/api\//)
assert.match(userInfo, /for \(const url of urls\)/)
assert.match(userInfo, /getHostHttpClient\(\)\.requestJson\(url/)
assert.match(userInfo, /catch \(e\) \{\}/)

const directFetches = source.match(/\bfetch\s*\(/g) || []
assert.equal(directFetches.length, 2, 'layout may only fetch the static manifest and prewarm assets directly')
assert.match(source, /fetch\(`\/asset-manifest\.json\?t=\$\{Date\.now\(\)}`/)
assert.match(source, /await fetch\(url, \{ cache: ['"]force-cache['"], credentials: ['"]same-origin['"] \}\)/)

console.log('PASS: base layout protected APIs use platform HTTP (2 static fetches remain)')
