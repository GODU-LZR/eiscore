// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createSafeStorage } from '../packages/eiscore-platform/src/safe-storage.mjs'

export const CHECK_CACHE_KEY = 'eiscore_check_cache_v1'
export const CHECK_COLD_MODE_KEY = 'eiscore_check_cold_mode_v1'
export const CHECK_PENDING_KEY = 'eiscore_check_pending_v1'

function resolveBrowserStorage(storage) {
  if (storage !== undefined) return storage
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

export function createCheckCache({ storage, now = Date.now } = {}) {
  const safeStorage = createSafeStorage(resolveBrowserStorage(storage))

  const getCheckCache = () => {
    const cached = safeStorage.getJson(CHECK_CACHE_KEY, null)
    if (!cached || !Array.isArray(cached.warehouses)) return null
    return cached
  }

  const setCheckCache = (payload) => {
    const data = payload || {}
    const cache = {
      version: 1,
      updatedAt: now(),
      warehouses: Array.isArray(data.warehouses) ? data.warehouses : [],
      meta: data.meta || {}
    }
    safeStorage.setJson(CHECK_CACHE_KEY, cache)
    return cache
  }

  const clearCheckCache = () => { safeStorage.remove(CHECK_CACHE_KEY) }
  const getColdMode = () => safeStorage.getText(CHECK_COLD_MODE_KEY) === '1'
  const setColdMode = (on) => { safeStorage.setText(CHECK_COLD_MODE_KEY, on ? '1' : '0') }

  const getPendingChecks = () => {
    const pending = safeStorage.getJson(CHECK_PENDING_KEY, [])
    return Array.isArray(pending) ? pending : []
  }

  const addPendingCheck = (entry) => {
    const list = [...getPendingChecks(), entry]
    safeStorage.setJson(CHECK_PENDING_KEY, list)
    return list
  }

  const removePendingChecks = (ids) => {
    const idSet = new Set(ids || [])
    if (!idSet.size) return getPendingChecks()
    const next = getPendingChecks().filter((item) => !idSet.has(item.id))
    safeStorage.setJson(CHECK_PENDING_KEY, next)
    return next
  }

  const clearPendingChecks = () => { safeStorage.remove(CHECK_PENDING_KEY) }

  return Object.freeze({
    getCheckCache,
    setCheckCache,
    clearCheckCache,
    getColdMode,
    setColdMode,
    getPendingChecks,
    addPendingCheck,
    removePendingChecks,
    clearPendingChecks
  })
}
