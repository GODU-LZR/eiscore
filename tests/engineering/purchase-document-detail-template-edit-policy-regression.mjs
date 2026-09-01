// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildPurchaseDocumentManualTemplate,
  removePurchaseDocumentTemplate,
  renamePurchaseDocumentTemplate
} from '../../eiscore-purchase/src/domain/purchase-document-detail-template-edit-policy.js'
import { applyPurchaseDocumentTemplateScope } from '../../eiscore-purchase/src/domain/purchase-document-detail-template-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const scope = { app: 'purchase', key: 'orders' }
const templates = [{ id: 'tpl-1', name: '旧名', schema: { title: '旧名', layout: [] }, scope: { legacy: true } }, { id: 'tpl-2', name: '二', schema: { layout: [] } }]

const renamed = renamePurchaseDocumentTemplate({
  templates,
  templateId: 'tpl-1',
  name: '新名',
  updatedAt: '2026-09-02T00:00:00.000Z',
  scope,
  applyScope: applyPurchaseDocumentTemplateScope
})
assert.deepEqual(renamed[0], {
  id: 'tpl-1', name: '新名', schema: { title: '新名', layout: [], scope },
  scope: { legacy: true, ...scope }, updated_at: '2026-09-02T00:00:00.000Z'
})
assert.deepEqual(templates[0], { id: 'tpl-1', name: '旧名', schema: { title: '旧名', layout: [] }, scope: { legacy: true } })
assert.deepEqual(renamePurchaseDocumentTemplate({ templates, templateId: 'missing', name: 'x' }), templates)

const manual = buildPurchaseDocumentManualTemplate({
  id: 'purchase_orders_1',
  name: '订单模板',
  schema: { title: '基础', docType: 'fallback', layout: [] },
  now: '2026-09-02T00:00:00.000Z',
  scope,
  applyScope: applyPurchaseDocumentTemplateScope
})
assert.deepEqual(manual, {
  id: 'purchase_orders_1', name: '订单模板', source: 'manual',
  created_at: '2026-09-02T00:00:00.000Z', updated_at: '2026-09-02T00:00:00.000Z',
  schema: { title: '订单模板', docType: 'purchase_orders_1', layout: [], scope }, scope
})

assert.deepEqual(removePurchaseDocumentTemplate({ templates, templateId: 'tpl-1', selectedId: 'tpl-1' }), {
  templates: [templates[1]], selectedId: 'tpl-2'
})
assert.deepEqual(removePurchaseDocumentTemplate({ templates, templateId: 'tpl-1', selectedId: 'tpl-2' }), {
  templates: [templates[1]], selectedId: 'tpl-2'
})

const moduleSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/domain/purchase-document-detail-template-edit-policy.js'
), 'utf8')
for (const forbidden of [
  "from 'vue'", 'element-plus', 'request', 'axios', 'fetch(', 'window.', 'document.',
  'localStorage', 'sessionStorage', 'Date.now', 'Math.random', 'new Date'
]) {
  assert.equal(moduleSource.includes(forbidden), false, `template edit policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/views/PurchaseDocumentDetail.vue'
), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/purchase-document-detail-template-edit-policy\.js['"]/) 
for (const requiredCall of [
  'renamePurchaseDocumentTemplate({',
  'buildPurchaseDocumentManualTemplate({',
  'removePurchaseDocumentTemplate({'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `PurchaseDocumentDetail lost ${requiredCall}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 1980)

console.log('PASS: PurchaseDocumentDetail template edit policy preserves rename, manual creation and selection fallback')
