// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildPurchaseDocumentFallbackSchema,
  buildPurchaseDocumentSchemaSection,
  getPurchaseDocumentNoField,
  normalizePurchaseDocumentSchemaColumns,
  resolvePurchaseDocumentSchemaWidget
} from '../../eiscore-purchase/src/domain/purchase-document-detail-schema-policy.js'
import { documentSchemaExample } from '../../eiscore-purchase/src/components/eis-document-engine/documentSchemaExample.js'

const repoRoot = resolve(import.meta.dirname, '../..')

assert.deepEqual(normalizePurchaseDocumentSchemaColumns(null), [])
assert.deepEqual(normalizePurchaseDocumentSchemaColumns([
  null,
  { label: '', prop: 'empty' },
  { label: 'No prop' },
  { label: 'Name', prop: 'name', type: 'text' }
]), [{ label: 'Name', prop: 'name', type: 'text' }])

assert.equal(resolvePurchaseDocumentSchemaWidget({ type: 'select' }), 'select')
assert.equal(resolvePurchaseDocumentSchemaWidget({ type: 'cascader' }), 'cascader')
assert.equal(resolvePurchaseDocumentSchemaWidget({ type: 'number' }), 'number')
assert.equal(resolvePurchaseDocumentSchemaWidget({ prop: 'required_date' }), 'date')
assert.equal(resolvePurchaseDocumentSchemaWidget({ prop: 'updated_at' }), 'date')
assert.equal(resolvePurchaseDocumentSchemaWidget({ type: 'file', prop: 'attachment' }), 'image')
assert.equal(resolvePurchaseDocumentSchemaWidget({ type: 'text', prop: 'name' }), 'input')

assert.equal(buildPurchaseDocumentSchemaSection('空', []), null)
assert.deepEqual(buildPurchaseDocumentSchemaSection('基础信息', [
  { label: '供应商', prop: 'supplier_name', type: 'text' },
  { label: '数量', prop: 'quantity', type: 'number' }
]), {
  type: 'section',
  title: '基础信息',
  cols: 2,
  children: [
    { label: '供应商', field: 'supplier_name', widget: 'input' },
    { label: '数量', field: 'quantity', widget: 'number' }
  ]
})

assert.equal(getPurchaseDocumentNoField('suppliers'), 'supplier_no')
assert.equal(getPurchaseDocumentNoField('demands'), 'demand_no')
assert.equal(getPurchaseDocumentNoField('orders'), 'order_no')
assert.equal(getPurchaseDocumentNoField('arrivals'), 'arrival_no')
assert.equal(getPurchaseDocumentNoField('unknown'), '')

const scope = { app: 'purchase', key: 'orders' }
const fallback = buildPurchaseDocumentFallbackSchema({
  appKey: 'orders',
  pageTitle: '采购订单单据',
  scope,
  staticColumns: [
    { label: '订单号', prop: 'order_no', type: 'text' },
    { label: '订单日期', prop: 'order_date', type: 'date' }
  ],
  dynamicColumns: [{ label: '附件', prop: 'files', type: 'file' }]
})
assert.deepEqual(fallback, {
  docType: 'purchase_orders_auto',
  title: '采购订单单据',
  docNo: 'order_no',
  scope,
  layout: [
    {
      type: 'section',
      title: '基础信息',
      cols: 2,
      children: [
        { label: '订单号', field: 'order_no', widget: 'input' },
        { label: '订单日期', field: 'order_date', widget: 'date' }
      ]
    },
    {
      type: 'section',
      title: '扩展信息',
      cols: 2,
      children: [{ label: '附件', field: 'files', widget: 'image' }]
    }
  ]
})
assert.strictEqual(buildPurchaseDocumentFallbackSchema({
  appKey: 'unknown',
  pageTitle: '无列单据',
  scope,
  staticColumns: [],
  dynamicColumns: []
}), documentSchemaExample)

const moduleSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/domain/purchase-document-detail-schema-policy.js'
), 'utf8')
for (const forbidden of [
  "from 'vue'",
  'element-plus',
  'request',
  'axios',
  'fetch(',
  'window.',
  'document.',
  'localStorage',
  'sessionStorage',
  'Date.now',
  'Math.random',
  'new Date'
]) {
  assert.equal(moduleSource.includes(forbidden), false, `schema policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/views/PurchaseDocumentDetail.vue'
), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/purchase-document-detail-schema-policy\.js['"]/) 
for (const removedDefinition of [
  'const normalizeSchemaColumns =',
  'const buildSchemaSection =',
  'const resolveSchemaWidget =',
  'const getDocNoField ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `PurchaseDocumentDetail reintroduced ${removedDefinition}`)
}
assert.match(pageSource, /buildPurchaseDocumentFallbackSchema\(\{/) 
assert.ok(pageSource.split(/\r?\n/).length <= 2100)

console.log('PASS: PurchaseDocumentDetail schema policy preserves fallback templates, field widgets and document-number mapping')
