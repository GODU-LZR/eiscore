// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')

const session = read('shared/eis-session.js')
assert.match(session, /export const clearAuthAndRedirect = \(loginPath = ['"]\/login['"]\) =>/)
assert.match(session, /authSession\.clearAuth\(\)/)
assert.match(session, /window\.location\.href = loginPath/)

const sharedHttp = read('shared/eis-http.js')
assert.match(sharedHttp, /createPlatformHttpClient/)
assert.match(sharedHttp, /\.\.\/packages\/eiscore-platform\/src\/http-client\.mjs/)
assert.match(sharedHttp, /getEnterpriseConfig/)
assert.match(sharedHttp, /getAccessToken: getToken/)
assert.match(sharedHttp, /onUnauthorized: \(\) => clearAuthAndRedirect\(['"]\/login['"]\)/)
assert.match(sharedHttp, /export function getSharedHttpClient\(\)/)

const displayControl = read('shared/eis-display-control.js')
assert.match(displayControl, /import\s*{\s*getSharedHttpClient\s*}\s*from\s*['"]\.\/eis-http['"]/)
assert.doesNotMatch(displayControl, /\bfetch\s*\(/)
assert.doesNotMatch(displayControl, /getToken|Authorization/)
assert.match(displayControl, /requestJson\(['"]\/system_configs\?key=eq\.app_settings['"]/)
assert.match(displayControl, /['"]Accept-Profile['"]:\s*['"]public['"]/)
assert.match(displayControl, /const list = data/)

const cardStats = read('shared/app-card-server-stats.js')
assert.match(cardStats, /import\s*{\s*getSharedHttpClient\s*}\s*from\s*['"]\.\/eis-http['"]/)
assert.doesNotMatch(cardStats, /\bfetch\s*\(/)
assert.doesNotMatch(cardStats, /getToken|Authorization/)
assert.doesNotMatch(cardStats, /const url = `\/api\//)
assert.match(cardStats, /const url = `\/\$\{baseUrl\.replace/)
assert.match(cardStats, /getSharedHttpClient\(\)\.requestJson\(url,\s*{\s*method:\s*['"]GET['"]/)
assert.match(cardStats, /Prefer:\s*['"]count=exact['"]/)
assert.match(cardStats, /Range:\s*['"]0-0['"]/)
assert.match(cardStats, /parseContentRangeTotal\(headers\.get\(['"]content-range['"]\)\)/)
assert.match(cardStats, /\/rpc\/eis_grid_summary/)

for (const file of readdirSync(resolve(repoRoot, 'shared')).filter((name) => name.endsWith('.js'))) {
  if (['eis-agent-sse-client.js', 'eis-business-snapshot.js', 'eis-geo-services.js'].includes(file)) continue
  assert.doesNotMatch(read(`shared/${file}`), /\bfetch\s*\(/, `${file} must use an injected or shared platform HTTP client`)
}

console.log('PASS: shared runtime consumers use platform HTTP (dedicated Geo/Agent boundaries excluded)')
