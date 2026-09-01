// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildPurchaseArrivalExceptionPatch,
  buildPurchaseDemandClosePatch,
  buildPurchaseDemandReopenPatch,
  buildPurchaseDemandSubmitPatch,
  buildPurchaseOrderCancelPatch,
  buildPurchaseOrderConfirmPatch,
  buildPurchaseSupplierPausePatch,
  buildPurchaseSupplierResumePatch,
  buildPurchaseSupplierReviewPatch
} from '../../eiscore-purchase/src/domain/purchase-document-detail-status-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const row = { id: 1, properties: { keep: 'yes' } }
const at = '2026-09-02T00:00:00.000Z'

assert.deepEqual(buildPurchaseSupplierReviewPatch({ row, reviewDate: '2026-09-02', reviewedAt: at }), {
  supplier_status: '合作中', status: 'active', last_review_at: '2026-09-02', properties: { keep: 'yes', reviewed_at: at }
})
assert.deepEqual(buildPurchaseSupplierPausePatch({ row, reason: '资质过期', pausedAt: at }), {
  supplier_status: '暂停合作', status: 'disabled', properties: { keep: 'yes', pause_reason: '资质过期', paused_at: at }
})
assert.deepEqual(buildPurchaseSupplierResumePatch({ row, resumedAt: at }), {
  supplier_status: '合作中', status: 'active', properties: { keep: 'yes', resumed_at: at }
})
assert.deepEqual(buildPurchaseDemandSubmitPatch(), { demand_status: '待采购', status: 'active' })
assert.deepEqual(buildPurchaseDemandClosePatch({ row, reason: '预算冻结', closedAt: at }), {
  demand_status: '已关闭', status: 'disabled', properties: { keep: 'yes', close_reason: '预算冻结', closed_at: at }
})
assert.deepEqual(buildPurchaseDemandReopenPatch({ row, reopenedAt: at }), {
  demand_status: '待采购', status: 'active', properties: { keep: 'yes', reopened_at: at }
})
assert.deepEqual(buildPurchaseOrderConfirmPatch(), { order_status: '已下单', status: 'active' })
assert.deepEqual(buildPurchaseOrderCancelPatch({ row, reason: '供应商变更', canceledAt: at }), {
  order_status: '已取消', status: 'disabled', properties: { keep: 'yes', cancel_reason: '供应商变更', canceled_at: at }
})
assert.deepEqual(buildPurchaseArrivalExceptionPatch({ row, reason: '包装破损' }), {
  accepted_quantity: 0, iqc_status: '不合格', arrival_status: '异常', status: 'active', properties: { keep: 'yes', exception_note: '包装破损' }
})
assert.deepEqual(row, { id: 1, properties: { keep: 'yes' } })

const moduleSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/domain/purchase-document-detail-status-policy.js'
), 'utf8')
for (const forbidden of [
  "from 'vue'", 'element-plus', 'request', 'axios', 'fetch(', 'window.', 'document.',
  'localStorage', 'sessionStorage', 'Date.now', 'Math.random', 'new Date'
]) {
  assert.equal(moduleSource.includes(forbidden), false, `status policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(
  repoRoot,
  'eiscore-purchase/src/views/PurchaseDocumentDetail.vue'
), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/purchase-document-detail-status-policy\.js['"]/) 
for (const requiredCall of [
  'buildPurchaseSupplierReviewPatch({',
  'buildPurchaseDemandClosePatch({',
  'buildPurchaseOrderCancelPatch({',
  'buildPurchaseArrivalExceptionPatch({'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `PurchaseDocumentDetail lost ${requiredCall}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 1975)

console.log('PASS: PurchaseDocumentDetail status policy preserves supplier, demand, order and arrival patches')
