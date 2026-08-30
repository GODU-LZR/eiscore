// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  SALES_FLOW_TARGETS,
  openSalesFlowTarget
} from '../../eiscore-sales/src/platform/sales-flow-navigation.js'

assert.deepEqual(
  Object.fromEntries(Object.entries(SALES_FLOW_TARGETS).map(([key, value]) => [key, value.path])),
  {
    purchaseDemand: '/purchase/app/demands',
    shipmentRequest: '/sales/app/shipment_requests',
    salesOutbound: '/materials/inventory-stock-out?ioType=销售出库'
  }
)

const calls = []
const warnings = []
const success = openSalesFlowTarget('salesOutbound', {
  navigate: (path, options) => {
    calls.push({ path, options })
    return { ok: true, reason: '', moduleId: 'materials' }
  },
  onWarning: (message) => warnings.push(message)
})
assert.equal(success.ok, true)
assert.equal(calls[0].path, SALES_FLOW_TARGETS.salesOutbound.path)
assert.equal(calls[0].options.tabTitle, '销售出库')
assert.deepEqual(warnings, [])

const disabled = openSalesFlowTarget('purchaseDemand', {
  navigate: () => ({ ok: false, reason: 'module-disabled', moduleId: 'purchase' }),
  onWarning: (message) => warnings.push(message)
})
assert.equal(disabled.ok, false)
assert.equal(warnings.at(-1), '采购模块未启用，无法打开采购需求。')

const repoRoot = resolve(import.meta.dirname, '../..')
const componentSource = readFileSync(
  resolve(repoRoot, 'eiscore-sales/src/components/SalesAppGrid.vue'),
  'utf8'
)
assert.match(componentSource, /openSalesFlowTarget\('purchaseDemand'/)
assert.match(componentSource, /openSalesFlowTarget\('shipmentRequest'/)
assert.match(componentSource, /openSalesFlowTarget\('salesOutbound'/)
assert.doesNotMatch(componentSource, /window\.location\.href\s*=\s*['"]\/(purchase|sales|materials)\//)

console.log('PASS: sales flow navigation adapter')
