// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildPurchaseDocumentLinkQuery,
  buildPurchaseDocumentRowsQuery,
  encodePurchaseDocumentFilterValue,
  pickPurchaseDocumentRowForLinkSource,
  pickPurchaseDocumentRowForLinkTarget
} from '../../eiscore-purchase/src/domain/purchase-document-detail-business-flow-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')

assert.equal(encodePurchaseDocumentFilterValue('采购 订单/1'), '%E9%87%87%E8%B4%AD%20%E8%AE%A2%E5%8D%95%2F1')
assert.equal(buildPurchaseDocumentLinkQuery({
  direction: 'source', docType: 'purchase_demand', docId: 'd 1', docNo: 'REQ/01'
}), 'source_doc_type=eq.purchase_demand&status=eq.active&or=(source_doc_id.eq.d%201,source_doc_no.eq.REQ%2F01)&order=created_at.asc')
assert.equal(buildPurchaseDocumentLinkQuery({
  direction: 'target', docType: '采购订单', docId: '', docNo: ''
}), 'target_doc_type=eq.%E9%87%87%E8%B4%AD%E8%AE%A2%E5%8D%95&status=eq.active&order=created_at.asc')

assert.equal(buildPurchaseDocumentRowsQuery({
  table: 'purchase_orders', noField: 'order_no', ids: ['id 1'], nos: ['PO/01']
}), '/purchase_orders?or=(id.in.(id%201),order_no.in.(PO%2F01))&select=*&limit=50')
assert.equal(buildPurchaseDocumentRowsQuery({ table: 'purchase_orders', noField: 'order_no', ids: ['id 1'], nos: [] }), '/purchase_orders?or=(id.in.(id%201))&select=*&limit=50')
assert.equal(buildPurchaseDocumentRowsQuery({ table: 'purchase_orders', noField: 'order_no', ids: [], nos: [] }), '')

const rows = [
  { id: 'fallback', order_no: 'PO-fallback' },
  { id: 'matched-no', order_no: 'PO-02' },
  { id: 'matched-id', order_no: 'PO-03' }
]
assert.equal(pickPurchaseDocumentRowForLinkSource(rows, { source_doc_id: 'matched-id', source_doc_no: 'PO-02' }, 'order_no').id, 'matched-id')
assert.equal(pickPurchaseDocumentRowForLinkSource(rows, { source_doc_no: 'PO-02' }, 'order_no').id, 'matched-no')
assert.equal(pickPurchaseDocumentRowForLinkSource(rows, { source_doc_id: 'missing', source_doc_no: 'missing' }, 'order_no').id, 'fallback')
assert.equal(pickPurchaseDocumentRowForLinkSource([], null, 'order_no'), null)
assert.equal(pickPurchaseDocumentRowForLinkTarget(rows, { target_doc_id: 'matched-id', target_doc_no: 'PO-02' }, 'order_no').id, 'matched-id')
assert.equal(pickPurchaseDocumentRowForLinkTarget(rows, { target_doc_no: 'PO-02' }, 'order_no').id, 'matched-no')

const moduleSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/domain/purchase-document-detail-business-flow-policy.js'
), 'utf8')
for (const forbidden of [
  "from 'vue'", 'element-plus', 'request', 'axios', 'fetch(', 'window.', 'document.',
  'localStorage', 'sessionStorage', 'Date.now', 'Math.random', 'new Date'
]) {
  assert.equal(moduleSource.includes(forbidden), false, `business flow policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/views/PurchaseDocumentDetail.vue'
), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/purchase-document-detail-business-flow-policy\.js['"]/) 
for (const removedDefinition of [
  'const safeEq =',
  'const activeSourceLinkQuery =',
  'const activeTargetLinkQuery =',
  'const loadRowsByIdsOrNos =',
  'const pickRowForLinkSource =',
  'const pickRowForLinkTarget ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `PurchaseDocumentDetail reintroduced ${removedDefinition}`)
}
for (const requiredCall of [
  'buildPurchaseDocumentLinkQuery({ direction: \'target\'',
  'buildPurchaseDocumentRowsQuery(params)',
  'pickPurchaseDocumentRowForLinkSource',
  'pickPurchaseDocumentRowForLinkTarget'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `PurchaseDocumentDetail lost ${requiredCall}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 2003)

console.log('PASS: PurchaseDocumentDetail business-flow policy preserves encoded queries, row lookup and fallback precedence')
