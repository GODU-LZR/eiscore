// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { parseJwtPayload } from './auth-session.mjs'

const request = (url, options = {}) => globalThis.fetch(url, {
  credentials: 'same-origin',
  ...options
})

const HARNESS_AUTH_API_PREFIXES = new Set(['/harness-embed-api', '/harness-flash-embed-api'])

function currentHarnessUser(authorization) {
  const token = String(authorization || '').match(/^Bearer\s+(\S+)$/i)?.[1]
  const claims = token ? parseJwtPayload(token) : null
  if (!claims) return null
  const user = {
    id: String(claims.sub || claims.username || '').trim(),
    username: String(claims.username || claims.sub || '').trim(),
    role: String(claims.app_role || claims.role || '').trim(),
    tenant_id: String(claims.tenant_id || claims.tenantId || '').trim()
  }
  return user.id && user.tenant_id ? user : null
}

function sameHarnessUser(actual, expected) {
  return !!actual && ['id', 'username', 'role', 'tenant_id'].every((key) =>
    String(actual[key] || '').trim() === expected[key]
  )
}

export async function prepareHarnessAuth({ harnessWebUrl, authApiPrefix = '/harness-embed-api', authorization = '' } = {}, isCurrent = () => true) {
  const apiPrefix = String(authApiPrefix || '').trim()
  if (!HARNESS_AUTH_API_PREFIXES.has(apiPrefix) || !isCurrent()) return false
  try {
    const startResponse = await request(`${apiPrefix}/eiscore/auth/start`, {
      method: 'POST',
      headers: { Accept: 'application/json', ...(authorization ? { Authorization: authorization } : {}) }
    })
    if (!isCurrent() || !startResponse.ok) return false
    const start = await startResponse.json().catch(() => ({}))
    if (!isCurrent() || !start?.url) return false
    const startUrl = new URL(start.url, window.location.origin)
    if (startUrl.origin !== window.location.origin || startUrl.pathname !== '/login') return false
    if (!isCurrent()) return false
    const handoffResponse = await request('/company-site/auth/handoff', {
      method: 'POST',
      headers: { Authorization: authorization }
    })
    const handoff = await handoffResponse.json().catch(() => ({}))
    if (!isCurrent() || !handoffResponse.ok || !handoff?.code) return false
    if (!isCurrent()) return false
    const bridgeResponse = await request(`${apiPrefix}/eiscore/auth/handoff`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: handoff.code })
    })
    return isCurrent() && bridgeResponse.ok
  } catch {
    return false
  }
}

export async function ensureHarnessAuth(options = {}, isCurrent = () => true) {
  if (!isCurrent()) return false
  const apiPrefix = String(options.authApiPrefix || '/harness-embed-api').trim()
  const expectedUser = currentHarnessUser(options.authorization)
  if (!String(options.authorization || '').trim() || !HARNESS_AUTH_API_PREFIXES.has(apiPrefix)) {
    return isCurrent() ? prepareHarnessAuth(options, isCurrent) : false
  }
  if (!expectedUser) return isCurrent() ? prepareHarnessAuth(options, isCurrent) : false
  try {
    const response = await request(`${apiPrefix}/eiscore/auth/status`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store'
    })
    const status = await response.json().catch(() => ({}))
    if (response.ok && status?.authenticated === true && sameHarnessUser(status.user, expectedUser)) return isCurrent()
  } catch {}
  return isCurrent() ? prepareHarnessAuth(options, isCurrent) : false
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
