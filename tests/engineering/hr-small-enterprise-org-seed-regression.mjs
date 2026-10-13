// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const seed = readFileSync(resolve(root, 'eiscore-hr/sql/hr_small_enterprise_org_seed.sql'), 'utf8')
const doc = readFileSync(resolve(root, 'docs/engineering/HR_SMALL_ENTERPRISE_ORG_SEED.md'), 'utf8')

assert.match(seed, /begin;[\s\S]*commit;/i)
assert.match(seed, /on conflict \(id\) do nothing/i)
for (const name of ['公司总部', '行政人事中心', '研发技术中心', '生产运营中心', '供应链中心', '市场客户中心']) {
  assert.match(seed, new RegExp(name))
}
for (const [child, parent] of [
  ['行政部', '行政人事中心'],
  ['研发部', '研发技术中心'],
  ['生产部', '生产运营中心'],
  ['采购部', '供应链中心'],
  ['销售部', '市场客户中心'],
  ['财务部', '公司总部']
]) {
  assert.match(seed, new RegExp(`\\('${child}', '${parent}'\\)`))
}
assert.match(seed, /child\.parent_id is null/i)
assert.match(doc, /公司总部[\s\S]*行政人事中心[\s\S]*生产运营中心/)
console.log('PASS: small enterprise HR organization seed preserves names and builds an idempotent tree')
