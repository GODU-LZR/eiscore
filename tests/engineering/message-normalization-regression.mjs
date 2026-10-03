// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const require = createRequire(import.meta.url)
const policy = require('../../realtime/message-normalization')
const repoRoot = resolve(import.meta.dirname, '../..')

assert.deepEqual(Object.keys(policy), ['normalizeText'])
assert.equal(policy.normalizeText([' first ', { text: 'second' }, null]), 'first \nsecond')
assert.equal(policy.normalizeText({ text: ' value ' }), 'value')
assert.equal(policy.normalizeText(42), '42')

const source = readFileSync(resolve(repoRoot, 'realtime/message-normalization.js'), 'utf8')
for (const forbidden of ['glm-4.6v', 'AGENT_RUNTIME_DEFAULTS', 'buildAgentSystemPrompt', 'resolveAgentRoute', 'SMART_BI_DOMAINS']) {
  assert.equal(source.includes(forbidden), false, `legacy Agent policy survived: ${forbidden}`)
}

console.log('Harness message normalization regression passed: no legacy Agent policy remains')
