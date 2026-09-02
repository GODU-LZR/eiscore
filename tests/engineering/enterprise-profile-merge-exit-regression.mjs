// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const audit = readFileSync(resolve(repoRoot, 'docs/engineering/ENTERPRISE_PROFILE_MERGE_EXIT_AUDIT.md'), 'utf8')
const adr = readFileSync(resolve(repoRoot, 'docs/engineering/adr/0011-enterprise-profile-single-source.md'), 'utf8')
const packageJson = JSON.parse(readFileSync(resolve(repoRoot, 'package.json'), 'utf8'))

for (const marker of [
  '唯一运行时事实源',
  '企业站点运营',
  '系统设置',
  '保存草稿 → 发布 → 公开 API → 基座重新加载',
  '80 条',
  '107 份',
  '148 个',
  '12/12',
  '未进入 G4',
  '原仓库'
]) {
  assert.ok(audit.includes(marker), `enterprise profile merge audit lost marker: ${marker}`)
}

assert.match(adr, /状态：接受/)
assert.match(adr, /company_site\.site_config/)
assert.match(adr, /唯一运行时事实源/)
assert.match(packageJson.scripts?.['test:quality'] || '', /npm run test:enterprise-profile/)
assert.match(packageJson.scripts?.['test:g3.5-exit'] || '', /enterprise-profile-merge-exit-regression/)
assert.match(packageJson.scripts?.['test:unit'] || '', /npm run test:company-site/)

console.log('PASS: enterprise profile merge checkpoint keeps ownership, evidence, isolation and G4 boundary explicit')
