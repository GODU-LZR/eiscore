// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')

const adapter = read('eiscore-base/src/platform/http-client.js')
assert.match(adapter, /export function getHostHttpClient\(\)/)
assert.match(adapter, /createPlatformHttpClient\(/)
assert.match(adapter, /getAccessToken:\s*getToken/)
assert.match(adapter, /onUnauthorized:\s*\(\)\s*=>\s*clearAuthAndRedirect\(['"]\/login['"]\)/)
assert.match(adapter, /createSystemConfigService\(\{ httpClient }\)/)

const settings = read('eiscore-base/src/views/SettingsView.vue')
assert.match(settings, /import\s*{\s*getHostHttpClient\s*}\s*from\s*['"]@\/platform\/http-client['"]/)
assert.doesNotMatch(settings, /\bfetch\s*\(/)
assert.doesNotMatch(settings, /import\s*{\s*getToken\s*}/)
assert.doesNotMatch(settings, /const (?:systemConfigHeaders|appCenterHeaders)/)

assert.match(settings, /getHostHttpClient\(\)\.requestJson\(\s*['"]\/apps\?select=id,name,description,app_type,status&order=created_at\.desc['"]/)
assert.match(settings, /['"]Accept-Profile['"]:\s*['"]app_center['"]/)
assert.match(settings, /['"]Content-Profile['"]:\s*['"]app_center['"]/)
assert.match(settings, /DeepSeek Harness 运行状态/)
assert.match(settings, /deepseek-harness/)
assert.doesNotMatch(settings, /getHostSystemConfigService/)
assert.doesNotMatch(settings, /ai_glm_config|api_url|api_key/)
assert.doesNotMatch(settings, /saveAgentConfig|loadAgentConfig|agentConfigDirty/)

console.log('PASS: Settings consumers use platform HTTP boundary')
