// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createSafeStorage } from '../packages/eiscore-platform/src/safe-storage.mjs'

export const STOCK_PENDING_QUEUE_STORAGE_KEY = 'eiscore_stock_pending_v1'

function resolveBrowserStorage(storage) {
  if (storage !== undefined) return storage
  if (typeof window === 'undefined') return null
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

export function createStockPendingQueue({ storage } = {}) {
  const safeStorage = createSafeStorage(resolveBrowserStorage(storage))

  const loadItems = () => {
    const value = safeStorage.getJson(STOCK_PENDING_QUEUE_STORAGE_KEY, [])
    return Array.isArray(value) ? value : []
  }

  const saveItems = (items) => safeStorage.setJson(
    STOCK_PENDING_QUEUE_STORAGE_KEY,
    Array.isArray(items) ? items : []
  )

  return Object.freeze({ loadItems, saveItems })
}

const stockPendingQueue = createStockPendingQueue()

export const loadPendingStockItems = stockPendingQueue.loadItems
export const savePendingStockItems = stockPendingQueue.saveItems
