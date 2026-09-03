// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const audit = readFileSync(resolve(repoRoot, 'docs/engineering/G4_0_EXIT_AUDIT.md'), 'utf8')
const progress = readFileSync(resolve(repoRoot, 'docs/engineering/REFACTOR_PROGRESS.md'), 'utf8')
const adr = readFileSync(resolve(repoRoot, 'docs/engineering/adr/0012-isolated-single-tenant-enterprise-packages.md'), 'utf8')
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'))

for (const marker of [
  'G4.0 已完成',
  '独立数据库与运行环境',
  '同一核心制品',
  '显式支持 `[1, 2]`',
  'template/draft/candidate/approved',
  '254 个文件',
  '1,391 个文本文件',
  'G4.1'
]) {
  assert.ok(audit.includes(marker), `G4.0 exit audit lost required marker: ${marker}`)
}
assert.match(adr, /状态：接受/)
assert.match(adr, /用户于 2026-09-03 确认/)
assert.match(progress, /G4 产品配置化 \| 进行中/)
assert.match(packageJson.scripts?.['test:g4.0-exit'] || '', /g4-0-exit-audit-regression\.mjs/)
assert.match(packageJson.scripts?.['test:quality'] || '', /npm run test:g4\.0-exit/)

console.log('PASS: G4.0 exit audit keeps topology, v1/v2 compatibility, enterprise package and isolation evidence')
