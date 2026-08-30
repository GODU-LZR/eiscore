// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const defaultFetch = (...args) => globalThis.fetch(...args)

export function createDocumentIntakeClient({ getAuthHeader, fetchImpl = defaultFetch } = {}) {
  if (typeof getAuthHeader !== 'function') throw new TypeError('getAuthHeader must be a function')
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function')

  const requestJson = async (path, {
    method = 'GET',
    data,
    errorMessage = '智能收单请求失败'
  } = {}) => {
    if (typeof path !== 'string' || !path.startsWith('/agent/document-intake/')) {
      throw new TypeError('document intake path must start with /agent/document-intake/')
    }
    const headers = { ...getAuthHeader() }
    const options = { method, headers }
    if (data !== undefined) {
      headers['Content-Type'] = 'application/json'
      options.body = JSON.stringify(data)
    }
    const response = await fetchImpl(path, options)
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(text || `${errorMessage}：${response.status}`)
    }
    return response.json()
  }

  return { requestJson }
}
