// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const source = readFileSync(resolve(repoRoot, 'eiscore-apps/src/views/AppRuntime.vue'), 'utf8')
const directSessionStorage = /localStorage\.(?:getItem|setItem|removeItem)\(\s*(['"])(?:auth_token|user_info)\1/

assert.match(source, /import\s*{\s*getToken,\s*getUserInfo\s*}\s*from\s*['"]@\/utils\/auth['"]/)
assert.doesNotMatch(source, directSessionStorage)
assert.equal((source.match(/const token = getToken\(\)/g) || []).length, 18)
assert.match(source, /const info = getUserInfo\(\) \|\| {}/)
assert.match(source, /info\?\.app_role \|\| info\?\.appRole \|\| info\?\.role/)
assert.match(source, /const getAuthToken = \(\) => getToken\(\)\.trim\(\)/)

assert.match(source, /['"]Accept-Profile['"]: ['"]app_center['"]/)
assert.match(source, /['"]Accept-Profile['"]: ['"]workflow['"]/)
assert.match(source, /['"]Accept-Profile['"]: ['"]public['"]/)
assert.match(source, /['"]Accept-Profile['"]: schema/)
assert.match(source, /axios\.post\(['"]\/flash\/draft['"]/)
assert.match(source, /\/api\/rpc\/start_workflow_instance/)
assert.match(source, /\/api\/rpc\/transition_workflow_instance/)
assert.match(source, /\/api\/workflow_permission_policies/)
assert.match(source, /\/api\/workflow_transition_rules/)
assert.match(source, /\/api\/published_routes/)
assert.match(source, /\/api\/role_permissions/)

console.log('PASS: AppRuntime uses platform session (1 file)')
