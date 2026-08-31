// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildSalesQuickFollowEntry,
  buildSalesQuickFollowForm,
  buildSalesQuickOpportunityEntry,
  buildSalesQuickOpportunityForm,
  buildSalesQuickOrderEntry,
  buildSalesQuickOrderFallbackPayload,
  buildSalesQuickOrderForm,
  buildSalesQuickPaymentEntry,
  buildSalesQuickPaymentForm,
  calculateSalesQuickOrderTotal
} from '../../eiscore-sales/src/domain/sales-grid-quick-entry-policy.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const dates = { today: '2026-09-01', deliveryDate: '2026-09-08' }
assert.deepEqual(buildSalesQuickOrderForm(null, dates), {
  customer_id: '', product_material_id: null, product_name: '', quantity: 1, unit: '箱', unit_price: 0,
  order_date: '2026-09-01', delivery_date: '2026-09-08', order_status: '已确认', owner_name: ''
})
assert.deepEqual(buildSalesQuickOrderForm({
  id: 3,
  customer_id: 2,
  opportunity_no: 'OPP-3',
  opportunity_name: '商机A',
  product_material_id: 7,
  expected_amount: '100.5',
  owner_name: '张三'
}, dates), {
  customer_id: 2,
  product_material_id: 7,
  product_name: '商机A',
  quantity: 1,
  unit: '箱',
  unit_price: 100.5,
  order_date: '2026-09-01',
  delivery_date: '2026-09-08',
  order_status: '已确认',
  owner_name: '张三'
})
assert.equal(buildSalesQuickOrderForm({ id: 3, opportunity_no: 'OPP-3' }, dates).customer_id, '')

assert.deepEqual(buildSalesQuickPaymentForm({
  order_id: 9,
  name: '客户A',
  amount: '80',
  handler_name: '李四'
}, { today: '2026-09-01' }), {
  order_id: 9,
  customer_name: '客户A',
  amount: 80,
  payment_date: '2026-09-01',
  payment_method: '银行转账',
  verify_status: '待核销',
  handler_name: '李四'
})
assert.deepEqual(buildSalesQuickOpportunityForm({
  id: 2,
  name: '客户A',
  probability: 0,
  stage: '',
  expected_close_date: ''
}, { closeDate: '2026-09-15' }), {
  customer_id: 2,
  opportunity_name: '客户A',
  expected_amount: 0,
  stage: '初步接洽',
  probability: 20,
  expected_close_date: '2026-09-15',
  owner_name: '',
  next_action: '',
  remark: ''
})
assert.deepEqual(buildSalesQuickFollowForm({ id: 2, contact_name: '王五', owner_name: '张三' }, {
  today: '2026-09-01', nextFollowDate: '2026-09-04'
}), {
  customer_id: 2,
  contact_name: '王五',
  follow_date: '2026-09-01',
  follow_type: '电话沟通',
  follow_result: '待跟进',
  next_follow_at: '2026-09-04',
  owner_name: '张三',
  follow_content: ''
})
assert.equal(calculateSalesQuickOrderTotal({ quantity: '3', unit_price: '12.5' }), 37.5)

const customer = { id: 2, name: '客户A', owner_name: '张三', contact_name: '王五', customer_status: '跟进中' }
const bomProduct = { parent_material_id: 7, parent_material_code: 'MAT-7', bom_no: 'BOM-7' }
const source = { id: 8, opportunity_no: 'OPP-8' }
const orderResult = buildSalesQuickOrderEntry({
  form: {
    product_name: ' 产品A ', quantity: '3', unit: '', unit_price: '12.5', order_date: '',
    delivery_date: '', order_status: '', owner_name: ''
  },
  customer,
  bomProduct,
  source,
  orderNo: 'SO-1',
  today: '2026-09-01'
})
assert.equal(orderResult.error, '')
assert.deepEqual(orderResult.payload, {
  order_no: 'SO-1',
  customer_id: 2,
  customer_name: '客户A',
  product_name: '产品A',
  quantity: 3,
  unit: '箱',
  unit_price: 12.5,
  total_amount: 37.5,
  order_date: '2026-09-01',
  delivery_date: null,
  order_status: '已确认',
  owner_name: '张三',
  status: 'active',
  properties: {
    来源: '商机转订单', bom_enabled: true, bom_no: 'BOM-7', product_material_code: 'MAT-7',
    商机ID: 8, 商机编号: 'OPP-8'
  },
  product_material_id: 7
})
const fallbackPayload = buildSalesQuickOrderFallbackPayload(orderResult.payload, bomProduct)
assert.equal('product_material_id' in fallbackPayload, false)
assert.equal(fallbackPayload.properties.product_material_id, 7)
assert.equal(orderResult.payload.product_material_id, 7)
assert.deepEqual(buildSalesQuickOrderEntry(), { error: '请选择客户', payload: null })
assert.deepEqual(buildSalesQuickOrderEntry({ customer, form: { product_name: '  ' } }), { error: '请输入产品名称', payload: null })

