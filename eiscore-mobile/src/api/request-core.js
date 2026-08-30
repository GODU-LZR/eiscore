// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

function buildTarget(path, params) {
  if (!params) return path
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  if (!query) return path
  return `${path}${path.includes('?') ? '&' : '?'}${query}`
}

export function createMobileApiRequest({ getHttpClient, defaultHeaders = {} } = {}) {
  if (typeof getHttpClient !== 'function') {
    throw new TypeError('getHttpClient must be a function')
  }
  const baseHeaders = { ...defaultHeaders }

  return async function request(method, path, { params, body, headers = {} } = {}) {
    const target = buildTarget(path, params)
    try {
      const { data } = await getHttpClient().requestJson(target, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...baseHeaders,
          ...headers
        },
        body: body ? body : undefined
      })
      return data
    } catch (error) {
      if (error?.status === 401) throw new Error('登录已过期')
      if (error?.status) {
        throw new Error(error.displayMessage || `请求失败 (${error.status})`)
      }
      throw error
    }
  }
}
