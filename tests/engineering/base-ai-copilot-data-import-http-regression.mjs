// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(import.meta.dirname, '../../eiscore-base/src/components/AiCopilot.vue'), 'utf8')
const start = source.indexOf('const applyDataImport = async (info, messageKey) => {')
const end = source.indexOf('const saveSystemConfig = async (key, value) => {', start)
assert.notEqual(start, -1)
assert.notEqual(end, -1)
const section = source.slice(start, end)

assert.doesNotMatch(section, /\bfetch\s*\(/)
assert.match(section, /const url = `\/raw_materials\?select=batch_no/)
assert.match(section, /getHostHttpClient\(\)\.requestJson\(url, \{ headers \}\)/)
assert.match(section, /if \(!error\?\.status\) throw error/)
assert.match(section, /data = \[\]/)
assert.match(section, /const resourceUrl = target\.apiUrl\.startsWith\(['"]\/api['"]\)/)
assert.match(section, /target\.apiUrl\.slice\(4\) \|\| ['"]\/['"]/)
assert.match(section, /requestJson\(resourceUrl, \{/)
assert.match(section, /method:\s*['"]POST['"]/)
assert.match(section, /body:\s*payload/)
assert.match(section, /if \(error\?\.code === ['"]unauthorized['"]\)/)
assert.match(section, /ElMessage\.error\(['"]登录已过期，请重新登录后再导入['"]\)/)
assert.match(section, /ElMessage\.success\(`已导入 \$\{payload\.length\} 行\$\{extra\}`\)/)
assert.match(section, /new CustomEvent\(['"]eis-grid-imported['"]/)

console.log('PASS: AI Copilot data import uses platform HTTP')
