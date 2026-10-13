// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 EISCore contributors

import assert from 'node:assert/strict'
import { balanceTestInventory } from '../business/inventory-cleanup.mjs'

const runId = 'chain_123_abcdef'
const identity = { runId, batchNo: `AUTO-BATCH-${runId}`, transactionNo: `AUTO-${runId}` }

function fixture({ changedQuantity = false, unrelatedTransaction = false, draft = false, timeoutAfterWrite = false } = {}) {
  let writes = 0
  const batch = { id: 'batch', material_id: 1, warehouse_id: 'warehouse', unit: 'kg', available_qty: changedQuantity ? 2 : 1, locked_qty: 0 }
  const original = {
    transaction_no: identity.transactionNo, batch_id: batch.id, material_id: 1,
    warehouse_id: 'warehouse', unit: 'kg', quantity: 1, before_qty: null, after_qty: 1,
    operator: 'auto-entry-chain', remark: `AUTO_ENTRY_CHAIN:fixed-stock-in-document-entry ${runId}`
  }
  const transactions = [original]
  if (unrelatedTransaction) transactions.push({ ...original, transaction_no: 'other' })
  return {
    get writes() { return writes },
    async api(path, options = {}) {
      if (options.method === 'POST') {
        assert.equal(path, '/api/rpc/stock_out')
        assert.equal(options.body.p_batch_no, identity.batchNo)
        assert.equal(options.body.p_quantity, 1)
        writes += 1
        batch.available_qty = 0
        transactions.push({ ...original, transaction_no: options.body.p_transaction_no, quantity: -1, before_qty: 1, after_qty: 0, remark: options.body.p_remark })
        if (timeoutAfterWrite) throw new Error('timeout after commit')
        return { data: { success: true, transaction_no: options.body.p_transaction_no } }
      }
      if (path.startsWith('/api/inventory_batches?')) return { data: [{ ...batch }] }
      if (path.startsWith('/api/inventory_transactions?')) return { data: transactions.map((row) => ({ ...row })) }
      if (path.startsWith('/api/inventory_drafts?')) return { data: draft ? [{ id: 'draft' }] : [] }
      if (path.startsWith('/api/v_inventory_current?')) return { data: [{ total_qty: batch.available_qty }] }
      throw new Error(`unexpected request ${path}`)
    }
  }
}

const normal = fixture()
assert.match(await balanceTestInventory(normal.api, identity), /balanced to zero/)
assert.equal(normal.writes, 1)
await balanceTestInventory(normal.api, identity)
assert.equal(normal.writes, 1, 'repeated cleanup must not issue another stock-out')

for (const options of [{ changedQuantity: true }, { unrelatedTransaction: true }, { draft: true }]) {
  const invalid = fixture(options)
  await assert.rejects(balanceTestInventory(invalid.api, identity))
  assert.equal(invalid.writes, 0, 'changed inventory must not be compensated')
}

const uncertain = fixture({ timeoutAfterWrite: true })
await assert.rejects(balanceTestInventory(uncertain.api, identity), /timeout after commit/)
assert.equal(uncertain.writes, 1, 'uncertain writes must not be blindly retried')
await balanceTestInventory(uncertain.api, identity)
assert.equal(uncertain.writes, 1, 'readback after timeout must recognize completed compensation')

console.log('PASS: inventory cleanup balances audit, rejects changed stock, and avoids duplicate writes')
