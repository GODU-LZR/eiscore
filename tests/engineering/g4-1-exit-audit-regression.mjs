// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const audit = readFileSync(resolve(repoRoot, 'docs/engineering/G4_1_EXIT_AUDIT.md'), 'utf8')
const guide = readFileSync(resolve(repoRoot, 'docs/engineering/ENTERPRISE_SITE_CONFIGURATION.md'), 'utf8')
const index = readFileSync(resolve(repoRoot, 'docs/engineering/README.md'), 'utf8')
const progress = readFileSync(resolve(repoRoot, 'docs/engineering/REFACTOR_PROGRESS.md'), 'utf8')
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'))

for (const marker of [
  'G4.1 已完成',
  '确定性 Manifest',
  'packageSha256',
  'applyMode=initialize-only',
  'initialStatus=draft',
  'SQL/DDL',
  'approved',
  '没有创建三家看似完整的生产包',
  'G4.2',
  'G4.3',
  'G4.4'
]) {
  assert.ok(audit.includes(marker), `G4.1 exit audit lost required marker: ${marker}`)
}

for (const marker of [
  '实施运营台是配置设计、资料追溯、审核和交付控制面',
  'company_site.site_config',
  'initialize-only',
  '显式检查和发布',
  '不创建看似完整的三家生产包'
]) {
  assert.ok(guide.includes(marker), `enterprise site guide lost ownership marker: ${marker}`)
}

assert.match(index, /G4\.1[^\n]*已完成/)
assert.match(progress, /G4 产品配置化 \| 进行中（G4\.0～G4\.1 已完成[^）]*）/)
assert.match(packageJson.scripts?.['test:g4.1-exit'] || '', /g4-1-exit-audit-regression\.mjs/)
assert.match(packageJson.scripts?.['test:quality'] || '', /npm run test:g4\.1-exit/)
assert.match(packageJson.scripts?.['test:enterprise-package'] || '', /enterprise-package-cli-regression\.mjs/)

console.log('PASS: G4.1 exit audit keeps deterministic packaging, fail-closed validation, site ownership and G4.2 isolation evidence')
