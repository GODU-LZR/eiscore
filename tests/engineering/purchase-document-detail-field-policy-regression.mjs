// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildPurchaseDocumentFileColumnPayload,
  getPurchaseDocumentFieldValue,
  normalizePurchaseDocumentOptionKey,
  normalizePurchaseDocumentOptionList,
  sanitizePurchaseDocumentCascaderValues,
  setPurchaseDocumentFieldValue
} from '../../eiscore-purchase/src/domain/purchase-document-detail-field-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')

const row = { name: 'Acme', properties: { parent: 'hardware', child: 'obsolete' } }
assert.equal(getPurchaseDocumentFieldValue(row, 'name'), 'Acme')
assert.equal(getPurchaseDocumentFieldValue(row, 'parent'), 'hardware')
assert.equal(getPurchaseDocumentFieldValue(row, 'missing'), '')
assert.equal(getPurchaseDocumentFieldValue(null, 'name'), '')
setPurchaseDocumentFieldValue(row, 'name', 'Beta')
setPurchaseDocumentFieldValue(row, 'new_field', 0)
assert.equal(row.name, 'Beta')
assert.equal(row.properties.new_field, 0)
setPurchaseDocumentFieldValue(null, 'ignored', 1)

assert.equal(normalizePurchaseDocumentOptionKey(null), '')
assert.equal(normalizePurchaseDocumentOptionKey(0), '0')
assert.deepEqual(normalizePurchaseDocumentOptionList(null), [])
assert.deepEqual(normalizePurchaseDocumentOptionList([
  { label: 'Hardware', value: 'hardware' },
  { value: 'software' },
  'other',
  0
]), [
  { label: 'Hardware', value: 'hardware' },
  { label: 'software', value: 'software' },
  { label: 'other', value: 'other' },
  { label: '0', value: 0 }
])

const dynamicColumns = [{
  type: 'cascader',
  prop: 'child',
  dependsOn: 'parent',
  cascaderOptions: {
    hardware: [{ label: 'Approved', value: 'approved' }],
    software: [{ label: 'Software', value: 'software' }]
  }
}]
sanitizePurchaseDocumentCascaderValues(row, dynamicColumns)
assert.equal(row.properties.child, '')
row.properties.child = 'approved'
row.properties.parent = 'hardware'
sanitizePurchaseDocumentCascaderValues(row, dynamicColumns)
assert.equal(row.properties.child, 'approved')
sanitizePurchaseDocumentCascaderValues(row, null)
sanitizePurchaseDocumentCascaderValues(null, dynamicColumns)

const fileRow = {
  properties: {
    attachments: [
      { name: 'a.pdf', url: '/a.pdf' },
      { fileName: 'b.png', dataUrl: 'data:image/png;base64,x' },
      { filename: 'c.txt', file_url: '' },
      { name: '', url: '/empty' }
    ]
  }
}
assert.deepEqual(buildPurchaseDocumentFileColumnPayload([
  { label: '附件', prop: 'attachments', type: 'file' },
  { label: '名称', prop: 'name', type: 'text' }
], fileRow), [{
  label: '附件',
  prop: 'attachments',
  files: [
    { name: 'a.pdf', url: '/a.pdf' },
    { name: 'b.png', url: 'data:image/png;base64,x' },
    { name: 'c.txt', url: '' },
    { name: '文件', url: '/empty' }
  ]
}])
assert.deepEqual(buildPurchaseDocumentFileColumnPayload([], null), [])

const moduleSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/domain/purchase-document-detail-field-policy.js'
), 'utf8')
for (const forbidden of [
  "from 'vue'", 'element-plus', 'request', 'axios', 'fetch(', 'window.', 'document.',
  'localStorage', 'sessionStorage', 'Date.now', 'Math.random', 'new Date'
]) {
  assert.equal(moduleSource.includes(forbidden), false, `field policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/views/PurchaseDocumentDetail.vue'
), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/purchase-document-detail-field-policy\.js['"]/) 
for (const removedDefinition of [
  'const getColumnValue =',
  'const getRowValueByProp =',
  'const setRowValueByProp =',
  'const normalizeOptionKey =',
  'const normalizeOptionList =',
  'const sanitizeCascaderValues =',
  'const buildFileColumnPayload ='
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `PurchaseDocumentDetail reintroduced ${removedDefinition}`)
}
for (const requiredCall of [
  'getPurchaseDocumentFieldValue(model, col.prop)',
  'buildPurchaseDocumentFileColumnPayload(columns, model)',
  'sanitizePurchaseDocumentCascaderValues(nextValue, dynamicColumns.value)'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `PurchaseDocumentDetail lost ${requiredCall}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 2035)

console.log('PASS: PurchaseDocumentDetail field policy preserves nested values, cascader cleanup and file projections')
