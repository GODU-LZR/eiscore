// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const request = (url, options = {}) => globalThis.fetch(url, {
  credentials: 'same-origin',
  ...options
})

export const HARNESS_PERSONAS = Object.freeze({
  'work-assistant': Object.freeze({
    id: 'work-assistant',
    webPath: '/harness-assistant-embed/',
    apiPrefix: '/harness-assistant-embed-api',
    callbackPath: '/harness-assistant-embed-api/eiscore/auth/handoff'
  }),
  workbench: Object.freeze({
    id: 'workbench',
    webPath: '/harness-workbench-embed/',
    apiPrefix: '/harness-workbench-embed-api',
    callbackPath: '/harness-workbench-embed-api/eiscore/auth/handoff'
  }),
  flash: Object.freeze({
    id: 'flash',
    webPath: '/harness-flash-embed/',
    apiPrefix: '/harness-flash-embed-api',
    callbackPath: '/harness-flash-embed-api/eiscore/auth/handoff'
  })
})

const LEGACY_PERSONA_ALIASES = Object.freeze({
  '/harness-embed-api': 'workbench',
  '/harness-flash-embed-api': 'flash'
})
const LEGACY_WEB_PATHS = Object.freeze({ '/harness-embed/': 'workbench' })

export function getHarnessPersona(value = 'workbench') {
  const key = String(value || '').trim()
  const persona = HARNESS_PERSONAS[key] || HARNESS_PERSONAS[LEGACY_PERSONA_ALIASES[key]]
  if (!persona) throw new Error('Unsupported Harness persona')
  return persona
}

export async function prepareHarnessAuth({ persona = '', harnessWebUrl = '', authApiPrefix = '', authorization = '' } = {}) {
  let selected
  const requestedApiPrefix = String(authApiPrefix || '').trim()
  const requestedWebPath = String(harnessWebUrl || '').trim()
  try {
    const inferred = LEGACY_PERSONA_ALIASES[requestedApiPrefix]
      || Object.values(HARNESS_PERSONAS).find(({ apiPrefix }) => apiPrefix === requestedApiPrefix)?.id
      || LEGACY_WEB_PATHS[requestedWebPath]
      || Object.values(HARNESS_PERSONAS).find(({ webPath }) => webPath === requestedWebPath)?.id
      || 'workbench'
    selected = getHarnessPersona(persona || inferred)
  } catch { return false }
  const webPath = requestedWebPath || selected.webPath
  const apiPrefix = requestedApiPrefix || selected.apiPrefix
  const validWebPath = webPath === selected.webPath || (selected.id === 'workbench' && webPath === '/harness-embed/')
  const validApiPrefix = apiPrefix === selected.apiPrefix || (selected.id === 'workbench' && apiPrefix === '/harness-embed-api')
  if (!validApiPrefix || !validWebPath) return false
  try {
    await request(webPath, {
      method: 'GET',
      // The local Vite proxy may receive an absolute Harness login redirect.
      // Keep the handoff same-origin; the following API calls complete auth.
      redirect: 'manual',
      headers: { Accept: 'text/html' }
    })
    const startResponse = await request(`${apiPrefix}/eiscore/auth/start`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(authorization ? { Authorization: authorization } : {})
      }
    })
    if (!startResponse.ok) return false
    const start = await startResponse.json().catch(() => ({}))
    if (!start?.url) return false
    const startUrl = new URL(start.url, window.location.origin)
    if (startUrl.origin !== window.location.origin || startUrl.pathname !== '/login') return false
    const handoffResponse = await request('/company-site/auth/handoff', {
      method: 'POST',
      headers: { Authorization: authorization, 'Content-Type': 'application/json' },
      body: JSON.stringify({ audience: selected.id })
    })
    const handoff = await handoffResponse.json().catch(() => ({}))
    if (!handoffResponse.ok || !handoff?.code) return false
    const bridgeResponse = await request(`${apiPrefix}/eiscore/auth/handoff`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: handoff.code, audience: selected.id })
    })
    return bridgeResponse.ok
  } catch {
    return false
  }
}

export async function completeHarnessAuth({ code, callbackPath = '', persona = '' } = {}) {
  const path = String(callbackPath || '').trim()
  const handoffCode = String(code || '').trim()
  let selected
  try { selected = getHarnessPersona(persona || Object.values(HARNESS_PERSONAS).find(({ callbackPath }) => callbackPath === path)?.id) } catch { return false }
  if (path !== selected.callbackPath || !handoffCode) return false
  try {
    const response = await request(path, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: handoffCode, audience: selected.id })
    })
    return response.ok
  } catch {
    return false
  }
}
