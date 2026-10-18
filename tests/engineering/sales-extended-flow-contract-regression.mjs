// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildSalesQuickOrderEntry } from '../../eiscore-sales/src/domain/sales-grid-quick-entry-policy.js'
import { findSalesApp } from '../../eiscore-sales/src/utils/sales-apps.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const componentPath = resolve(repoRoot, 'eiscore-sales/src/components/SalesAppGrid.vue')
const flowPath = resolve(repoRoot, 'eiscore-sales/src/composables/use-sales-document-flow.js')
assert.equal(existsSync(componentPath), true, `missing current sales component: ${componentPath}`)
assert.equal(existsSync(flowPath), true, `missing sales document-flow composable: ${flowPath}`)

const componentSource = readFileSync(componentPath, 'utf8')
const flowSource = readFileSync(flowPath, 'utf8')
const component = componentSource.replace(/\s+/g, ' ')
const flow = flowSource.replace(/\s+/g, ' ')

const expectComponent = (pattern, message) => assert.match(component, pattern, message)
const expectFlow = (pattern, message) => assert.match(flow, pattern, message)
const expectFlowInOrder = (patterns, message) => {
  let cursor = -1
  for (const pattern of patterns) {
    const offset = cursor + 1
    const match = flow.slice(offset).match(pattern)
    assert.ok(match, `${message}: missing ${pattern}`)
    const next = offset + match.index
    assert.ok(next > cursor, `${message}: ${pattern} is out of order`)
    cursor = next
  }
}

