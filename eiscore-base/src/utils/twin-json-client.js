// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const defaultFetch = (...args) => globalThis.fetch(...args)

export function createTwinJsonClient({ getAuthHeaders, fetchImpl = defaultFetch } = {}) {
  if (typeof getAuthHeaders !== 'function') throw new TypeError('getAuthHeaders must be a function')
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function')

  return async function requestTwinJson(path, options = {}) {
    if (typeof path !== 'string' || !path.startsWith('/twin/')) {
      throw new TypeError('Twin JSON path must start with /twin/')
    }
    const response = await fetchImpl(path, {
      method: options.method || 'GET',
      headers: getAuthHeaders(),
      body: options.body ? JSON.stringify(options.body) : undefined
    })
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`API error ${response.status}: ${text.slice(0, 200)}`)
    }
    return response.json()
  }
}
