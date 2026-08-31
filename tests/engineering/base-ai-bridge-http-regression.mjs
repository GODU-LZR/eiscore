// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const source = readFileSync(resolve(repoRoot, 'eiscore-base/src/utils/ai-bridge.js'), 'utf8')
const request = readFileSync(resolve(repoRoot, 'eiscore-base/src/utils/request.js'), 'utf8')
const start = source.indexOf('async prefetchGridAgentQuery(userText, context) {')
const end = source.indexOf('loadFromStorage() {', start)
assert.notEqual(start, -1)
assert.notEqual(end, -1)
const section = source.slice(start, end)

assert.doesNotMatch(section, /\bfetch\s*\(|JSON\.stringify|buildAuthHeaders/)
assert.match(section, /await request\(\{/)
assert.match(section, /url:\s*['"]\/api\/rpc\/eis_grid_agent_query['"]/)
assert.match(section, /method:\s*['"]post['"]/)
assert.match(section, /'Accept-Profile':\s*['"]public['"]/)
assert.match(section, /'Content-Profile':\s*['"]public['"]/)
assert.match(section, /data:\s*\{\s*payload\s*}/)
assert.match(section, /silentError:\s*true/)
assert.match(section, /console\.warn\(['"]\[AiBridge] EISGrid server query skipped['"]/)
assert.match(section, /return null/)

const fetchCalls = source.match(/\bfetch\s*\(/g) || []
assert.equal(fetchCalls.length, 0)
assert.match(source, /from\s*['"]@shared\/eis-agent-sse-client['"]/)
assert.match(source, /path:\s*['"]\/agent\/ai\/chat\/completions['"]/)
assert.match(request, /config\.silentError !== true/)
assert.match(request, /config\.suppressErrorMessage !== true/)
assert.match(request, /error\?\.response\?\.status !== 404/)

console.log('PASS: AI bridge protected RPC uses platform Request')
