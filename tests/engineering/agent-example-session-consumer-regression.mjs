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
assert.match(source, /class HarnessClient/)
assert.match(source, /Authorization:\s*`Bearer \$\{token\}`/)
assert.match(source, /\/ai\/harness\/execute/)
assert.match(source, /\/flash\/tools\/call/)
assert.match(source, /plugin_id: pluginId/)
assert.match(source, /capability_id: capabilityId/)
assert.match(source, /idempotency_key: idempotencyKey/)
assert.match(source, /pluginId: ['"]enterprise-bi['"]/)
assert.match(source, /capabilityId: ['"]eiscore_enterprise_snapshot['"]/ )

console.log('PASS: Agent example client uses platform session (1 file)')
