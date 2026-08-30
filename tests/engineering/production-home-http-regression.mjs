// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const source = readFileSync(resolve(repoRoot, 'eiscore-production/src/views/HomeView.vue'), 'utf8')
const request = readFileSync(resolve(repoRoot, 'eiscore-production/src/utils/request.js'), 'utf8')

assert.match(source, /import request from ['"]@\/utils\/request['"]/)
assert.doesNotMatch(source, /\bfetch\s*\(|\bAPI_BASE\b|\bgetAuthHeader\b/)
assert.match(source, /const apiRequest = async \(path, options = \{\}\) =>/)
assert.match(source, /request\(\{\s*\.\.\.config,\s*url:\s*path,/)
assert.match(source, /method,\s*data:\s*data !== undefined \? data : body/)
assert.match(source, /silentError:\s*true/)
assert.match(source, /error\?\.displayMessage \|\| error\?\.message \|\| ['"]请求失败['"]/)

for (const target of [
  '/v_sales_bom_production_plan?select=*&order=product_material_code.asc',
  '/v_production_work_orders?select=*&order=created_at.desc',
  '/v_production_work_order_items?select=*&order=shortage_qty.desc,line_no.asc&limit=2000',
  '/rpc/create_work_orders_from_sales_bom',
  '/production_work_orders?id=eq.'
]) {
  assert.ok(source.includes(target), 'production home must retain target ' + target)
}
assert.match(source, /method:\s*['"]POST['"]/)
assert.match(source, /method:\s*['"]PATCH['"]/)
assert.match(source, /Prefer:\s*['"]return=minimal['"]/)
assert.match(request, /shouldNotifyError:\s*\(config\)\s*=>\s*\(\s*config\.silentError !== true && config\.suppressErrorMessage !== true/)
assert.match(request, /resolveErrorMessage:\s*\(error\)\s*=>\s*error\?\.response\?\.data\?\.message/)

console.log('PASS: production home uses platform Request')