assert.deepEqual(buildSalesQuickPaymentEntry({
  form: { customer_name: ' 手工客户 ', amount: '20', payment_date: '', payment_method: '', verify_status: '', handler_name: '' },
  paymentNo: 'PAY-1',
  today: '2026-09-01'
}).payload, {
  payment_no: 'PAY-1', order_id: null, order_no: '', customer_id: null, customer_name: '手工客户', amount: 20,
  payment_date: '2026-09-01', payment_method: '银行转账', verify_status: '待核销', handler_name: '',
  status: 'active', properties: { 来源: '快捷登记回款' }
})
assert.equal(buildSalesQuickPaymentEntry({ order: { id: 1, order_no: 'SO-1', order_status: '已取消' } }).error, '已取消或已删除的订单不能登记回款')
assert.equal(buildSalesQuickPaymentEntry({ form: { customer_name: '' } }).error, '请选择订单或填写客户名称')
assert.equal(buildSalesQuickPaymentEntry({ form: { customer_name: '客户A', amount: 0 } }).error, '回款金额必须大于 0')

assert.deepEqual(buildSalesQuickOpportunityEntry({
  form: { opportunity_name: ' 商机A ', expected_amount: '200', stage: '', probability: '25' },
  customer,
  opportunityNo: 'OPP-1'
}).payload, {
  opportunity_no: 'OPP-1', opportunity_name: '商机A', customer_id: 2, customer_name: '客户A',
  expected_amount: 200, stage: '初步接洽', probability: 25, expected_close_date: null,
  owner_name: '张三', next_action: '', remark: '', status: 'active', properties: { 来源: '快捷新建商机' }
})
assert.equal(buildSalesQuickOpportunityEntry().error, '请选择客户')
assert.equal(buildSalesQuickOpportunityEntry({ customer, form: { opportunity_name: '' } }).error, '请输入商机名称')

const followResult = buildSalesQuickFollowEntry({
  form: { follow_content: '  已确认需求 ', follow_result: '已成交' },
  customer,
  followNo: 'FU-1',
  today: '2026-09-01'
})
assert.deepEqual(followResult.payload, {
  follow_no: 'FU-1', customer_id: 2, customer_name: '客户A', contact_name: '王五',
  follow_date: '2026-09-01', follow_type: '电话沟通', follow_result: '已成交', next_follow_at: null,
  owner_name: '张三', follow_content: '已确认需求', status: 'active', properties: { 来源: '快捷登记跟进' }
})
assert.deepEqual(followResult.customerPatch, { last_follow_up_at: '2026-09-01', customer_status: '已成交' })
assert.equal(buildSalesQuickFollowEntry().error, '请选择客户')
assert.equal(buildSalesQuickFollowEntry({ customer, form: { follow_content: ' ' } }).error, '请输入跟进纪要')

const moduleSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/domain/sales-grid-quick-entry-policy.js'), 'utf8')
for (const forbidden of ['from \'vue\'', 'element-plus', 'request({', 'axios', 'window.', 'document.', 'localStorage', 'Date.now', 'Math.random']) {
  assert.equal(moduleSource.includes(forbidden), false, `sales quick-entry policy gained runtime dependency: ${forbidden}`)
}

const pageSource = readFileSync(resolve(repoRoot, 'eiscore-sales/src/components/SalesAppGrid.vue'), 'utf8')
assert.match(pageSource, /from ['"]@\/domain\/sales-grid-quick-entry-policy['"]/)
for (const removedDefinition of [
  'const orderForm = reactive({',
  'const paymentForm = reactive({',
  'const opportunityForm = reactive({',
  'const followForm = reactive({',
  "ElMessage.warning('请输入产品名称')",
  "ElMessage.warning('回款金额必须大于 0')",
  "properties: { 来源: '快捷新建商机' }",
  "properties: { 来源: '快捷登记跟进' }"
]) {
  assert.equal(pageSource.includes(removedDefinition), false, `SalesAppGrid reintroduced ${removedDefinition}`)
}
for (const requiredCall of [
  'buildSalesQuickOrderEntry({',
  'buildSalesQuickPaymentEntry({',
  'buildSalesQuickOpportunityEntry({',
  'buildSalesQuickFollowEntry({'
]) {
  assert.equal(pageSource.includes(requiredCall), true, `SalesAppGrid lost ${requiredCall}`)
}
assert.ok(pageSource.split(/\r?\n/).length <= 3822)

console.log('PASS: SalesAppGrid quick-entry policy preserves four forms, validations, payloads and order fallback')
