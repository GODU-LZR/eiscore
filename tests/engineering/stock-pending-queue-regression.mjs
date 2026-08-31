// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  STOCK_PENDING_QUEUE_STORAGE_KEY,
  createStockPendingQueue
} from '../../shared/eis-stock-pending-queue.mjs'

class MemoryStorage {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial))
  }

  getItem(key) {
    return this.values.has(key) ? this.values.get(key) : null
  }

  setItem(key, value) {
    this.values.set(key, String(value))
  }
}

const existingItems = [{
  id: 'pending-1',
  mode: 'in',
  actionText: '入库',
  materialName: '物料一',
  payload: { material_id: 1, quantity: 2 },
  createdAt: 1700000000000
}]
const storage = new MemoryStorage({
  [STOCK_PENDING_QUEUE_STORAGE_KEY]: JSON.stringify(existingItems)
})
const queue = createStockPendingQueue({ storage })
assert.deepEqual(queue.loadItems(), existingItems)

const nextItems = [{ ...existingItems[0], id: 'pending-2', mode: 'out' }]
assert.equal(queue.saveItems(nextItems), true)
assert.deepEqual(JSON.parse(storage.getItem(STOCK_PENDING_QUEUE_STORAGE_KEY)), nextItems)
assert.equal(queue.saveItems({ invalid: true }), true)
assert.deepEqual(JSON.parse(storage.getItem(STOCK_PENDING_QUEUE_STORAGE_KEY)), [])

storage.setItem(STOCK_PENDING_QUEUE_STORAGE_KEY, '{invalid-json')
assert.deepEqual(queue.loadItems(), [])
storage.setItem(STOCK_PENDING_QUEUE_STORAGE_KEY, JSON.stringify({ invalid: true }))
assert.deepEqual(queue.loadItems(), [])

const throwingStorage = {
  getItem() { throw new Error('read denied') },
  setItem() { throw new Error('quota exceeded') }
}
const unavailable = createStockPendingQueue({ storage: throwingStorage })
assert.deepEqual(unavailable.loadItems(), [])
assert.equal(unavailable.saveItems(existingItems), false)

const repoRoot = resolve(import.meta.dirname, '../..')
const stockScanSource = readFileSync(resolve(repoRoot, 'eiscore-mobile/src/views/stock/StockScan.vue'), 'utf8')
assert.match(stockScanSource, /loadPendingStockItems,[\s\S]*savePendingStockItems[\s\S]*from\s*['"]@shared\/eis-stock-pending-queue\.mjs['"]/)
assert.match(stockScanSource, /pendingItems\.value = loadPendingStockItems\(\)/)
assert.match(stockScanSource, /savePendingStockItems\(pendingItems\.value\)/)
assert.doesNotMatch(stockScanSource, /eiscore_stock_pending_v1|\blocalStorage\b|\bsessionStorage\b/)

console.log('PASS: mobile stock retry queue uses safe storage without changing item payloads')
