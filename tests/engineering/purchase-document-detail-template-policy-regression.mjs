// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  applyPurchaseDocumentTemplateScope,
  isPurchaseDocumentTemplate,
  normalizePurchaseDocumentTemplates,
  selectPurchaseDocumentTemplateId
} from '../../eiscore-purchase/src/domain/purchase-document-detail-template-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const scope = { app: 'purchase', key: 'orders', configKey: 'purchase_orders_cols' }
const valid = { id: 'tpl-1', name: '订单模板', schema: { title: '旧标题', layout: [] }, scope: { legacy: true } }
const invalid = { id: 'bad', schema: { title: '缺布局' } }

assert.equal(isPurchaseDocumentTemplate(valid), true)
assert.equal(isPurchaseDocumentTemplate(invalid), false)
assert.equal(isPurchaseDocumentTemplate(null), false)
assert.deepEqual(applyPurchaseDocumentTemplateScope(valid, scope), {
  id: 'tpl-1',
  name: '订单模板',
  schema: { title: '旧标题', layout: [], scope },
  scope: { legacy: true, ...scope }
})
assert.deepEqual(normalizePurchaseDocumentTemplates([valid, invalid, null], scope), [
  { id: 'tpl-1', name: '订单模板', schema: { title: '旧标题', layout: [], scope }, scope: { legacy: true, ...scope } }
])
assert.deepEqual(normalizePurchaseDocumentTemplates(null, scope), [])

const normalized = normalizePurchaseDocumentTemplates([
  { id: 'first', schema: { layout: [] } },
  { id: 'second', schema: { layout: [] } }
], scope)
assert.equal(selectPurchaseDocumentTemplateId({ recordId: 'event', currentId: 'current', templates: normalized }), 'event')
assert.equal(selectPurchaseDocumentTemplateId({ currentId: 'current', templates: normalized }), 'current')
assert.equal(selectPurchaseDocumentTemplateId({ templates: normalized }), 'first')
assert.equal(selectPurchaseDocumentTemplateId({ templates: [] }), '')

const moduleSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/domain/purchase-document-detail-template-policy.js'
), 'utf8')
for (const forbidden of [
  "from 'vue'", 'element-plus', 'request', 'axios', 'fetch(', 'window.', 'document.',
  'localStorage', 'sessionStorage', 'Date.now', 'Math.random', 'new Date'
]) {
  assert.equal(moduleSource.includes(forbidden), false, `template policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/views/PurchaseDocumentDetail.vue'
), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/purchase-document-detail-template-policy\.js['"]/) 
assert.equal(pageSource.includes('const withCurrentScope ='), false)
for (const requiredCall of [
  'normalizePurchaseDocumentTemplates(list, templateScope.value)',
  'selectPurchaseDocumentTemplateId({',
  'applyScope: applyPurchaseDocumentTemplateScope'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `PurchaseDocumentDetail lost ${requiredCall}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 2023)

console.log('PASS: PurchaseDocumentDetail template policy preserves filtering, scope merging and selection precedence')
