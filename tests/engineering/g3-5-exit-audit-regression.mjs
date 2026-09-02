// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const audit = readFileSync(resolve(repoRoot, 'docs/engineering/G3_5_EXIT_AUDIT.md'), 'utf8')
const progress = readFileSync(resolve(repoRoot, 'docs/engineering/REFACTOR_PROGRESS.md'), 'utf8')
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'))

for (const marker of [
  'Node 20.19.0 / npm 10.8.2',
  '20/20',
  '32/32',
  '77/77',
  'cleanupErrors=[]',
  '92 份历史 SQL',
  'EISCORE_SMOKE_SKIP_AI=1',
  '本轮未进入 G4',
  '原仓库'
]) {
  assert.ok(audit.includes(marker), `G3.5 audit lost required evidence marker: ${marker}`)
}

for (const scriptName of [
  'test:ci',
  'test:smoke',
  'test:business-chain',
  'test:e2e',
  'test:e2e:clicks',
  'test:e2e:business-chain',
  'test:e2e:functions67',
  'test:runtime-image',
  'test:vite-dev-proxy',
  'test:infrastructure'
]) {
  assert.equal(typeof packageJson.scripts?.[scriptName], 'string', `missing G3.5 evidence command: ${scriptName}`)
}

assert.match(packageJson.scripts?.['test:quality'] || '', /npm run test:g3\.5-exit/)

assert.ok(!progress.includes('本文件所在提交'), 'refactor progress ledger contains unresolved commit placeholders')
const progressCommitRefs = [...new Set([...progress.matchAll(/`([0-9a-f]{7})`/g)].map((match) => match[1]))]
assert.ok(progressCommitRefs.length > 0, 'refactor progress ledger lost commit references')
const progressCommitTypes = execFileSync(
  'git',
  ['cat-file', '--batch-check=%(objectname) %(objecttype)'],
  {
    cwd: repoRoot,
    encoding: 'utf8',
    input: progressCommitRefs.map((hash) => `${hash}^{commit}`).join('\n')
  }
).trim().split(/\r?\n/)
assert.equal(progressCommitTypes.length, progressCommitRefs.length, 'refactor progress ledger commit verification count drifted')
for (const [index, line] of progressCommitTypes.entries()) {
  assert.match(line, /^[0-9a-f]{40} commit$/, `invalid refactor progress commit reference: ${progressCommitRefs[index]}`)
}

console.log(`PASS: G3.5 exit audit keeps runtime, CI, smoke, business-chain, E2E, isolation, accepted-risk and ${progressCommitRefs.length} ledger commit references`)
