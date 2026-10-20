// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { isSalesOrderActive, toSalesAmount } from './sales-grid-data-policy.js'

export const buildSalesQuickOrderForm = (source = null, { today = '', deliveryDate = '' } = {}) => ({
  customer_id: source?.customer_id || (source?.opportunity_no ? '' : source?.id) || '',
  product_material_id: source?.product_material_id || null,
  product_name: source?.product_name || source?.opportunity_name || '',
  quantity: 1,
  unit: '箱',
  unit_price: toSalesAmount(source?.expected_amount || 0),
  order_date: today,
  delivery_date: deliveryDate,
  order_status: '已确认',
  owner_name: source?.owner_name || ''
})

export const buildSalesQuickPaymentForm = (source = null, { today = '' } = {}) => ({
  order_id: source?.id || source?.order_id || '',
  customer_name: source?.customer_name || source?.name || '',
  amount: toSalesAmount(source?.total_amount || source?.amount || 0),
  payment_date: today,
  payment_method: '银行转账',
  verify_status: '待核销',
  handler_name: source?.owner_name || source?.handler_name || ''
})

export const buildSalesQuickOpportunityForm = (source = null, { closeDate = '' } = {}) => ({
  customer_id: source?.id || source?.customer_id || '',
  opportunity_name: source?.opportunity_name || source?.name || '',
  expected_amount: toSalesAmount(source?.expected_amount || 0),
  stage: source?.stage || '初步接洽',
  probability: toSalesAmount(source?.probability || 20),
  expected_close_date: source?.expected_close_date || closeDate,
  owner_name: source?.owner_name || '',
  next_action: source?.next_action || '',
  remark: source?.remark || ''
})

export const buildSalesQuickFollowForm = (source = null, { today = '', nextFollowDate = '' } = {}) => ({
  customer_id: source?.id || source?.customer_id || '',
  contact_name: source?.contact_name || '',
  follow_date: today,
  follow_type: '电话沟通',
  follow_result: '待跟进',
  next_follow_at: nextFollowDate,
  owner_name: source?.owner_name || '',
  follow_content: ''
})

export const calculateSalesQuickOrderTotal = (form = {}) => (
  toSalesAmount(form.quantity) * toSalesAmount(form.unit_price)
)

export const buildSalesQuickOrderEntry = ({
  form = {},
  customer,
  bomProduct,
  source,
  orderNo,
  today = ''
} = {}) => {
  if (!customer) return { error: '请选择客户', payload: null }
  if (!form.product_name?.trim()) return { error: '请输入产品名称', payload: null }
  const payload = {
    order_no: orderNo,
    customer_id: customer.id,
    customer_name: customer.name,
    product_name: form.product_name.trim(),
    quantity: toSalesAmount(form.quantity),
    unit: form.unit || '箱',
    unit_price: toSalesAmount(form.unit_price),
    total_amount: calculateSalesQuickOrderTotal(form),
    order_date: form.order_date || today,
    delivery_date: form.delivery_date || null,
    order_status: form.order_status || '已确认',
    owner_name: form.owner_name || customer.owner_name || '',
    status: 'active',
    properties: {
      来源: source?.opportunity_no ? '商机转订单' : '快捷建单',
      bom_enabled: Boolean(bomProduct?.parent_material_id),
      bom_no: bomProduct?.bom_no || null,
      product_material_code: bomProduct?.parent_material_code || null
    }
  }
  if (bomProduct?.parent_material_id) payload.product_material_id = bomProduct.parent_material_id
  if (source?.id && source?.opportunity_no) {
    payload.properties.商机ID = source.id
    payload.properties.商机编号 = source.opportunity_no
  }
  return { error: '', payload }
}

export const buildSalesQuickOrderFallbackPayload = (payload, bomProduct) => {
  const fallbackPayload = { ...payload }
  delete fallbackPayload.product_material_id
  fallbackPayload.properties = {
    ...(fallbackPayload.properties || {}),
    product_material_id: bomProduct?.parent_material_id || null
  }
  return fallbackPayload
}

export const buildSalesQuickPaymentEntry = ({ form = {}, order, paymentNo, today = '' } = {}) => {
  const customerName = order?.customer_name || form.customer_name?.trim()
  if (order && !isSalesOrderActive(order)) {
    return { error: '已取消或已删除的订单不能登记回款', payload: null }
  }
  if (!customerName) return { error: '请选择订单或填写客户名称', payload: null }
  const amount = toSalesAmount(form.amount)
  if (amount <= 0) return { error: '回款金额必须大于 0', payload: null }
  return {
    error: '',
    payload: {
      payment_no: paymentNo,
      order_id: order?.id || null,
      order_no: order?.order_no || '',
      customer_id: order?.customer_id || null,
      customer_name: customerName,
      amount,
      payment_date: form.payment_date || today,
      payment_method: form.payment_method || '银行转账',
      verify_status: form.verify_status || '待核销',
      handler_name: form.handler_name || order?.owner_name || '',
      status: 'active',
      properties: { 来源: '快捷登记回款' }
    }
  }
}

export const buildSalesQuickOpportunityEntry = ({ form = {}, customer, opportunityNo } = {}) => {
  if (!customer) return { error: '请选择客户', payload: null }
  if (!form.opportunity_name?.trim()) return { error: '请输入商机名称', payload: null }
  return {
    error: '',
    payload: {
      opportunity_no: opportunityNo,
      opportunity_name: form.opportunity_name.trim(),
      customer_id: customer.id,
      customer_name: customer.name,
      expected_amount: toSalesAmount(form.expected_amount),
      stage: form.stage || '初步接洽',
      probability: toSalesAmount(form.probability),
      expected_close_date: form.expected_close_date || null,
      owner_name: form.owner_name || customer.owner_name || '',
      next_action: form.next_action || '',
      remark: form.remark || '',
      status: 'active',
      properties: { 来源: '快捷新建商机' }
    }
  }
}

export const buildSalesQuickFollowEntry = ({ form = {}, customer, followNo, today = '' } = {}) => {
  if (!customer) return { error: '请选择客户', payload: null, customerPatch: null }
  if (!form.follow_content?.trim()) {
    return { error: '请输入跟进纪要', payload: null, customerPatch: null }
  }
  const payload = {
    follow_no: followNo,
    customer_id: customer.id,
    customer_name: customer.name,
    contact_name: form.contact_name || customer.contact_name || '',
    follow_date: form.follow_date || today,
    follow_type: form.follow_type || '电话沟通',
    follow_result: form.follow_result || '待跟进',
    next_follow_at: form.next_follow_at || null,
    owner_name: form.owner_name || customer.owner_name || '',
    follow_content: form.follow_content.trim(),
    status: 'active',
    properties: { 来源: '快捷登记跟进' }
  }
  return {
    error: '',
    payload,
    customerPatch: {
      last_follow_up_at: payload.follow_date,
      customer_status: payload.follow_result === '已成交' ? '已成交' : customer.customer_status
    }
  }
}
