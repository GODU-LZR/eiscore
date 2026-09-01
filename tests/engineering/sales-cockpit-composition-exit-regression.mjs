// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const pagePath = resolve(repoRoot, 'eiscore-sales/src/views/SalesCockpit.vue')
const source = readFileSync(pagePath, 'utf8')
const lines = source.split(/\r?\n/)
const lineCount = lines.at(-1) === '' ? lines.length - 1 : lines.length

assert.ok(lineCount <= 1751, `SalesCockpit grew beyond its 1751-line exit baseline: ${lineCount}`)

const markerLine = (marker) => lines.findIndex((line) => line === marker)
const templateStart = markerLine('<template>')
const templateEnd = markerLine('</template>')
const scriptStart = markerLine('<script setup>')
const scriptEnd = markerLine('</script>')
const styleStart = markerLine('<style scoped>')
const styleEnd = markerLine('</style>')
assert.equal(templateStart, 0)
assert.ok(templateStart < templateEnd)
assert.ok(templateEnd < scriptStart && scriptStart < scriptEnd)
assert.ok(scriptEnd < styleStart && styleStart < styleEnd)
assert.ok(templateEnd - templateStart + 1 <= 316)
assert.ok(scriptEnd - scriptStart + 1 <= 245)
assert.ok(styleEnd - styleStart + 1 <= 1187)

const policyImports = [...source.matchAll(/from ['"](@\/domain\/sales-cockpit-[^'"]+-policy\.js)['"]/g)]
  .map((match) => match[1])
  .sort()
assert.deepEqual(policyImports, [
  '@/domain/sales-cockpit-activity-policy.js',
  '@/domain/sales-cockpit-clock-policy.js',
  '@/domain/sales-cockpit-context-policy.js',
  '@/domain/sales-cockpit-data-policy.js',
  '@/domain/sales-cockpit-presentation-policy.js',
  '@/domain/sales-cockpit-query-policy.js',
  '@/domain/sales-cockpit-ranking-policy.js',
  '@/domain/sales-cockpit-risk-action-policy.js',
  '@/domain/sales-cockpit-shell-policy.js',
  '@/domain/sales-cockpit-summary-policy.js'
])

const policyFiles = policyImports.map((specifier) => resolve(repoRoot, 'eiscore-sales/src', specifier.replace('@/', '')))
let policyExports = 0
for (const file of policyFiles) {
  const policySource = readFileSync(file, 'utf8')
  policyExports += (policySource.match(/^export\s+(?:const|function|class)\s+/gm) || []).length
  for (const forbidden of ["from 'vue'", "from \"vue\"", 'element-plus', 'request(', 'axios', 'fetch(', 'window.', 'document.', 'localStorage', 'sessionStorage', 'Date.now', 'Math.random']) {
    assert.equal(policySource.includes(forbidden), false, `${file} gained runtime dependency: ${forbidden}`)
  }
  assert.equal(/new Date\(\s*\)/.test(policySource), false, `${file} gained implicit current time`)
}
assert.equal(policyExports, 36)

const count = (pattern) => (source.match(pattern) || []).length
assert.equal(count(/\brequest\s*\(/g), 1)
assert.equal(count(/router\.(?:push|replace)\(/g), 2)
assert.equal(count(/\bwatch\(/g), 1)
assert.equal(count(/\bsetInterval\(/g), 2)
assert.equal(count(/\bclearInterval\(/g), 2)
assert.equal(count(/requestAnimationFrame\(/g), 1)
assert.equal(count(/cancelAnimationFrame\(/g), 2)
assert.equal(count(/requestFullscreen\?\.\(/g), 1)
assert.equal(count(/exitFullscreen\?\.\(/g), 1)
assert.equal(count(/new\s+ResizeObserver\s*\(/g), 1)
assert.equal(count(/window\.addEventListener\(/g), 1)
assert.equal(count(/window\.removeEventListener\(/g), 1)
assert.equal(count(/document\.addEventListener\(/g), 1)
assert.equal(count(/document\.removeEventListener\(/g), 1)
assert.equal(count(/pushAiContext\(/g), 1)
assert.equal(count(/\bonMounted\(/g), 1)
assert.equal(count(/\bonBeforeUnmount\(/g), 1)

for (const forbidden of [/\bfetch\s*\(/, /\baxios\b/, /(?:local|session)Storage/, /new\s+EventSource\s*\(/, /new\s+WebSocket\s*\(/, /new\s+XMLHttpRequest\s*\(/, /window\.location(?:\.href)?\s*=/, /window\.location\.(?:assign|replace)\s*\(/]) {
  assert.equal(forbidden.test(source), false, `SalesCockpit reintroduced forbidden runtime access: ${forbidden}`)
}

for (const retainedBoundary of ['buildSalesCockpitQueryRequests().map((config) => request(config))', 'pushAiContext(buildCockpitContext())', 'router.push(`/app/${key}`)', "router.push('/apps')", 'target.requestFullscreen?.()', 'document.exitFullscreen?.()', "document.addEventListener('fullscreenchange', handleFullscreenChange)", "window.addEventListener('resize', scheduleCockpitScale)", 'new ResizeObserver(scheduleCockpitScale)', "window.removeEventListener('resize', scheduleCockpitScale)", "document.removeEventListener('fullscreenchange', handleFullscreenChange)", 'onMounted(() => {', 'onBeforeUnmount(() => {']) {
  assert.equal(source.includes(retainedBoundary), true, `SalesCockpit lost retained composition boundary: ${retainedBoundary}`)
}

console.log(`PASS: SalesCockpit composition exit gate (${lineCount} lines, ${policyImports.length} policy modules, ${policyExports} policy exports)`)
