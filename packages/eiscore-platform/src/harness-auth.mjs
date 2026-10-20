// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const request = (url, options = {}) => globalThis.fetch(url, {
  credentials: 'same-origin',
  ...options
})

const HARNESS_AUTH_API_PREFIXES = new Set(['/harness-embed-api', '/harness-flash-embed-api'])

export async function prepareHarnessAuth({ harnessWebUrl, authApiPrefix = '/harness-embed-api', authorization = '' } = {}) {
  const apiPrefix = String(authApiPrefix || '').trim()
  if (!HARNESS_AUTH_API_PREFIXES.has(apiPrefix)) return false
  try {
    await request(harnessWebUrl, { method: 'GET', redirect: 'manual', headers: { Accept: 'text/html' } })
    const startResponse = await request(`${apiPrefix}/eiscore/auth/start`, {
      method: 'POST',
      headers: { Accept: 'application/json', ...(authorization ? { Authorization: authorization } : {}) }
    })
    if (!startResponse.ok) return false
    const start = await startResponse.json().catch(() => ({}))
    if (!start?.url) return false
    const startUrl = new URL(start.url, window.location.origin)
    if (startUrl.origin !== window.location.origin || startUrl.pathname !== '/login') return false
    const handoffResponse = await request('/company-site/auth/handoff', {
      method: 'POST',
      headers: { Authorization: authorization }
    })
    const handoff = await handoffResponse.json().catch(() => ({}))
    if (!handoffResponse.ok || !handoff?.code) return false
    const bridgeResponse = await request(`${apiPrefix}/eiscore/auth/handoff`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: handoff.code })
    })
    return bridgeResponse.ok
  } catch {
    return false
  }
}

export async function completeHarnessAuth({ code, callbackPath = '/harness-embed-api/eiscore/auth/handoff' } = {}) {
  const path = String(callbackPath || '').trim()
  const handoffCode = String(code || '').trim()
  if (![...HARNESS_AUTH_API_PREFIXES].some((prefix) => path === `${prefix}/eiscore/auth/handoff`) || !handoffCode) return false
  try {
    const response = await request(path, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: handoffCode })
    })
    return response.ok
  } catch {
    return false
  }
}
