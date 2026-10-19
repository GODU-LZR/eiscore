// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const readSource = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const directSessionPattern = /localStorage\.(?:getItem|setItem|removeItem)\(\s*['"](?:auth_token|user_info)['"]/
const targets = [
  'eiscore-base/src/components/AiCopilot.vue',
  'eiscore-base/src/utils/ai-bridge.js',
  'eiscore-base/src/views/SettingsView.vue',
  'eiscore-base/src/views/HomeView.vue',
  'eiscore-base/src/components/harness/BusinessHarnessFrame.vue',
  'eiscore-base/src/services/business-harness-auth.js',
  'eiscore-base/src/micro/index.js'
]

for (const path of targets) {
  const source = readSource(path)
  assert.doesNotMatch(source, directSessionPattern, `${path} must consume the Auth adapter`)
}

const copilot = readSource('eiscore-base/src/components/AiCopilot.vue')
assert.match(copilot, /import\s*\{[^}]*\bgetToken\b[^}]*\bparseJwtPayload\b[^}]*\}\s*from\s*['"]@\/utils\/auth['"]/s)
assert.match(copilot, /const getAuthToken = getToken/)
assert.match(copilot, /if \(!payload \|\| typeof payload\.exp !== ['"]number['"]\) return false/)
assert.doesNotMatch(copilot, /\batob\b/)

const bridge = readSource('eiscore-base/src/utils/ai-bridge.js')
assert.match(bridge, /import\s*\{\s*getToken\s*\}\s*from\s*['"]@\/utils\/auth['"]/)
assert.match(bridge, /getAuthToken\(\)\s*\{\s*return getToken\(\)\s*\}/)

const settings = readSource('eiscore-base/src/views/SettingsView.vue')
assert.match(settings, /import\s*{\s*getHostHttpClient\s*}\s*from\s*['"]@\/platform\/http-client['"]/)
assert.doesNotMatch(settings, /getHostSystemConfigService/)
assert.doesNotMatch(settings, /import\s*{\s*getToken\s*}\s*from\s*['"]@\/utils\/auth['"]/)
assert.doesNotMatch(settings, /const getAuthToken/)

const home = readSource('eiscore-base/src/views/HomeView.vue')
assert.match(home, /<HarnessWorkspaceSlot\s+:active="activeMode === 'harness'"\s*\/>/)
assert.doesNotMatch(home, /getAuthHeader|prepare(?:Business)?HarnessAuth|<iframe\b/, 'Home must delegate authentication and iframe ownership to the shared host')

const frame = readSource('eiscore-base/src/components/harness/BusinessHarnessFrame.vue')
assert.match(frame, /import\s*\{\s*getAuthHeader\s*\}\s*from\s*['"]@\/utils\/auth['"]/)
assert.match(frame, /import\s*\{\s*prepareBusinessHarnessAuth\s*\}\s*from\s*['"]@\/services\/business-harness-auth['"]/)
assert.match(frame, /const authorization = getAuthHeader\(\)\.Authorization \|\| ''/)
assert.match(frame, /prepareBusinessHarnessAuth\(\{\s*harnessWebUrl,\s*authorization\s*\},\s*\(\) => id === requestId && !!authorization\)/)

const businessHarnessAuth = readSource('eiscore-base/src/services/business-harness-auth.js')
assert.match(businessHarnessAuth, /import\s*\{\s*prepareHarnessAuth\s*\}\s*from\s*['"]\.\/harness-auth-client['"]/)

const micro = readSource('eiscore-base/src/micro/index.js')
assert.match(micro, /import\s*\{\s*setUserInfo\s*\}\s*from\s*['"]@\/utils\/auth['"]/)
assert.match(micro, /if \(setUserInfo\(incoming\)\)\s*\{\s*window\.dispatchEvent\(new CustomEvent\(['"]user-info-updated['"]\)\)\s*\}/s)

console.log('PASS: remaining host session consumers migrated')
