// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  extractAiBalancedJson,
  isAiOmittedEchartsOption,
  normalizeAiEchartsGrid,
  normalizeAiEchartsOption,
  parseAiEchartsOptionSafely,
  sanitizeAiJson,
  stripAiFunctionValueBlocks,
  validateAiEchartsOption
} from '../../eiscore-base/src/domain/ai-copilot-chart-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
assert.equal(stripAiFunctionValueBlocks('{formatter: function(v) { return "}" + v }, value: 1}'), '{formatter: null, value: 1}')
assert.equal(stripAiFunctionValueBlocks('{value: 1}'), '{value: 1}')
assert.equal(sanitizeAiJson("const option = {series:{data:[1,2,],}, missing:undefined, bad:NaN, max:Infinity, min:-Infinity, name:'A', // note\n}"),
  '{"series":{"data":[1,2]}, "missing":null, "bad":0, "max":0, "min":-0, "name":"A", \n}')
assert.equal(sanitizeAiJson(''), '')

assert.equal(extractAiBalancedJson('prefix {"text":"} ignored","nested":{"x":1}} suffix'), '{"text":"} ignored","nested":{"x":1}}')
assert.equal(extractAiBalancedJson('prefix [1,{"x":2}] suffix'), '[1,{"x":2}]')
assert.equal(extractAiBalancedJson('no json'), '')
assert.equal(extractAiBalancedJson('{"open":1'), '')

assert.deepEqual(normalizeAiEchartsGrid({ width: 200, height: '50%', left: 10 }), {
  left: 10, right: 28, top: 64, bottom: 44, containLabel: true
})
assert.deepEqual(normalizeAiEchartsGrid({ width: 300, height: '60%' }), {
  left: 56, right: 28, top: 64, bottom: 44, containLabel: true, width: 300, height: '60%'
})

const sourceOption = { series: { data: [1, 2] }, grid: [{ width: '60%' }], tooltip: null }
const normalized = normalizeAiEchartsOption(sourceOption)
assert.deepEqual(normalized, {
  series: [{ type: 'line', data: [1, 2] }],
  grid: [{ left: 56, right: 28, top: 64, bottom: 44, containLabel: true }],
  tooltip: { trigger: 'axis' },
  animation: false
})
assert.deepEqual(sourceOption, { series: { data: [1, 2] }, grid: [{ width: '60%' }], tooltip: null })
for (const invalid of [null, [], {}, { series: [] }, { series: [null, 2] }]) {
  assert.equal(normalizeAiEchartsOption(invalid), null)
}

assert.deepEqual(parseAiEchartsOptionSafely('说明文字\noption = {series:{type:"bar",data:[3,4,],},}\n尾部'), {
  series: [{ type: 'bar', data: [3, 4] }],
  animation: false,
  grid: { left: 56, right: 28, top: 64, bottom: 44, containLabel: true },
  tooltip: { trigger: 'axis' }
})
assert.equal(parseAiEchartsOptionSafely('{bad'), null)

const hiddenOption = {
  xAxis: { show: false },
  yAxis: [{ show: false }],
  series: [{ lineStyle: { opacity: '0' }, itemStyle: { opacity: 0 } }]
}
assert.equal(isAiOmittedEchartsOption(hiddenOption), true)
assert.equal(isAiOmittedEchartsOption({ ...hiddenOption, xAxis: { show: true } }), false)
assert.equal(isAiOmittedEchartsOption(null), false)
assert.equal(validateAiEchartsOption({ series: [{}] }), '')
assert.equal(validateAiEchartsOption({ series: [] }), '图表配置缺少必要的 series 数据')
assert.equal(validateAiEchartsOption(null), '图表配置缺少必要的 series 数据')

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/domain/ai-copilot-chart-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'requestJson', 'axios', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'new Date']) {
  assert.equal(moduleSource.includes(forbidden), false, `AI Copilot chart policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-base/src/components/AiCopilot.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/ai-copilot-chart-policy['"]/)
for (const removedDefinition of [
  'const stripFunctionValueBlocks =',
  'const sanitizeJson =',
  'const extractBalancedJson =',
  'const normalizeGridItem =',
  'const normalizeEchartsOption =',
  'const parseEchartsOptionSafely =',
  'const isOmittedOption =',
  'const validateEchartsOption ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `AiCopilot reintroduced ${removedDefinition}`)
}
for (const requiredUse of [
  'extractAiSmartBiActions(text, { sanitizeJson })',
  "extractAiFormTemplate(msg?.content || '', { sanitizeJson })",
  'const option = parseEchartsOptionSafely(jsonStr)',
  'const validationError = validateEchartsOption(option)',
  'if (isOmittedOption(option))'
]) {
  assert.equal(pageSource.includes(requiredUse), true, `AiCopilot lost ${requiredUse}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 3522)

console.log('PASS: AiCopilot chart policy preserves tolerant JSON, balanced extraction, chart normalization and omission guards')
