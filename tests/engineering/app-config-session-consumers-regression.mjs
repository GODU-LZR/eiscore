// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const directSessionStorage = /localStorage\.(?:getItem|setItem|removeItem)\(\s*(['"])(?:auth_token|user_info)\1/

const appConfig = read('eiscore-apps/src/views/AppConfigCenter.vue')
assert.match(appConfig, /import\s*{\s*getToken\s*}\s*from\s*['"]@\/utils\/auth['"]/)
assert.doesNotMatch(appConfig, directSessionStorage)
assert.equal((appConfig.match(/const token = getToken\(\)/g) || []).length, 4)
assert.match(appConfig, /Authorization: `Bearer \$\{token}`/)
assert.match(appConfig, /['"]Accept-Profile['"]: ['"]app_center['"]/)
assert.match(appConfig, /['"]Content-Profile['"]: ['"]app_center['"]/)
assert.match(appConfig, /axios\.get\(['"]\/api\/apps['"]/)
assert.match(appConfig, /axios\.delete\(`\/api\/apps\?id=eq\.\$\{selectedAppId\.value}`/)
assert.match(appConfig, /row-level security policy/)
assert.match(appConfig, /Prefer: ['"]return=representation['"]/)

const dataApp = read('eiscore-apps/src/views/DataApp.vue')
assert.match(dataApp, /import\s*{\s*getToken\s*}\s*from\s*['"]@\/utils\/auth['"]/)
assert.doesNotMatch(dataApp, directSessionStorage)
assert.equal((dataApp.match(/const token = getToken\(\)/g) || []).length, 4)
assert.match(dataApp, /Authorization: `Bearer \$\{token}`/)
assert.match(dataApp, /['"]Accept-Profile['"]: ['"]app_center['"]/)
assert.match(dataApp, /['"]Content-Profile['"]: ['"]app_center['"]/)
assert.match(dataApp, /\/api\/rpc\/create_data_app_table/)
assert.match(dataApp, /status: ['"]published['"]/)
assert.match(dataApp, /router\.push\(`\/app\/\$\{appId\.value}`\)/)

console.log('PASS: app configuration consumers use platform session (2 files)')
