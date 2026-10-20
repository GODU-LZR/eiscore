// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const isCompleted = (link) => {
  const status = String(link?.payload?.status || '').trim()
  return ['已出库', '已完成', 'completed', 'fulfilled'].includes(status) || link?.status === 'completed'
}

const queryValue = (value) => encodeURIComponent(String(value))

export const buildSalesOutboundDraftProperties = (link = {}) => {
  const payload = link.payload && typeof link.payload === 'object' ? link.payload : {}
  const sourceDocId = payload.sales_order_id || link.source_doc_id || null
  const sourceDocNo = payload.sales_order_no || link.source_doc_no || ''
  return {
    source_doc_id: sourceDocId,
    source_doc_no: sourceDocNo,
    outbound_no: link.target_doc_no || '',
    document_link_id: link.id || null,
    source_doc_type: link.source_doc_type || 'sales_order',
    source_relation_type: link.relation_type || '',
    sales_order_id: sourceDocId,
    sales_order_no: sourceDocNo,
    shipment_no: payload.shipment_no || '',
    sales_outbound_status: '仓储补录中'
  }
}

export const loadPendingSalesOutboundRequests = async (request) => {
  const links = await request({
    url: '/document_links?target_doc_type=eq.inventory_outbound&status=eq.active&relation_type=in.(sales_to_outbound,shipment_request_to_sales_outbound)&select=*&order=created_at.asc',
    method: 'get',
    headers: { 'Accept-Profile': 'public' },
    silentError: true
  })
  const drafts = await request({
    url: '/inventory_drafts?draft_type=eq.out&select=id,status,transaction_no,properties&limit=500',
    method: 'get',
    headers: { 'Accept-Profile': 'scm', 'Content-Profile': 'scm' },
    silentError: true
  })
  const draftRows = Array.isArray(drafts) ? drafts : []
  const grouped = new Map()
  ;(Array.isArray(links) ? links : []).filter((link) => !isCompleted(link)).forEach((link) => {
    const key = link.target_doc_no || link.target_doc_id || link.id
    const payload = link.payload && typeof link.payload === 'object' ? link.payload : {}
    const existing = grouped.get(key)
    if (existing) {
      existing.links.push(link)
      if (link.relation_type === 'sales_to_outbound') existing.link = link
      if (link.relation_type === 'sales_to_outbound') {
        existing.salesOrderNo = payload.sales_order_no || link.source_doc_no || existing.salesOrderNo
        existing.salesOrderId = payload.sales_order_id || link.source_doc_id || existing.salesOrderId
      }
      return
    }
    const outboundNo = link.target_doc_no || ''
    const draft = draftRows.find((row) => String(row?.properties?.outbound_no || '') === String(outboundNo)) || null
    grouped.set(key, {
      link,
      links: [link],
      outboundNo,
      salesOrderNo: payload.sales_order_no || (link.relation_type === 'sales_to_outbound' ? link.source_doc_no : '') || '',
      salesOrderId: payload.sales_order_id || (link.relation_type === 'sales_to_outbound' ? link.source_doc_id : null),
      productName: payload.product_name || '',
      materialId: payload.product_material_id || null,
      materialCode: payload.product_material_code || '',
      quantity: link.quantity ?? payload.quantity ?? 0,
      unit: payload.unit || '',
      statusLabel: draft ? (draft.status === 'active' ? '已出库' : '草稿待生效') : (payload.status || '待仓储补录'),
      inProgress: payload.status === '仓储补录中',
      draft
    })
  })
  return [...grouped.values()]
}

export const claimSalesOutboundRequest = async (request, link) => {
  if (!link?.id) throw new Error('销售出库申请缺少关联编号')
  const payload = link.payload && typeof link.payload === 'object' ? link.payload : {}
  const claimed = await request({
    url: `/document_links?id=eq.${queryValue(link.id)}&status=eq.active&payload->>status=eq.${queryValue('待仓储补录')}`,
    method: 'patch',
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public', Prefer: 'return=representation' },
    data: { payload: { ...payload, status: '仓储补录中' } }
  })
  if (!Array.isArray(claimed) || claimed.length === 0) {
    throw new Error('该销售出库申请已被其他仓储人员处理')
  }
}

export const releaseSalesOutboundClaim = async (request, link) => {
  if (!link?.id) return
  const payload = link.payload && typeof link.payload === 'object' ? link.payload : {}
  await request({
    url: `/document_links?id=eq.${queryValue(link.id)}&status=eq.active&payload->>status=eq.${queryValue('仓储补录中')}`,
    method: 'patch',
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: { payload: { ...payload, status: '待仓储补录' } }
  })
}

const updateOutboundLinks = async (request, outboundNo, updatePayload) => {
  if (!outboundNo) return []
  const links = await request({
    url: `/document_links?target_doc_type=eq.inventory_outbound&target_doc_no=eq.${queryValue(outboundNo)}&status=eq.active&select=*`,
    method: 'get',
    headers: { 'Accept-Profile': 'public' },
    silentError: true
  })
  const rows = Array.isArray(links) ? links : []
  for (const link of rows) {
    const payload = updatePayload(link?.payload && typeof link.payload === 'object' ? link.payload : {}, link)
    await request({
      url: `/document_links?id=eq.${queryValue(link.id)}&status=eq.active`,
      method: 'patch',
      headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public', Prefer: 'return=representation' },
      data: { status: 'active', target_doc_id: payload.inventory_draft_id || null, payload }
    })
  }
  return rows
}

export const attachSalesOutboundDraft = (request, outboundNo, draftId) => updateOutboundLinks(
  request,
  outboundNo,
  (payload) => ({
    ...payload,
    status: '仓储草稿已创建',
    inventory_draft_id: draftId,
    draft_created_at: new Date().toISOString()
  })
)

export const completeSalesOutbound = async (request, { properties = {}, row = {}, completedAt = new Date().toISOString() } = {}) => {
  const outboundNo = properties.outbound_no || ''
  if (!outboundNo) return false
  await updateOutboundLinks(request, outboundNo, (payload) => ({
    ...payload,
    status: '已出库',
    inventory_draft_id: row.id || null,
    transaction_no: row.transaction_no || '',
    completed_at: completedAt
  }))

  const salesOrderId = properties.sales_order_id || properties.source_doc_id
  if (!salesOrderId) return true
  const orders = await request({
    url: `/sales_orders?id=eq.${queryValue(salesOrderId)}&select=id,properties&limit=1`,
    method: 'get',
    headers: { 'Accept-Profile': 'public' }
  })
  const order = Array.isArray(orders) ? orders[0] : null
  if (!order?.id) return true
  const orderProperties = order.properties && typeof order.properties === 'object' ? order.properties : {}
  await request({
    url: `/sales_orders?id=eq.${queryValue(order.id)}`,
    method: 'patch',
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' },
    data: {
      properties: {
        ...orderProperties,
        sales_outbound_no: outboundNo,
        sales_outbound_status: '已出库',
        sales_outbound_inventory_draft_id: row.id || null,
        sales_outbound_transaction_no: row.transaction_no || '',
        sales_outbound_completed_at: completedAt
      }
    }
  })
  return true
}
