// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const directSessionStorage = /localStorage\.(?:getItem|setItem|removeItem)\(\s*(['"])(?:auth_token|user_info)\1/

const bridge = read('eiscore-apps/src/utils/flash-runtime-bridge.js')
assert.match(bridge, /import\s*{\s*getToken,\s*getUserInfo\s*}\s*from\s*['"]@\/utils\/auth['"]/)
assert.match(bridge, /import\s*{\s*callTool\s+as\s+callFlashAgentTool\s*}\s*from\s*['"]@\/utils\/flash-agent-client['"]/)
assert.doesNotMatch(bridge, directSessionStorage)
assert.match(bridge, /const readAuthToken = \(\) => String\(getToken\(\) \|\| ['"]['"]\)\.trim\(\)/)
assert.match(bridge, /const parsed = getUserInfo\(\) \|\| {}/)
assert.match(bridge, /parsed\?\.username \|\| parsed\?\.user_name \|\| parsed\?\.name/)
assert.match(bridge, /parsed\?\.app_role \|\| parsed\?\.role/)
assert.match(bridge, /return { username: ['"]['"], appRole: ['"]['"] }/)
assert.match(bridge, /flash\.inventory\.stock\.out/)
assert.match(bridge, /callFlashAgentTool\(\{\s*urls:\s*getAgentToolCallUrls\(\),\s*token,\s*payload\s*}\)/)
assert.doesNotMatch(bridge, /Authorization: `Bearer \$\{token}`/)

const draftPreview = read('eiscore-apps/src/views/FlashDraftPreview.vue')
assert.match(draftPreview, /import\s*{\s*getToken\s*}\s*from\s*['"]@\/utils\/auth['"]/)
assert.match(draftPreview, /import\s*{\s*fetchDraftSource\s+as\s+requestFlashDraftSource\s*}\s*from\s*['"]@\/utils\/flash-agent-client['"]/)
assert.doesNotMatch(draftPreview, directSessionStorage)
assert.doesNotMatch(draftPreview, /const readAuthToken/)
assert.match(draftPreview, /requestFlashDraftSource\(\{\s*urls:\s*getDraftUrls\(\),\s*token:\s*getToken\(\)\s*}\)/)
assert.doesNotMatch(draftPreview, /Authorization: `Bearer \$\{token}`/)
assert.match(draftPreview, /\/flash\/draft/)

const agentClient = read('eiscore-apps/src/utils/flash-agent-client.js')
assert.match(agentClient, /Authorization:\s*`Bearer \$\{token}`/)

const builder = read('eiscore-apps/src/views/FlashBuilder.vue')
assert.match(builder, /import\s*{\s*getToken,\s*getUserInfo\s*}\s*from\s*['"]@\/utils\/auth['"]/)
assert.doesNotMatch(builder, directSessionStorage)
assert.doesNotMatch(builder, /const getAuthToken/)
assert.equal((builder.match(/const token = getToken\(\)/g) || []).length, 2)
assert.match(builder, /const parsed = getUserInfo\(\) \|\| {}/)
assert.match(builder, /username: String\(parsed\?\.username \|\| ['"]['"]\)\.trim\(\) \|\| ['"]unknown['"]/)
assert.match(builder, /appRole: String\(parsed\?\.app_role \|\| parsed\?\.role \|\| ['"]['"]\)\.trim\(\) \|\| ['"]unknown['"]/)
assert.match(builder, /return { username: ['"]unknown['"], appRole: ['"]unknown['"] }/)

console.log('PASS: Flash runtime consumers use platform session (3 files)')
