// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const config = JSON.parse(readFileSync(resolve(repoRoot, 'deploy/yayu/eiscore-enterprise.json'), 'utf8'))
const source = readFileSync(resolve(repoRoot, 'eiscore-base/src/layout/index.vue'), 'utf8')

assert.equal(config.enterprise.id, 'yayu')
assert.equal(config.features.sopCompact, true)
assert.equal(config.features.salesShipping, false)
assert.equal(config.features.flashHarness, true)
assert.equal(config.features.materialsVisible, false)
assert.equal(config.features.purchaseVisible, false)
assert.match(source, /enterpriseConfig\.features\?\.sopCompact === true/)
assert.match(source, /role-path-warehouse/)
assert.match(source, /role-path-purchase/)
assert.match(source, /role-path-production/)
assert.match(source, /role-path-quality/)
assert.match(source, /role-path-equipment/)
assert.match(source, /客户 - 跟进 - 商机 - 报价\/合同 - 订单 - 回款/)
assert.match(source, /客户、跟进、商机、报价、合同、销售订单和回款/)
assert.match(source, /contracts: '销售合同'/)
assert.match(source, /合同金额、订单状态和回款核销/)
assert.match(source, /role-path-manager'\s*\?\s*\[/)
assert.match(source, /yayu-harness-workflow/)
assert.match(source, /HTML、DTO、ECharts 或流程输出/)
assert.match(source, /先预览结果，再继续修改/)
assert.match(source, /无误后再发布/)
assert.match(source, /guideCenterTitle/)

console.log('PASS: yayu compact SOP contract')
