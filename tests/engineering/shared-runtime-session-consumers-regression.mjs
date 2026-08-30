// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const read = (path) => readFileSync(resolve(repoRoot, path), 'utf8')
const directSessionStorage = /localStorage\.(?:getItem|setItem|removeItem)\(\s*(['"])(?:auth_token|user_info)\1/

const session = read('shared/eis-session.js')
assert.match(session, /import\s*{\s*createAuthSession\s*}\s*from\s*['"]\.\.\/packages\/eiscore-platform\/src\/auth-session\.mjs['"]/)
assert.match(session, /const authSession = createAuthSession\(\)/)
assert.match(session, /export const getToken = \(\) => authSession\.getToken\(\)/)
assert.match(session, /export const getUserInfo = \(\) => authSession\.getUserInfo\(\)/)

const displayControl = read('shared/eis-display-control.js')
assert.match(displayControl, /import\s*{\s*getToken\s*}\s*from\s*['"]\.\/eis-session['"]/)
assert.doesNotMatch(displayControl, directSessionStorage)
assert.match(displayControl, /const token = getToken\(\)/)
assert.match(displayControl, /if \(token\) headers\.Authorization = `Bearer \$\{token}`/)
assert.match(displayControl, /fetch\(['"]\/api\/system_configs\?key=eq\.app_settings['"]/)
assert.match(displayControl, /DISPLAY_VISIBILITY_UPDATED_EVENT/)

const cardStats = read('shared/app-card-server-stats.js')
assert.match(cardStats, /import\s*{\s*getToken\s*}\s*from\s*['"]\.\/eis-session['"]/)
assert.doesNotMatch(cardStats, directSessionStorage)
assert.match(cardStats, /const token = getToken\(\)/)
assert.match(cardStats, /Prefer: ['"]count=exact['"]/)
assert.match(cardStats, /Range: ['"]0-0['"]/)
assert.match(cardStats, /\/rpc\/eis_grid_summary/)

const gridAudit = read('shared/eis-grid-operation-audit.js')
assert.match(gridAudit, /import\s*{\s*getUserInfo\s*}\s*from\s*['"]\.\/eis-session['"]/)
assert.doesNotMatch(gridAudit, directSessionStorage)
assert.match(gridAudit, /const info = getUserInfo\(\) \|\| {}/)
assert.match(gridAudit, /info\?\.username \|\| info\?\.name \|\| info\?\.id/)
assert.match(gridAudit, /['"]unknown['"]/)
assert.match(gridAudit, /url: ['"]\/execution_logs['"]/)

console.log('PASS: shared runtime consumers use platform session (3 files)')
