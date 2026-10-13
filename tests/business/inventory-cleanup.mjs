// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 EISCore contributors

import assert from 'node:assert/strict'

export async function balanceTestInventory(api, { runId, batchNo, transactionNo }) {
  assert.match(runId, /^chain_\d+_[a-f0-9]+$/)
  assert.equal(batchNo, `AUTO-BATCH-${runId}`)
  assert.equal(transactionNo, `AUTO-${runId}`)
  const batchPath = `/api/inventory_batches?batch_no=eq.${encodeURIComponent(batchNo)}`
  const transactionPath = `/api/inventory_transactions?batch_no=eq.${encodeURIComponent(batchNo)}`
  const transactionFields = 'transaction_no,batch_id,material_id,warehouse_id,unit,quantity,before_qty,after_qty,operator,remark'
  const readBatch = async () => (await api(`${batchPath}&select=id,material_id,warehouse_id,unit,available_qty,locked_qty`)).data
  const readTransactions = async () => (await api(`${transactionPath}&select=${transactionFields}`)).data
  const batches = await readBatch()
  const transactions = await readTransactions()
  assert.equal(batches.length, 1, 'test batch must be unique')
  const batch = batches[0]
  const original = transactions.find((row) => row.transaction_no === transactionNo)
  assert.ok(original, 'original test stock-in must exist')
  for (const row of transactions) {
    assert.equal(row.batch_id, batch.id)
    assert.equal(row.material_id, batch.material_id)
    assert.equal(row.warehouse_id, batch.warehouse_id)
    assert.equal(row.unit, 'kg')
    assert.equal(row.operator, 'auto-entry-chain')
  }
  assert.equal(batch.unit, 'kg')
  assert.equal(Number(batch.locked_qty), 0)
  assert.equal(Number(original.quantity), 1)
  assert.equal(original.remark, `AUTO_ENTRY_CHAIN:fixed-stock-in-document-entry ${runId}`)
  const drafts = await api(`/api/inventory_drafts?batch_id=eq.${encodeURIComponent(batch.id)}&select=id&limit=1`)
  assert.deepEqual(drafts.data, [], 'test batch must not be referenced by a draft')
  const cleanupTransactionNo = `AUTO-CLEANUP-${runId}`
  if (!transactions.some((row) => row.transaction_no === cleanupTransactionNo)) {
    assert.equal(transactions.length, 1, 'test stock must not have other transactions')
    assert.equal(Number(batch.available_qty), 1, 'test inventory changed before cleanup')
    // Stock ledgers are protected from DELETE. Preserve the audit using the
    // business RPC; never retry an uncertain write without reading it back.
    const out = await api('/api/rpc/stock_out', {
      method: 'POST',
      body: {
        p_material_id: batch.material_id, p_warehouse_id: batch.warehouse_id,
        p_quantity: 1, p_unit: batch.unit, p_batch_no: batchNo,
        p_transaction_no: cleanupTransactionNo, p_operator: 'auto-entry-chain',
        p_remark: `AUTO_ENTRY_CHAIN:cleanup ${runId}`
      }
    })
    const result = out.data?.result || out.data
    assert.equal(result?.success, true)
    assert.equal(result.transaction_no, cleanupTransactionNo)
  }
  const balancedBatches = await readBatch()
  const balancedTransactions = await readTransactions()
  assert.equal(balancedBatches.length, 1)
  assert.equal(balancedBatches[0].id, batch.id)
  assert.equal(Number(balancedBatches[0].available_qty), 0)
  assert.equal(Number(balancedBatches[0].locked_qty), 0)
  assert.equal(balancedTransactions.length, 2)
  const compensation = balancedTransactions.find((row) => row.transaction_no === cleanupTransactionNo)
  assert.ok(compensation, 'compensation audit must exist')
  assert.equal(compensation.batch_id, batch.id)
  assert.equal(Number(compensation.quantity), -1)
  assert.equal(Number(compensation.before_qty), 1)
  assert.equal(Number(compensation.after_qty), 0)
  assert.equal(compensation.remark, `AUTO_ENTRY_CHAIN:cleanup ${runId}`)
  assert.equal(balancedTransactions.reduce((sum, row) => sum + Number(row.quantity), 0), 0)
  const current = await api(`/api/v_inventory_current?id=eq.${encodeURIComponent(batch.id)}&select=total_qty`)
  assert.equal(current.data.length, 1)
  assert.equal(Number(current.data[0].total_qty), 0)
  return 'test stock balanced to zero via stock_out; batch and two audit transactions retained'
}