// The contract is evaluated against the current sales package. Runtime orchestration belongs
// to the composable; the page retains only its grid and host callbacks.
expectComponent(/from ['"]@\/composables\/use-sales-document-flow['"]/, 'SalesAppGrid uses the document-flow composable')
expectComponent(/useSalesDocumentFlow\(\{/, 'SalesAppGrid creates the document-flow composable')
expectFlow(/export\s+const\s+useSalesDocumentFlow\s*=\s*\(/, 'document-flow composable exports its public factory')
for (const removedDefinition of [
  'const quoteItemAmount =',
  'const openQuoteItems = async',
  'const saveQuoteItems = async',
  'const createContractFromQuote = async',
  'const createOrdersFromContract = async',
  'const pushSingleOrderToReceivable = async',
  'const submitQuickPayment = async'
]) {
  assert.equal(componentSource.includes(removedDefinition), false, `SalesAppGrid reintroduced ${removedDefinition}`)
}

const quote = findSalesApp('quotes')
const contract = findSalesApp('contracts')
const receivable = findSalesApp('receivables')
for (const [key, app, expected] of [
  ['quotes', quote, {
    route: '/app/quotes',
    apiUrl: '/sales_quotes?status=neq.deleted',
    writeUrl: '/sales_quotes',
    viewId: 'sales_quotes',
    configKey: 'sales_quotes_cols',
    summary: ['subtotal', 'tax_amount', 'total_amount'],
    columns: ['quote_no', 'quote_title', 'subtotal', 'tax_amount', 'total_amount', 'payment_term_days', 'approval_status', 'quote_status'],
    ops: 'sales_quote'
  }],
  ['contracts', contract, {
    route: '/app/contracts',
    apiUrl: '/sales_contracts?status=neq.deleted',
    writeUrl: '/sales_contracts',
    viewId: 'sales_contracts',
    configKey: 'sales_contracts_cols',
    summary: ['contract_amount'],
    columns: ['contract_no', 'quote_no', 'contract_amount', 'payment_term_days', 'approval_status', 'signing_status'],
    ops: 'sales_contract'
  }],
  ['receivables', receivable, {
    route: '/app/receivables',
    apiUrl: '/v_sales_receivable_aging?status=neq.deleted',
    writeUrl: '/sales_receivable_schedule',
    viewId: 'sales_receivable_schedule',
    configKey: 'sales_receivable_schedule_cols',
    summary: ['planned_amount', 'received_amount', 'outstanding_amount'],
    columns: ['schedule_no', 'contract_no', 'order_no', 'planned_amount', 'received_amount', 'outstanding_amount', 'schedule_status'],
    ops: 'sales_receivable'
  }]
]) {
  assert.ok(app, `${key} app is configured`)
  assert.equal(app.route, expected.route)
  assert.equal(app.apiUrl, expected.apiUrl)
  assert.equal(app.writeUrl, expected.writeUrl)
  assert.equal(app.viewId, expected.viewId)
  assert.equal(app.configKey, expected.configKey)
  for (const prop of expected.summary) assert.equal(app.summaryConfig.rules[prop], 'sum', `${key} summarizes ${prop}`)
  for (const prop of expected.columns) assert.ok(app.staticColumns.some((column) => column.prop === prop), `${key} exposes ${prop}`)
  for (const operation of ['create', 'edit', 'delete', 'export', 'config']) {
    assert.equal(app.ops[operation], `op:${expected.ops}.${operation}`, `${key} ${operation} permission`)
  }
}

// Quote detail arithmetic and validation remain in the composable after the page split.
expectFlow(/const quoteItemAmount\s*=\s*\(item\)\s*=>\s*Math\.round\([^;]+discount_rate[^;]+\)\s*\/\s*100/, 'quote line amount keeps discount arithmetic')
expectFlow(/const updateQuoteItemAmount\s*=\s*\(item\)\s*=>\s*\{\s*item\.line_amount\s*=\s*quoteItemAmount\(item\)/, 'quote line amount is refreshed after edits')
expectFlow(/!item\.product_name\s*\|\|\s*item\.quantity\s*<=\s*0\s*\|\|\s*item\.tax_rate\s*<\s*0\s*\|\|\s*item\.tax_rate\s*>\s*100\s*\|\|\s*item\.discount_rate\s*<\s*0\s*\|\|\s*item\.discount_rate\s*>\s*100/, 'quote lines reject invalid product and rates')
expectFlow(/subtotal\s*=\s*Math\.round\(rows\.reduce\([^;]+\)\s*\*\s*100\)\s*\/\s*100/, 'quote subtotal rounds to cents')
expectFlow(/taxAmount\s*=\s*Math\.round\(rows\.reduce\([^;]+\)\s*\*\s*100\)\s*\/\s*100/, 'quote tax rounds to cents')
expectFlow(/total_amount:\s*subtotal\s*\+\s*taxAmount/, 'quote total equals subtotal plus tax')

// Every push is ordered, state guarded, idempotent, and leaves a document link/audit trail.
expectFlowInOrder([
  /const openQuoteDialogFromOpportunity\s*=\s*async/,
  /sales_quotes\?select=\*[^`]+opportunity_id=eq\./,
  /url:\s*['"]\/sales_quotes['"],\s*method:\s*['"]post['"]/
], 'opportunity to quote conversion')
expectFlowInOrder([
  /const createContractFromQuote\s*=\s*async/,
  /quote\.approval_status\s*!==\s*['"]已通过['"]/,
  /sales_quote_items\?select=id[^`]+quote_id=eq\./,
  /sales_contracts\?select=\*[^`]+quote_id=eq\./,
  /url:\s*['"]\/sales_contracts['"],\s*method:\s*['"]post['"]/
], 'quote to contract conversion')
expectFlowInOrder([
  /const createOrdersFromContract\s*=\s*async/,
  /contract\.approval_status\s*!==\s*['"]已通过['"]/,
  /!\[['"]已签订['"],\s*['"]部分签订['"]\]\.includes\(contract\.signing_status\)/,
  /sales_orders\?select=id[^`]+contract_id=eq\./,
  /url:\s*['"]\/sales_orders['"],\s*method:\s*['"]post['"]/
], 'contract to order conversion')
expectFlowInOrder([
  /const pushSingleOrderToReceivable\s*=\s*async/,
  /!order\?\.id\s*&&\s*!order\?\.order_no/,
  /findExistingReceivableForOrder\(order\)/,
  /url:\s*['"]\/sales_receivable_schedule['"],\s*method:\s*['"]post['"]/
], 'order to receivable conversion')
expectFlow(/Math\.abs\(totalAmount\s*-\s*toAmount\(contract\.contract_amount\)\)\s*>\s*0\.01/, 'contract amount mismatch uses one-cent tolerance')
assert.equal(/if\s*\(quote\.approval_status\s*&&/.test(flow), false, 'quote conversion must not allow a missing approval state')
assert.equal(/if\s*\(contract\.approval_status\s*&&/.test(flow), false, 'order conversion must not allow a missing contract approval state')
assert.equal(/if\s*\(contract\.signing_status\s*&&/.test(flow), false, 'order conversion must not allow a missing contract signing state')

// Payment registration is part of the same composable boundary and retains its safeguards.
expectFlow(/const submitQuickPayment\s*=\s*async/, 'payment registration is owned by the composable')
expectFlowInOrder([
  /const submitQuickPayment\s*=\s*async/,
  /buildSalesQuickPaymentEntry\(\{/,
  /url:\s*['"]\/sales_payments['"],\s*method:\s*['"]post['"]/
], 'payment registration orchestration')
expectFlow(/await\s+syncCustomerReceivableFromRow\(result\.payload\)/, 'payment registration synchronizes customer receivable')
expectFlow(/await\s+loadQuickReceivableSchedules\(\)/, 'payment registration refreshes receivable schedule state')

for (const relation of [
  'sales_opportunity_to_quote',
  'sales_quote_to_contract',
  'sales_contract_to_order',
  'sales_order_to_receivable'
]) expectFlow(new RegExp(relation), `document relation ${relation}`)
for (const audit of [
  'push_sales_opportunity_to_quote',
  'push_sales_quote_to_contract',
  'push_sales_contract_to_order',
  'push_sales_order_to_receivable'
]) expectFlow(new RegExp(audit), `document audit ${audit}`)

// State and operation permissions must be evaluated by the composable action resolver.
for (const permission of [
  "hasPerm('op:sales_quote.approve')",
  "hasPerm('op:sales_contract.create')",
  "hasPerm('op:sales_contract.approve')",
  "hasPerm('op:sales_contract.sign')",
  "hasPerm('op:sales_order.create')"
]) expectFlow(new RegExp(permission.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `${permission} is checked in the flow resolver`)
expectFlow(/canEditPermission\.value\s*&&\s*\[['"]草稿['"],\s*['"]已驳回['"]\]\s*\.includes\(row\.approval_status\)/, 'approval submission is edit permission gated')
expectFlow(/row\.approval_status\s*===\s*['"]待审批['"]/, 'approval actions require pending state')
expectFlow(/row\.approval_status\s*===\s*['"]已通过['"]/, 'downstream actions require approved state')
expectFlow(/\[['"]已签订['"],\s*['"]部分签订['"]\]\s*\.includes\(row\.signing_status\)/, 'order push requires signed contract')

// A direct order is a supported entry point and stays independent of source documents.
const directOrder = buildSalesQuickOrderEntry({
  form: { product_name: '产品A', quantity: 2, unit: '件', unit_price: 12.5, order_status: '已确认' },
  customer: { id: 7, name: '客户A', owner_name: '张三' },
  orderNo: 'SO-DIRECT-1',
  today: '2026-10-17'
})
assert.equal(directOrder.error, '')
assert.equal(directOrder.payload.order_no, 'SO-DIRECT-1')
assert.equal(directOrder.payload.total_amount, 25)
assert.equal(directOrder.payload.properties['来源'], '快捷建单')
assert.equal(directOrder.payload.properties.商机ID, undefined)
assert.equal(directOrder.payload.properties.商机编号, undefined)
expectComponent(/const openOrderDialog\s*=\s*async\s*\(source\s*=\s*null\)/, 'direct order entry defaults source to null')
expectComponent(/currentOrderSource\.value\s*=\s*isBusinessSource\s*\?\s*source\s*:\s*null/, 'direct order entry clears stale business source')

console.log('PASS: sales extended flow contract covers current package, composable conversion chain, state/permission gates and direct orders')
