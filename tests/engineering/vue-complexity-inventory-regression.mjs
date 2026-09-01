// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const baselinePath = resolve(repoRoot, 'config/engineering/vue-complexity-baseline.json')
const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))

assert.equal(baseline.version, 1)
assert.equal(baseline.thresholdLines, 800)
assert.equal(baseline.scope, 'eiscore-*/src/**/*.vue')
assert.deepEqual(baseline.excludedDirectories, ['.app-drafts', 'coverage', 'dist', 'node_modules'])

const excluded = new Set(baseline.excludedDirectories)
const baselineEntries = Object.entries(baseline.files)
assert.equal(baselineEntries.length, 52)
for (const [file, cap] of baselineEntries) {
  assert.equal(file.includes('\\'), false, `baseline path must use POSIX separators: ${file}`)
  assert.ok(Number.isInteger(cap) && cap >= baseline.thresholdLines, `invalid line cap for ${file}`)
}

const vueFiles = []
const walk = (directory) => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excluded.has(entry.name)) continue
    const target = join(directory, entry.name)
    if (entry.isDirectory()) {
      walk(target)
    } else if (entry.isFile() && entry.name.endsWith('.vue')) {
      const file = relative(repoRoot, target).replaceAll('\\', '/')
      const lines = readFileSync(target, 'utf8').split(/\r?\n/).length
      vueFiles.push({ file, lines })
    }
  }
}

for (const entry of readdirSync(repoRoot, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith('eiscore-')) continue
  const sourceRoot = join(repoRoot, entry.name, 'src')
  if (existsSync(sourceRoot)) walk(sourceRoot)
}

const currentByFile = new Map(vueFiles.map((item) => [item.file, item.lines]))
const currentGiants = vueFiles
  .filter((item) => item.lines >= baseline.thresholdLines)
  .sort((a, b) => b.lines - a.lines || a.file.localeCompare(b.file))

const newGiants = currentGiants.filter((item) => !(item.file in baseline.files))
assert.deepEqual(newGiants, [], `new giant Vue files require decomposition instead of baseline expansion: ${JSON.stringify(newGiants)}`)

for (const [file, cap] of baselineEntries) {
  const current = currentByFile.get(file)
  if (current === undefined) continue
  assert.ok(current <= cap, `${file} grew from its ${cap}-line baseline to ${current}`)
}

const currentDebtLines = baselineEntries.reduce((sum, [file]) => sum + (currentByFile.get(file) || 0), 0)
const baselineDebtLines = baselineEntries.reduce((sum, [, lines]) => sum + lines, 0)
assert.equal(baselineDebtLines, 85960)
assert.ok(currentDebtLines <= baselineDebtLines, `giant Vue debt grew from ${baselineDebtLines} to ${currentDebtLines} lines`)
assert.ok(currentGiants.length <= 52, `giant Vue count grew from 52 to ${currentGiants.length}`)
assert.ok(currentGiants.filter((item) => item.lines >= 1200).length <= 32, 'critical Vue count (>=1200 lines) grew')
assert.ok(currentGiants.filter((item) => item.lines >= 2000).length <= 11, 'extreme Vue count (>=2000 lines) grew')

console.log(`PASS: giant Vue inventory locked (${vueFiles.length} files, ${currentGiants.length} >=800, ${currentDebtLines}/${baselineDebtLines} debt lines)`)
