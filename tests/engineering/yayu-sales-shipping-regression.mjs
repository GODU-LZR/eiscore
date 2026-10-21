// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSalesFlowNodes,
  filterSalesOrderStatusOptions,
  getSalesFlowDownstreamState
} from '../../eiscore-sales/src/domain/sales-grid-flow-policy.js'
import { isSalesShippingEnabled } from '../../eiscore-sales/src/platform/sales-flow-navigation.js'
import { getSalesRecordAttention, offsetDateText } from '../../eiscore-sales/src/utils/sales-attention.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const config = JSON.parse(readFileSync(resolve(repoRoot, 'deploy/yayu/eiscore-enterprise.json'), 'utf8'))
const appsSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/views/SalesApps.vue'), 'utf8')
const viewSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/views/SalesAppView.vue'), 'utf8')
const gridSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/components/SalesAppGrid.vue'), 'utf8')

assert.equal(config.features.salesShipping, false)
assert.equal(isSalesShippingEnabled(config), false)
assert.match(appsSource, /app\.key !== 'shipment_requests'\s*\|\|\s*salesShippingEnabled/)
assert.match(viewSource, /appKey\.value === 'shipment_requests'\s*&&\s*enterpriseConfig\.features\?\.salesShipping === false/)
assert.match(appsSource, /const apps = SALES_APPS\.filter\(\(app\) => app\.apiUrl\)\s*\.filter\(\(app\) => app\.key !== 'shipment_requests' \|\| salesShippingEnabled\)/s)
assert.match(gridSource, /const salesShippingEnabled = enterpriseConfig\.features\?\.salesShipping !== false/)
assert.match(gridSource, /includeShipping: salesShippingEnabled/)
assert.match(gridSource, /if \(!salesShippingEnabled\)/)

const nodes = buildSalesFlowNodes({
  order: { order_no: 'SO-1', order_status: '已确认' },
  docs: {
    salesShipment: { shipment_no: 'SHIP-1' },
    salesOutbound: { outbound_no: 'OUT-1' }
  },
  includeShipping: false
})
assert.deepEqual(nodes.map((node) => node.key), ['so', 'pr', 'po', 'pa', 'in'])
assert.equal(nodes.some((node) => /出货|出库/.test(node.type)), false)
assert.deepEqual(
  filterSalesOrderStatusOptions(['草稿', '部分出库', '已发货', '已完成'], false),
  ['草稿', '已完成']
)
assert.deepEqual(
  filterSalesOrderStatusOptions([
    { label: '草稿', value: '草稿' },
    { label: '已发货', value: '已发货' }
  ], false),
  [{ label: '草稿', value: '草稿' }]
)
assert.deepEqual(
  filterSalesOrderStatusOptions(['部分出库', '已发货'], true),
  ['部分出库', '已发货']
)
assert.equal(
  getSalesRecordAttention('orders', { delivery_date: offsetDateText(-1) }, { salesShippingEnabled: false }).action,
  '确认交付安排'
)
assert.equal(
  getSalesRecordAttention('orders', { delivery_date: offsetDateText(-1) }, { salesShippingEnabled: true }).action,
  '下推出货/出库'
)
assert.match(gridSource, /filterSalesOrderStatusOptions\(column\.options, false\)/)

assert.deepEqual(
  getSalesFlowDownstreamState({ nextStep: 'shipment_request', includeShipping: false }),
  { label: '下游采购需求', docNo: '未生成', status: '可下推生成', buttonType: 'success' }
)

console.log('PASS: Yayu sales shipping is removed from cards, routes and flow presentation')
