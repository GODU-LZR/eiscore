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
assert.doesNotMatch(bridge, directSessionStorage)
assert.match(bridge, /const readAuthToken = \(\) => String\(getToken\(\) \|\| ['"]['"]\)\.trim\(\)/)
assert.match(bridge, /const parsed = getUserInfo\(\) \|\| {}/)
assert.match(bridge, /parsed\?\.username \|\| parsed\?\.user_name \|\| parsed\?\.name/)
assert.match(bridge, /parsed\?\.app_role \|\| parsed\?\.role/)
assert.match(bridge, /return { username: ['"]['"], appRole: ['"]['"] }/)
assert.match(bridge, /flash\.inventory\.stock\.out/)

const draftPreview = read('eiscore-apps/src/views/FlashDraftPreview.vue')
assert.match(draftPreview, /import\s*{\s*getToken\s*}\s*from\s*['"]@\/utils\/auth['"]/)
assert.doesNotMatch(draftPreview, directSessionStorage)
assert.doesNotMatch(draftPreview, /const readAuthToken/)
assert.match(draftPreview, /const token = getToken\(\)/)
assert.match(draftPreview, /Authorization: `Bearer \$\{token}`/)
assert.match(draftPreview, /\/agent\/flash\/draft/)

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
