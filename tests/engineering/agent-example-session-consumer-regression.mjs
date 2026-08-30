// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const source = readFileSync(resolve(repoRoot, 'eiscore-apps/src/utils/agent-client-examples.js'), 'utf8')
const directSessionStorage = /localStorage\.(?:getItem|setItem|removeItem)\(\s*(['"])(?:auth_token|user_info)\1/

assert.match(source, /import\s*{\s*getToken\s*}\s*from\s*['"]@\/utils\/auth['"]/)
assert.doesNotMatch(source, directSessionStorage)
assert.equal((source.match(/const token = getToken\(\)/g) || []).length, 9)

assert.match(source, /const wsUrl = `ws:\/\/\$\{window\.location\.hostname}:8078\/ws`/)
assert.match(source, /new WebSocket\(wsUrl, \[['"]bearer['"], token\]\)/)
assert.match(source, /new WebSocket\(['"]ws:\/\/localhost:8078\/ws['"], \[['"]bearer['"], token\]\)/)
assert.match(source, /projectPath: ['"]eiscore-apps['"]/)
assert.match(source, /setTimeout\(\(\) => {[\s\S]*?}, 120000\)/)
assert.match(source, /module\.exports = { AgentClient }/)

console.log('PASS: Agent example client uses platform session (1 file)')
