// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const BUSINESS_SNAPSHOT_ENDPOINT = '/ai/business-snapshot'
const defaultFetch = (...args) => globalThis.fetch(...args)

export function createBusinessSnapshotLoader({ getAuthHeaders, fetchImpl = defaultFetch } = {}) {
  if (typeof getAuthHeaders !== 'function') throw new TypeError('getAuthHeaders must be a function')
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function')

  return async function loadBusinessSnapshot() {
    const response = await fetchImpl(BUSINESS_SNAPSHOT_ENDPOINT, {
      method: 'GET',
      headers: getAuthHeaders()
    })
    if (!response.ok) {
      const error = new Error(`快照读取失败 (${response.status})`)
      error.status = response.status
      throw error
    }
    const data = await response.json()
    return data?.snapshot || {}
  }
}
