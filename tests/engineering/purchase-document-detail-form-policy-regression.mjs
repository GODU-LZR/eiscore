// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildPurchaseDocumentFormValueKey,
  buildPurchaseDocumentFormValuesQuery,
  buildPurchaseDocumentSavePayload,
  splitPurchaseDocumentFormUpdate
} from '../../eiscore-purchase/src/domain/purchase-document-detail-form-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')

assert.equal(buildPurchaseDocumentFormValueKey({ templateLibraryKey: 'purchase_orders_form_templates', templateId: 'tpl 1' }), 'purchase_orders_form_templates:tpl 1')
assert.equal(buildPurchaseDocumentFormValuesQuery({ rowId: 'row/1', templateLibraryKey: 'purchase_orders_form_templates', templateId: 'tpl 1' }), '/form_values?row_id=eq.row%2F1&template_id=eq.purchase_orders_form_templates%3Atpl%201')

const current = { id: 'row-1', name: '旧名称', status: 'active', properties: { known: 'old', retained: 'yes' } }
const update = splitPurchaseDocumentFormUpdate({
  currentRow: current,
  nextValue: { id: 'row-1', name: '新名称', properties: { known: 'new', extra: 3 } },
  knownKeys: ['known', 'retained']
})
assert.deepEqual(update, {
  rowPatch: { id: 'row-1', name: '新名称' },
  properties: { known: 'new', retained: 'yes' },
  extraValues: { extra: 3 }
})
assert.deepEqual(splitPurchaseDocumentFormUpdate({
  currentRow: { id: 1, properties: { stale: 'kept' } },
  nextValue: { id: 1, properties: { extension: 'value' } },
  knownKeys: ['known'],
  supportsProperties: false
}), {
  rowPatch: { id: 1 },
  properties: undefined,
  extraValues: { extension: 'value' }
})

assert.deepEqual(buildPurchaseDocumentSavePayload({
  row: {
    id: 'row-1', created_at: 'created', updated_at: 'updated', arrived_quantity: 2,
    pending_quantity: 1, arrival_progress: '部分到货', name: '名称', properties: { note: 'x' }
  }
}), { name: '名称', properties: { note: 'x' } })
assert.deepEqual(buildPurchaseDocumentSavePayload({
  row: { id: 1, name: '名称', properties: { note: 'x' } }, supportsProperties: false
}), { name: '名称' })

const moduleSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/domain/purchase-document-detail-form-policy.js'
), 'utf8')
for (const forbidden of [
  "from 'vue'", 'element-plus', 'request', 'axios', 'fetch(', 'window.', 'document.',
  'localStorage', 'sessionStorage', 'Date.now', 'Math.random', 'new Date'
]) {
  assert.equal(moduleSource.includes(forbidden), false, `form policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/views/PurchaseDocumentDetail.vue'
), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/purchase-document-detail-form-policy\.js['"]/) 
for (const removedDefinition of [
  'const detailFormValueKey = computed(() => `${templateLibraryKey.value}:${selectedTemplateId.value}`)',
  'const buildSavePayload =',
  'const knownKeys = knownPropertyKeys.value'
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `PurchaseDocumentDetail reintroduced ${removedDefinition}`)
}
for (const requiredCall of [
  'buildPurchaseDocumentFormValuesQuery({',
  'splitPurchaseDocumentFormUpdate({',
  'buildPurchaseDocumentSavePayload({'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `PurchaseDocumentDetail lost ${requiredCall}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 1993)

console.log('PASS: PurchaseDocumentDetail form policy preserves value keys, update partitioning and save payload filtering')
