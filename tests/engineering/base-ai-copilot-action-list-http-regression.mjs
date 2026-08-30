// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(import.meta.dirname, '../../eiscore-base/src/components/AiCopilot.vue'), 'utf8')
const start = source.indexOf('const loadSmartBiActionItems = async (force = false) => {')
const end = source.indexOf('const resolveSmartBiActionDueAt = (action) => {', start)
assert.notEqual(start, -1)
assert.notEqual(end, -1)
const section = source.slice(start, end)

assert.doesNotMatch(section, /\bfetch\s*\(/)
assert.match(section, /const token = getAuthToken\(\)/)
assert.match(section, /getHostHttpClient\(\)\.requestJson\(/)
assert.doesNotMatch(section, /['"]\/api\/smart_bi_action_items/)
assert.match(section, /\/smart_bi_action_items\?select=id,action_no,title/)
assert.match(section, /order=updated_at\.desc&limit=120/)
assert.match(section, /headers:\s*getPublicProfileHeaders\(token\)/)
assert.match(section, /smartBiActionItems\.value = Array\.isArray\(data\) \? data : \[\]/)
assert.match(section, /catch \(e\) \{\s*smartBiActionItems\.value = \[\]/)
assert.match(section, /finally \{\s*smartBiActionItemsLoading\.value = false/)

console.log('PASS: AI Copilot action list uses platform HTTP')
