// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { SALES_FLOW_DOC_TYPES as DOC_TYPES } from '@/domain/sales-grid-flow-policy'
import { buildSalesQuickPaymentEntry, buildSalesQuickPaymentForm } from '@/domain/sales-grid-quick-entry-policy'

const DOC_EXT = Object.freeze({
  OPPORTUNITY: 'sales_opportunity',
  QUOTE: 'sales_quote',
  CONTRACT: 'sales_contract',
  RECEIVABLE: 'sales_receivable'
})

const REL_EXT = Object.freeze({
  OPPORTUNITY_TO_QUOTE: 'sales_opportunity_to_quote',
  QUOTE_TO_CONTRACT: 'sales_quote_to_contract',
  CONTRACT_TO_ORDER: 'sales_contract_to_order',
  ORDER_TO_RECEIVABLE: 'sales_order_to_receivable'
})

export const useSalesDocumentFlow = ({
  request,
  toAmount,
  safeEq,
  getErrorMessage,
  todayText,
  nextDocNo,
  addDaysText,
  gridRef,
  router,
  canEdit: canEditState,
  selectedDetailRow,
  flowActionLoading,
  getSelectedSalesOrders,
  createDocumentLink,
  writeDocumentAudit,
  refreshSelectedDetail,
  formatAmount,
  paymentForm,
  quickMode,
  quickDialogVisible,
  quickLoading,
  quickOrders,
  quickOrderPayments,
  syncCustomerReceivableFromRow,
  isOrderActive,
  hasPerm,
  canEditPermission = canEditState,
  appKey
} = {}) => {
  const quoteItemsVisible = ref(false)
  const quoteItemsLoading = ref(false)
  const quoteItemsSaving = ref(false)
  const quoteItemsReady = ref(false)
  const selectedQuote = ref(null)
  const quoteItems = ref([])
  const originalQuoteItemIds = ref([])
  const originalQuoteMaxLineNo = ref(0)
  const quickReceivableSchedules = ref([])
  const conversionLocks = new Set()

  const createSalesRow = (table, data, options = {}) => request({
    url: `/${table}`,
    method: 'post',
    headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public', Prefer: 'return=representation' },
    data,
    ...options
  })
  const applyCreatedRow = async (targetAppKey, row) => {
    if (targetAppKey === appKey?.value && row && await gridRef.value?.prependRow?.(row)) return true
    await gridRef.value?.loadData?.()
    return false
  }

  const selectedQuickOrder = computed(() => quickOrders.value.find((order) => String(order.id) === String(paymentForm?.order_id)) || null)
  const selectedQuickOrderPaidAmount = computed(() => {
    const order = selectedQuickOrder.value
    if (!order) return 0
    return quickOrderPayments.value
      .filter((payment) => paymentForm?.order_id ? String(payment.order_id) === String(paymentForm.order_id) : payment.order_no === order.order_no)
      .reduce((sum, payment) => sum + toAmount(payment.amount), 0)
  })
  const selectedQuickOrderRemainAmount = computed(() => {
    const order = selectedQuickOrder.value
    if (!order) return 0
    return Math.max(toAmount(order.total_amount) - selectedQuickOrderPaidAmount.value, 0)
  })
  const selectedQuickReceivable = computed(() => quickReceivableSchedules.value.find((row) => String(row.id) === String(paymentForm?.schedule_id)) || null)
  const availableQuickReceivables = computed(() => quickReceivableSchedules.value.filter((schedule) => {
    const outstanding = toAmount(schedule.outstanding_amount ?? (toAmount(schedule.planned_amount) - toAmount(schedule.received_amount)))
    if (outstanding <= 0 || ['已收款', '已作废', '已取消'].includes(schedule.schedule_status)) return false
    if (paymentForm?.order_id && schedule.order_id && String(schedule.order_id) !== String(paymentForm.order_id)) return false
    const order = selectedQuickOrder?.value
    if (order?.customer_id && schedule.customer_id && String(schedule.customer_id) !== String(order.customer_id)) return false
    return true
  }))
  const quoteItemsTotal = computed(() => quoteItems.value.reduce((sum, item) => {
    const amount = toAmount(item.line_amount)
    return sum + amount + amount * toAmount(item.tax_rate) / 100
  }, 0))

  const loadQuickReceivableSchedules = async ({ isCurrent, reset = false } = {}) => {
    if (isCurrent && !isCurrent()) return
    if (reset) quickReceivableSchedules.value = []
    const rows = await request({
      url: '/v_sales_receivable_aging?select=*&status=neq.deleted&order=due_date.asc&limit=500',
      method: 'get',
      headers: { 'Accept-Profile': 'public' },
      silentError: true
    }).catch((error) => {
      console.warn('load receivable schedules failed', error)
      return []
    })
    if (!isCurrent || isCurrent()) quickReceivableSchedules.value = Array.isArray(rows) ? rows : []
  }

  const clearQuickReceivableSchedules = () => {
    quickReceivableSchedules.value = []
  }

  const loadQuickOrders = async () => {
    const rows = await request({
      url: `/sales_orders?select=*&status=neq.deleted&order_status=neq.${safeEq('已取消')}&order=order_date.desc&limit=200`,
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    quickOrders.value = Array.isArray(rows) ? rows : []
  }

  const loadQuickOrderPayments = async () => {
    const rows = await request({
      url: '/sales_payments?select=*&status=neq.deleted&order=payment_date.desc&limit=200',
      method: 'get',
      headers: { 'Accept-Profile': 'public' }
    })
    quickOrderPayments.value = Array.isArray(rows) ? rows : []
  }

  const resetPaymentForm = (source = null) => {
    Object.assign(paymentForm, buildSalesQuickPaymentForm(source, { today: todayText() }))
    paymentForm.schedule_id = source?.schedule_no ? source.id : (source?.schedule_id || '')
    if (source?.schedule_no) {
      paymentForm.order_id = source.order_id || ''
      paymentForm.amount = toAmount(source.outstanding_amount ?? (toAmount(source.planned_amount) - toAmount(source.received_amount)))
    }
  }

  const openPaymentDialog = async (source = null) => {
    quickMode.value = 'payment'
    quickDialogVisible.value = true
    resetPaymentForm(source)
    quickLoading.value = true
    try {
      await Promise.all([loadQuickOrders(), loadQuickOrderPayments(), loadQuickReceivableSchedules()])
      if (source?.order_no && !paymentForm.order_id) {
        const matched = quickOrders.value.find((order) => order.order_no === source.order_no)
        if (matched) paymentForm.order_id = matched.id
      }
    } catch (error) {
      console.warn('load payment sources failed', error)
      ElMessage.warning('订单列表加载失败')
    } finally {
      quickLoading.value = false
    }
  }

  const submitQuickPayment = async () => {
    const result = buildSalesQuickPaymentEntry({
      form: paymentForm,
      order: selectedQuickOrder.value,
      schedule: selectedQuickReceivable.value,
      paymentNo: nextDocNo('PAY'),
      today: todayText()
    })
    if (result.error) {
      ElMessage.warning(result.error)
      return false
    }
    const createdRows = await createSalesRow('sales_payments', result.payload)
    await syncCustomerReceivableFromRow(result.payload)
    await loadQuickReceivableSchedules()
    ElMessage.success('回款记录已创建')
    return { appKey: 'payments', row: Array.isArray(createdRows) ? createdRows[0] : createdRows }
  }

  const quoteItemAmount = (item) => Math.round(toAmount(item.quantity) * toAmount(item.unit_price) * toAmount(item.discount_rate ?? 100)) / 100
  const quoteItemPayload = (item, index, quote, newLineBase) => ({
    ...(item.id ? { id: item.id } : {}),
    quote_id: quote.id,
    line_no: item.id ? item.line_no : newLineBase + index * 10,
    product_code: item.product_code || null,
    product_name: String(item.product_name || '').trim(),
    specification: item.specification || null,
    quantity: toAmount(item.quantity),
    unit: item.unit || '件',
    unit_price: toAmount(item.unit_price),
    tax_rate: toAmount(item.tax_rate ?? 13),
    discount_rate: toAmount(item.discount_rate ?? 100),
    line_amount: quoteItemAmount(item),
    delivery_date: item.delivery_date || null,
    remark: item.remark || null,
    properties: item.properties || {}
  })

  const openQuoteItems = async (quote) => {
    if (!quote?.id) return
    selectedQuote.value = quote
    quoteItemsVisible.value = true
    quoteItemsLoading.value = true
    quoteItemsReady.value = false
    try {
      const rows = await request({
        url: `/sales_quote_items?select=*&quote_id=eq.${safeEq(quote.id)}&order=line_no.asc`,
        method: 'get',
        headers: { 'Accept-Profile': 'public' }
      })
      quoteItems.value = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : []
      originalQuoteItemIds.value = quoteItems.value.map((row) => row.id).filter(Boolean)
      originalQuoteMaxLineNo.value = Math.max(0, ...quoteItems.value.map((row) => toAmount(row.line_no)))
      quoteItemsReady.value = true
    } catch (error) {
      quoteItems.value = []
      originalQuoteItemIds.value = []
      originalQuoteMaxLineNo.value = 0
      ElMessage.error(getErrorMessage(error, '报价明细加载失败'))
    } finally {
      quoteItemsLoading.value = false
    }
  }

  const addQuoteItem = () => {
    const maxLineNo = Math.max(originalQuoteMaxLineNo.value, 0, ...quoteItems.value.map((item) => toAmount(item.line_no)))
    quoteItems.value.push({ line_no: maxLineNo + 10, product_code: '', product_name: '', specification: '', quantity: 1, unit: '件', unit_price: 0, tax_rate: 13, discount_rate: 100, line_amount: 0 })
  }
  const updateQuoteItemAmount = (item) => { item.line_amount = quoteItemAmount(item) }
  const removeQuoteItem = (index) => quoteItems.value.splice(index, 1)

  const saveQuoteItems = async () => {
    const quote = selectedQuote.value
    if (!quote?.id || !canEditState.value || !quoteItemsReady.value) return
    const newLineBase = Math.max(originalQuoteMaxLineNo.value, 0, ...quoteItems.value.filter((item) => item.id).map((item) => toAmount(item.line_no)))
    let newLineIndex = 0
    const rows = quoteItems.value.map((item, index) => quoteItemPayload(item, item.id ? index : ++newLineIndex, quote, newLineBase))
    if (rows.some((item) => !item.product_name || item.quantity <= 0 || item.tax_rate < 0 || item.tax_rate > 100 || item.discount_rate < 0 || item.discount_rate > 100)) {
      ElMessage.warning('请填写产品名称，数量须大于 0，税率和折扣须在 0 到 100 之间')
      return
    }
    quoteItemsSaving.value = true
    try {
      for (const item of rows.filter((row) => row.id)) {
        const { id, ...data } = item
        await request({ url: `/sales_quote_items?id=eq.${safeEq(id)}`, method: 'patch', headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }, data })
      }
      const newRows = rows.filter((row) => !row.id).map(({ id, ...row }) => row)
      if (newRows.length) await request({ url: '/sales_quote_items', method: 'post', headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }, data: newRows })
      const retainedIds = new Set(rows.map((row) => row.id).filter(Boolean))
      for (const id of originalQuoteItemIds.value.filter((itemId) => !retainedIds.has(itemId))) {
        await request({ url: `/sales_quote_items?id=eq.${safeEq(id)}`, method: 'delete', headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' } })
      }
      const subtotal = Math.round(rows.reduce((sum, item) => sum + item.line_amount, 0) * 100) / 100
      const taxAmount = Math.round(rows.reduce((sum, item) => sum + item.line_amount * item.tax_rate / 100, 0) * 100) / 100
      await request({ url: `/sales_quotes?id=eq.${safeEq(quote.id)}`, method: 'patch', headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }, data: { subtotal, tax_amount: taxAmount, total_amount: subtotal + taxAmount } })
      quoteItemsVisible.value = false
      await gridRef.value?.loadData?.()
      ElMessage.success('报价明细已保存，报价金额已更新')
    } catch (error) {
      ElMessage.error(getErrorMessage(error, '报价明细保存失败'))
    } finally {
      quoteItemsSaving.value = false
    }
  }

  const updateSalesState = async (table, row, data, title) => {
    if (!row?.id) return
    const permission = table === 'sales_quotes'
      ? data.approval_status === '待审批' ? '' : 'op:sales_quote.approve'
      : data.approval_status === '待审批' ? '' : data.signing_status ? 'op:sales_contract.sign' : 'op:sales_contract.approve'
    if (permission ? !hasPerm(permission) : !canEditPermission.value) {
      ElMessage.warning('当前账号没有执行此审批操作的权限')
      return
    }
    try {
      await ElMessageBox.confirm(`确认${title}？`, title, { type: 'warning' })
      await request({ url: `/${table}?id=eq.${safeEq(row.id)}`, method: 'patch', headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }, data })
      await gridRef.value?.loadData?.()
      if (selectedDetailRow.value?.id === row.id) await refreshSelectedDetail()
      ElMessage.success(`${title}完成`)
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') ElMessage.error(getErrorMessage(error, `${title}失败`))
    }
  }

  const openQuoteDialogFromOpportunity = async (opportunity) => {
    if (!hasPerm('op:sales_quote.create')) return ElMessage.warning('当前账号没有新建报价的权限')
    if (!opportunity?.id) return ElMessage.warning('商机缺少主键，不能新建报价')
    try {
      const existing = await request({ url: `/sales_quotes?select=*&opportunity_id=eq.${safeEq(opportunity.id)}&status=neq.deleted&order=version_no.desc&limit=1`, method: 'get', headers: { 'Accept-Profile': 'public' }, silentError: true })
      if (Array.isArray(existing) && existing.length) {
        await openQuoteItems(existing[0])
        ElMessage.info('该商机已有报价，已打开最新版本明细')
        return
      }
      const quoteNo = nextDocNo('QT')
      const createdRows = await request({
        url: '/sales_quotes', method: 'post', headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public', Prefer: 'return=representation' },
        data: { quote_no: quoteNo, version_no: 1, opportunity_id: opportunity.id, customer_id: opportunity.customer_id || null, customer_name: opportunity.customer_name || '待选择客户', quote_title: opportunity.opportunity_name || '新销售报价', quote_date: todayText(), valid_until: opportunity.expected_close_date || addDaysText(14), currency: 'CNY', subtotal: 0, tax_amount: 0, total_amount: toAmount(opportunity.expected_amount), payment_term_days: 0, delivery_terms: '', approval_status: '草稿', quote_status: '草稿', owner_name: opportunity.owner_name || '', remark: opportunity.remark || '', status: 'active', properties: { 来源: '销售商机转报价', source_opportunity_id: opportunity.id, source_opportunity_no: opportunity.opportunity_no || '' } }
      })
      const quote = Array.isArray(createdRows) ? createdRows[0] : createdRows
      const target = { docType: DOC_EXT.QUOTE, docId: quote?.id || null, docNo: quote?.quote_no || quoteNo }
      await createDocumentLink({ source: { docType: DOC_EXT.OPPORTUNITY, docId: opportunity.id, docNo: opportunity.opportunity_no || '' }, target, relationType: REL_EXT.OPPORTUNITY_TO_QUOTE, amount: toAmount(opportunity.expected_amount), payload: { customer_name: opportunity.customer_name || '', quote_title: opportunity.opportunity_name || '' } })
      await writeDocumentAudit({ actionType: 'push_sales_opportunity_to_quote', source: { docType: DOC_EXT.OPPORTUNITY, docId: opportunity.id, docNo: opportunity.opportunity_no || '' }, target, payload: { quote_no: target.docNo } })
      await gridRef.value?.loadData?.()
      if (quote?.id) await openQuoteItems(quote)
      ElMessage.success('报价草稿已创建，请补充产品明细')
    } catch (error) { ElMessage.error(getErrorMessage(error, '新建报价失败')) }
  }

  const createContractFromQuote = async (quote) => {
    if (!hasPerm('op:sales_contract.create')) return ElMessage.warning('当前账号没有生成合同的权限')
    if (!quote?.id) return
    if (quote.approval_status !== '已通过') return ElMessage.warning('报价审批通过后才能生成合同')
    const lockKey = `quote-contract:${quote.id}`
    if (conversionLocks.has(lockKey)) return ElMessage.info('该报价正在生成合同，请稍候')
    conversionLocks.add(lockKey)
    try {
      const quoteItemsRows = await request({ url: `/sales_quote_items?select=id&quote_id=eq.${safeEq(quote.id)}&limit=1`, method: 'get', headers: { 'Accept-Profile': 'public' } })
      if (!Array.isArray(quoteItemsRows) || !quoteItemsRows.length) return ElMessage.warning('请先维护报价产品明细，再生成合同')
      const existing = await request({ url: `/sales_contracts?select=*&quote_id=eq.${safeEq(quote.id)}&status=neq.deleted&limit=1`, method: 'get', headers: { 'Accept-Profile': 'public' } })
      if (Array.isArray(existing) && existing.length) return ElMessage.warning('该报价已关联合同')
      const contractNo = nextDocNo('CT')
      const createdRows = await request({
        url: '/sales_contracts', method: 'post', headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public', Prefer: 'return=representation' },
        data: { contract_no: contractNo, quote_id: quote.id, quote_no: quote.quote_no || '', customer_id: quote.customer_id || null, customer_name: quote.customer_name || '待选择客户', contract_title: quote.quote_title || '新销售合同', contract_amount: toAmount(quote.total_amount), currency: quote.currency || 'CNY', payment_term_days: toAmount(quote.payment_term_days), approval_status: '草稿', signing_status: '未签订', owner_name: quote.owner_name || '', remark: quote.remark || '', status: 'active', properties: { 来源: '销售报价转合同', source_quote_id: quote.id, source_quote_no: quote.quote_no || '' } }
      })
      const contract = Array.isArray(createdRows) ? createdRows[0] : createdRows
      const target = { docType: DOC_EXT.CONTRACT, docId: contract?.id || null, docNo: contract?.contract_no || contractNo }
      await createDocumentLink({ source: { docType: DOC_EXT.QUOTE, docId: quote.id, docNo: quote.quote_no || '' }, target, relationType: REL_EXT.QUOTE_TO_CONTRACT, amount: toAmount(quote.total_amount), payload: { customer_name: quote.customer_name || '' } })
      await writeDocumentAudit({ actionType: 'push_sales_quote_to_contract', source: { docType: DOC_EXT.QUOTE, docId: quote.id, docNo: quote.quote_no || '' }, target, payload: { contract_no: target.docNo } })
      await request({ url: `/sales_quotes?id=eq.${safeEq(quote.id)}`, method: 'patch', headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public' }, data: { quote_status: '已接受' } })
      await gridRef.value?.loadData?.()
      ElMessage.success('合同草稿已由报价生成')
    } catch (error) { ElMessage.error(getErrorMessage(error, '生成合同失败')) } finally { conversionLocks.delete(lockKey) }
  }

  const dateAfterDays = (dateText, days) => {
    if (!days) return dateText || null
    const date = new Date(`${dateText || todayText()}T00:00:00`)
    date.setDate(date.getDate() + Number(days))
    return date.toISOString().slice(0, 10)
  }

  const createOrdersFromContract = async (contract) => {
    if (!hasPerm('op:sales_order.create')) return ElMessage.warning('当前账号没有生成销售订单的权限')
    if (!contract?.id) return
    if (contract.approval_status !== '已通过') return ElMessage.warning('合同审批通过后才能转销售订单')
    if (!['已签订', '部分签订'].includes(contract.signing_status)) return ElMessage.warning('合同签订后才能转销售订单')
    const lockKey = `contract-orders:${contract.id}`
    if (conversionLocks.has(lockKey)) return ElMessage.info('该合同正在生成销售订单，请稍候')
    conversionLocks.add(lockKey)
    try {
      const existing = await request({ url: `/sales_orders?select=id&contract_id=eq.${safeEq(contract.id)}&status=neq.deleted&limit=1`, method: 'get', headers: { 'Accept-Profile': 'public' } })
      if (Array.isArray(existing) && existing.length) return ElMessage.warning('该合同已生成销售订单')
      let items = contract.quote_id ? await request({ url: `/sales_quote_items?select=*&quote_id=eq.${safeEq(contract.quote_id)}&order=line_no.asc`, method: 'get', headers: { 'Accept-Profile': 'public' } }) : []
      if (!Array.isArray(items) || !items.length) items = [{ product_name: contract.contract_title || '合同项目', quantity: 1, unit: '项', unit_price: toAmount(contract.contract_amount), line_amount: toAmount(contract.contract_amount), tax_rate: 0, discount_rate: 100 }]
      const orderDate = todayText()
      const paymentTermDays = toAmount(contract.payment_term_days)
      const orders = items.map((item) => {
        const quantity = toAmount(item.quantity) || 1
        const lineAmount = toAmount(item.line_amount || quoteItemAmount(item))
        const totalAmount = Math.round((lineAmount + lineAmount * toAmount(item.tax_rate) / 100) * 100) / 100
        return { order_no: nextDocNo('SO'), customer_id: contract.customer_id || null, customer_name: contract.customer_name || '待选择客户', product_name: item.product_name || contract.contract_title || '合同项目', quantity, unit: item.unit || '件', unit_price: quantity ? Math.round(totalAmount / quantity * 100) / 100 : 0, total_amount: totalAmount, order_date: orderDate, delivery_date: item.delivery_date || null, order_status: '已确认', owner_name: contract.owner_name || '', quote_id: contract.quote_id || null, quote_no: contract.quote_no || '', contract_id: contract.id, contract_no: contract.contract_no || '', payment_term_days: paymentTermDays, due_date: dateAfterDays(orderDate, paymentTermDays), status: 'active', properties: { 来源: '销售合同转订单', product_code: item.product_code || '', specification: item.specification || '', quote_item_id: item.id || null } }
      })
      const totalAmount = Math.round(orders.reduce((sum, order) => sum + order.total_amount, 0) * 100) / 100
      if (contract.contract_amount && Math.abs(totalAmount - toAmount(contract.contract_amount)) > 0.01) return ElMessage.warning(`合同金额 ${formatAmount(contract.contract_amount)} 与订单明细合计 ${formatAmount(totalAmount)} 不一致，请先核对金额`)
      const createdRows = await request({ url: '/sales_orders', method: 'post', headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public', Prefer: 'return=representation' }, data: orders })
      const createdOrders = Array.isArray(createdRows) && createdRows.length ? createdRows : orders
      for (let index = 0; index < createdOrders.length; index += 1) {
        const created = createdOrders[index]
        const source = { docType: DOC_EXT.CONTRACT, docId: contract.id, docNo: contract.contract_no || '' }
        const target = { docType: DOC_TYPES.SALES_ORDER, docId: created?.id || null, docNo: created?.order_no || orders[index]?.order_no || '' }
        await createDocumentLink({ source, target, relationType: REL_EXT.CONTRACT_TO_ORDER, quantity: orders[index]?.quantity, amount: orders[index]?.total_amount })
        await writeDocumentAudit({ actionType: 'push_sales_contract_to_order', source, target, payload: { order_no: target.docNo } })
      }
      ElMessage.success(`已按 ${orders.length} 条明细生成销售订单`)
      await router.push('/app/orders')
    } catch (error) { ElMessage.error(getErrorMessage(error, '合同转订单失败')) } finally { conversionLocks.delete(lockKey) }
  }

  const findExistingReceivableForOrder = async (order) => {
    if (!order?.id && !order?.order_no) return null
    const clauses = [order.id && `order_id=eq.${safeEq(order.id)}`, order.order_no && `order_no=eq.${safeEq(order.order_no)}`].filter(Boolean)
    const rows = await request({ url: `/sales_receivable_schedule?${clauses.length === 1 ? clauses[0] : `or=(${clauses.join(',')})`}&installment_no=eq.1&status=neq.deleted&limit=1`, method: 'get', headers: { 'Accept-Profile': 'public' }, silentError: true }).catch(() => [])
    return Array.isArray(rows) && rows.length ? rows[0] : null
  }

  const pushSingleOrderToReceivable = async (order) => {
    if (!order?.id && !order?.order_no) throw new Error('销售订单缺少主键或单号，不能生成应收计划')
    if (!isOrderActive(order)) throw new Error(`销售订单 ${order.order_no || order.id} 已取消或已删除`)
    const lockKey = `order-receivable:${order.id || order.order_no}`
    if (conversionLocks.has(lockKey)) return { skipped: true, inFlight: true }
    conversionLocks.add(lockKey)
    try {
    const existing = await findExistingReceivableForOrder(order)
    if (existing) return { skipped: true, schedule: existing }
    const scheduleNo = nextDocNo('AR')
    const plannedAmount = toAmount(order.total_amount)
    const schedulePayload = { schedule_no: scheduleNo, customer_id: order.customer_id || null, customer_name: order.customer_name || '待选择客户', order_id: order.id || null, order_no: order.order_no || '', contract_id: order.contract_id || null, contract_no: order.contract_no || '', payment_node_id: null, installment_no: 1, planned_amount: plannedAmount, received_amount: 0, due_date: order.due_date || dateAfterDays(order.order_date, order.payment_term_days), received_date: null, schedule_status: '待收款', owner_name: order.owner_name || '', remark: '由销售订单生成', status: 'active', properties: { 来源: '销售订单转应收', source_order_id: order.id || null, source_order_no: order.order_no || '' } }
    const createdRows = await request({ url: '/sales_receivable_schedule', method: 'post', headers: { 'Accept-Profile': 'public', 'Content-Profile': 'public', Prefer: 'return=representation' }, data: schedulePayload })
    const schedule = Array.isArray(createdRows) ? createdRows[0] : createdRows
    const source = { docType: DOC_TYPES.SALES_ORDER, docId: order.id || null, docNo: order.order_no || '' }
    const target = { docType: DOC_EXT.RECEIVABLE, docId: schedule?.id || null, docNo: schedule?.schedule_no || scheduleNo }
    await createDocumentLink({ source, target, relationType: REL_EXT.ORDER_TO_RECEIVABLE, amount: plannedAmount, payload: { installment_no: 1 } })
    await writeDocumentAudit({ actionType: 'push_sales_order_to_receivable', source, target, payload: { planned_amount: plannedAmount } })
    return { skipped: false, schedule: schedule || schedulePayload }
    } finally { conversionLocks.delete(lockKey) }
  }

  const createReceivableFromOrder = async (order) => {
    if (!hasPerm('op:sales_receivable.create')) return ElMessage.warning('当前账号没有生成应收计划的权限')
    flowActionLoading.value = true
    try {
      const result = await pushSingleOrderToReceivable(order)
      await gridRef.value?.loadData?.()
      ElMessage[result.skipped ? 'info' : 'success'](result.inFlight ? '该销售订单正在生成应收计划，请稍候' : result.skipped ? '该销售订单已有应收计划' : '应收计划已生成')
    } catch (error) { ElMessage.error(getErrorMessage(error, '生成应收计划失败')) } finally { flowActionLoading.value = false }
  }

  const pushOrdersToReceivables = async () => {
    if (!hasPerm('op:sales_receivable.create')) return ElMessage.warning('当前账号没有生成应收计划的权限')
    const rows = getSelectedSalesOrders()
    if (!rows.length) return ElMessage.warning('请先在表格中选择要生成应收计划的销售订单')
    flowActionLoading.value = true
    let createdCount = 0
    let skippedCount = 0
    const errors = []
    try {
      for (const row of rows) {
        try {
          const result = await pushSingleOrderToReceivable(row)
          if (result.skipped) skippedCount += 1
          else createdCount += 1
        } catch (error) { errors.push(getErrorMessage(error, `销售订单 ${row.order_no || row.id} 生成应收失败`)) }
      }
      await gridRef.value?.loadData?.()
      if (errors.length) {
        ElMessage.warning(`应收计划生成完成 ${createdCount} 单，跳过 ${skippedCount} 单，失败 ${errors.length} 单`)
        console.warn('batch push sales receivables failed', errors)
        return
      }
      ElMessage.success(`已生成应收计划 ${createdCount} 单，跳过已存在 ${skippedCount} 单`)
    } finally { flowActionLoading.value = false }
  }

  const resolveExtendedRowActions = (row) => {
    if (!row || !appKey?.value) return null
    if (appKey.value === 'receivables') return hasPerm('op:sales_payment.create')
      ? [{ key: 'create-payment', label: '登记回款', type: 'warning', icon: 'Money' }]
      : []
    if (appKey.value === 'quotes') {
      const actions = []
      if (canEditPermission.value) actions.push({ key: 'quote-items', label: '报价明细', type: 'primary', icon: 'List' })
      if (canEditPermission.value && ['草稿', '已驳回'].includes(row.approval_status)) actions.push({ key: 'quote-submit', label: '提交审批', type: 'warning', icon: 'Promotion' })
      if (hasPerm('op:sales_quote.approve') && row.approval_status === '待审批') actions.push({ key: 'quote-approve', label: '审批通过', type: 'success', icon: 'CircleCheck' }, { key: 'quote-reject', label: '驳回', type: 'danger', icon: 'CircleClose' })
      if (hasPerm('op:sales_contract.create') && row.approval_status === '已通过') actions.push({ key: 'quote-contract', label: '生成合同', type: 'success', icon: 'Document' })
      return actions
    }
    if (appKey.value === 'contracts') {
      const actions = []
      if (canEditPermission.value && ['草稿', '已驳回'].includes(row.approval_status)) actions.push({ key: 'contract-submit', label: '提交审批', type: 'warning', icon: 'Promotion' })
      if (hasPerm('op:sales_contract.approve') && row.approval_status === '待审批') actions.push({ key: 'contract-approve', label: '审批通过', type: 'success', icon: 'CircleCheck' }, { key: 'contract-reject', label: '驳回', type: 'danger', icon: 'CircleClose' })
      if (hasPerm('op:sales_contract.sign') && row.approval_status === '已通过' && ['未签订', '部分签订'].includes(row.signing_status)) actions.push({ key: 'contract-sign', label: '确认签订', type: 'success', icon: 'Edit' })
      if (hasPerm('op:sales_order.create') && row.approval_status === '已通过' && ['已签订', '部分签订'].includes(row.signing_status)) actions.push({ key: 'contract-order', label: '转销售订单', type: 'primary', icon: 'Tickets' })
      return actions
    }
    return null
  }

  const handleExtendedRowAction = (action, row) => {
    if (!action || action.disabled || !row) return false
    const allowed = action.key === 'create-payment' ? hasPerm('op:sales_payment.create')
      : action.key === 'create-quote' ? hasPerm('op:sales_quote.create')
        : action.key === 'quote-items' ? canEditPermission.value
          : action.key === 'quote-submit' || action.key === 'contract-submit'
            ? canEditPermission.value && ['草稿', '已驳回'].includes(row.approval_status)
            : action.key === 'quote-approve' || action.key === 'quote-reject'
              ? hasPerm('op:sales_quote.approve') && row.approval_status === '待审批'
              : action.key === 'quote-contract'
                ? hasPerm('op:sales_contract.create') && row.approval_status === '已通过'
                : action.key === 'contract-approve' || action.key === 'contract-reject'
                  ? hasPerm('op:sales_contract.approve') && row.approval_status === '待审批'
                  : action.key === 'contract-sign'
                    ? hasPerm('op:sales_contract.sign') && row.approval_status === '已通过' && ['未签订', '部分签订'].includes(row.signing_status)
                    : action.key === 'contract-order'
                      ? hasPerm('op:sales_order.create') && row.approval_status === '已通过' && ['已签订', '部分签订'].includes(row.signing_status)
                      : action.key === 'create-receivable' && hasPerm('op:sales_receivable.create')
    if (!allowed) {
      ElMessage.warning('当前单据状态或账号权限不允许此操作')
      return true
    }
    if (action.key === 'create-quote') return void openQuoteDialogFromOpportunity(row), true
    if (action.key === 'create-payment') return void openPaymentDialog(row), true
    if (action.key === 'quote-items') return void openQuoteItems(row), true
    if (action.key === 'quote-submit') return void updateSalesState('sales_quotes', row, { approval_status: '待审批' }, '提交报价审批'), true
    if (action.key === 'quote-approve') return void updateSalesState('sales_quotes', row, { approval_status: '已通过' }, '批准报价'), true
    if (action.key === 'quote-reject') return void updateSalesState('sales_quotes', row, { approval_status: '已驳回' }, '驳回报价'), true
    if (action.key === 'quote-contract') return void createContractFromQuote(row), true
    if (action.key === 'contract-submit') return void updateSalesState('sales_contracts', row, { approval_status: '待审批' }, '提交合同审批'), true
    if (action.key === 'contract-approve') return void updateSalesState('sales_contracts', row, { approval_status: '已通过' }, '批准合同'), true
    if (action.key === 'contract-reject') return void updateSalesState('sales_contracts', row, { approval_status: '已驳回' }, '驳回合同'), true
    if (action.key === 'contract-sign') return void updateSalesState('sales_contracts', row, { signing_status: '已签订', sign_date: row.sign_date || todayText(), effective_date: row.effective_date || todayText() }, '确认合同签订'), true
    if (action.key === 'contract-order') return void createOrdersFromContract(row), true
    if (action.key === 'create-receivable') return void createReceivableFromOrder(row), true
    return false
  }

  watch(selectedQuickOrder, (order) => {
    if (quickMode.value !== 'payment') return
    const schedule = selectedQuickReceivable.value
    if (schedule?.order_id && order?.id && String(schedule.order_id) !== String(order.id)) paymentForm.schedule_id = ''
    if (!order) return
    paymentForm.customer_name = schedule?.customer_name || order.customer_name || ''
    if (!paymentForm.handler_name) paymentForm.handler_name = order.owner_name || ''
    if (schedule) return
    const remain = selectedQuickOrderRemainAmount.value
    if (remain > 0) paymentForm.amount = remain
    paymentForm.verify_status = remain > 0 && remain <= toAmount(paymentForm.amount) ? '已核销' : '部分核销'
  })
  watch(selectedQuickReceivable, (schedule) => {
    if (!schedule || quickMode.value !== 'payment') return
    paymentForm.customer_name = schedule.customer_name || paymentForm.customer_name
    if (schedule.order_id && String(paymentForm.order_id) !== String(schedule.order_id)) paymentForm.order_id = schedule.order_id
    const outstanding = toAmount(schedule.outstanding_amount ?? (toAmount(schedule.planned_amount) - toAmount(schedule.received_amount)))
    if (outstanding > 0) paymentForm.amount = outstanding
    paymentForm.verify_status = toAmount(schedule.received_amount) + toAmount(paymentForm.amount) >= toAmount(schedule.planned_amount) ? '已核销' : '部分核销'
  })
  watch(() => paymentForm.amount, (amount) => {
    if (quickMode.value !== 'payment') return
    const schedule = selectedQuickReceivable.value
    if (schedule) {
      paymentForm.verify_status = toAmount(schedule.received_amount) + toAmount(amount) >= toAmount(schedule.planned_amount) ? '已核销' : '部分核销'
      return
    }
    const order = selectedQuickOrder.value
    if (order) paymentForm.verify_status = selectedQuickOrderPaidAmount.value + toAmount(amount) >= toAmount(order.total_amount) ? '已核销' : '部分核销'
  })

  return {
    quoteItemsVisible, quoteItemsLoading, quoteItemsSaving, quoteItemsReady, selectedQuote, quoteItems,
    quickReceivableSchedules, selectedQuickReceivable, availableQuickReceivables, selectedQuickOrder, selectedQuickOrderPaidAmount, selectedQuickOrderRemainAmount, quoteItemsTotal,
    loadQuickReceivableSchedules, clearQuickReceivableSchedules, openPaymentDialog, submitQuickPayment, createSalesRow, applyCreatedRow, quoteItemAmount, quoteItemPayload, openQuoteItems, addQuoteItem,
    updateQuoteItemAmount, removeQuoteItem, saveQuoteItems, updateSalesState, openQuoteDialogFromOpportunity,
    createContractFromQuote, createOrdersFromContract, findExistingReceivableForOrder, pushSingleOrderToReceivable,
    createReceivableFromOrder, pushOrdersToReceivables, resolveExtendedRowActions, handleExtendedRowAction
  }
}
