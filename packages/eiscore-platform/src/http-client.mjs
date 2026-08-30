// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import {
  DEFAULT_ENTERPRISE_CONFIG,
  getEnterpriseConfig
} from './enterprise-config.mjs'

export const DEFAULT_HTTP_TIMEOUT_MS = 15_000

const SAFE_ORIGIN = 'https://eiscore.invalid'
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/
const SERVICE_ENDPOINT_KEYS = Object.freeze({
  api: 'apiBasePath',
  agent: 'agentBasePath'
})

export class PlatformHttpError extends Error {
  constructor(code, { status = 0, method = 'GET', path = '/' } = {}) {
    const safeMethod = String(method || 'GET').toUpperCase()
    const safePath = typeof path === 'string' && path.startsWith('/') ? path.split('?', 1)[0] : '/'
    super(`Platform HTTP request failed: ${code} (${safeMethod} ${safePath})`)
    this.name = 'PlatformHttpError'
    this.code = code
    this.status = Number(status) || 0
    this.method = safeMethod
    this.path = safePath
  }
}

export function classifyHttpStatus(status) {
  const value = Number(status)
  if (value === 401) return 'unauthorized'
  if (value === 403) return 'forbidden'
  if (value === 404) return 'not-found'
  if (value === 409) return 'conflict'
  if (value === 422) return 'validation'
  if (value === 429) return 'rate-limited'
  if (value >= 500) return 'server'
  if (value >= 400) return 'client'
  return 'http'
}

function normalizeTimeout(value, fallback = DEFAULT_HTTP_TIMEOUT_MS) {
  const number = Number(value)
  const resolved = Number.isFinite(number) && number > 0 ? Math.floor(number) : fallback
  return Math.max(100, Math.min(120_000, resolved))
}

function normalizeRequestTarget(target) {
  if (typeof target !== 'string') throw new PlatformHttpError('invalid-path')
  const raw = target.trim()
  if (
    !raw.startsWith('/') ||
    raw.startsWith('//') ||
    raw.includes('\\') ||
    raw.includes('#') ||
    CONTROL_CHARACTER_PATTERN.test(raw)
  ) throw new PlatformHttpError('invalid-path')

  const rawPath = raw.split('?', 1)[0]
  try {
    if (rawPath.split('/').some((segment) => decodeURIComponent(segment) === '..')) {
      throw new PlatformHttpError('invalid-path')
    }
  } catch (error) {
    if (error instanceof PlatformHttpError) throw error
    throw new PlatformHttpError('invalid-path')
  }

  let parsed
  try {
    parsed = new URL(raw, SAFE_ORIGIN)
  } catch {
    throw new PlatformHttpError('invalid-path')
  }
  if (parsed.origin !== SAFE_ORIGIN || parsed.hash) throw new PlatformHttpError('invalid-path')
  return {
    path: parsed.pathname,
    search: parsed.search,
    safePath: parsed.pathname
  }
}

function joinUrlPath(root, path) {
  const normalizedRoot = String(root || '').replace(/\/+$/, '')
  return path === '/' ? (normalizedRoot || '/') : `${normalizedRoot}${path}`
}

export function resolvePlatformServiceUrl(target, {
  enterpriseConfig = DEFAULT_ENTERPRISE_CONFIG,
  service = 'api'
} = {}) {
  const endpointKey = SERVICE_ENDPOINT_KEYS[service]
  if (!endpointKey) throw new PlatformHttpError('invalid-service')
  const requestTarget = normalizeRequestTarget(target)
  const publicBaseUrl = String(enterpriseConfig?.endpoints?.publicBaseUrl || '').replace(/\/+$/, '')
  const serviceBasePath = String(enterpriseConfig?.endpoints?.[endpointKey] || '')
  if (!serviceBasePath.startsWith('/') || serviceBasePath.startsWith('//')) {
    throw new PlatformHttpError('invalid-service')
  }
  const root = `${publicBaseUrl}${serviceBasePath}`
  return `${joinUrlPath(root, requestTarget.path)}${requestTarget.search}`
}

function normalizeBody(body, headers) {
  if (body === undefined || body === null || typeof body === 'string') return body
  if (body instanceof Uint8Array || body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return body
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return body
  if (typeof FormData !== 'undefined' && body instanceof FormData) return body
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  return JSON.stringify(body)
}

async function parseJsonResponse(response, method, path) {
  let text
  try {
    text = await response.text()
  } catch {
    throw new PlatformHttpError('invalid-response', { status: response.status, method, path })
  }
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    throw new PlatformHttpError('invalid-response', { status: response.status, method, path })
  }
}

export function createPlatformHttpClient({
  enterpriseConfig = getEnterpriseConfig(globalThis),
  fetchImpl = globalThis.fetch,
  getAccessToken = () => '',
  onUnauthorized = () => {},
  timeoutMs = DEFAULT_HTTP_TIMEOUT_MS,
  setTimeoutImpl = globalThis.setTimeout,
  clearTimeoutImpl = globalThis.clearTimeout,
  AbortControllerImpl = globalThis.AbortController
} = {}) {
  if (typeof fetchImpl !== 'function') throw new PlatformHttpError('fetch-unavailable')
  if (typeof AbortControllerImpl !== 'function') throw new PlatformHttpError('abort-unavailable')
  const defaultTimeoutMs = normalizeTimeout(timeoutMs)

  async function requestJson(target, options = {}) {
    const method = String(options.method || 'GET').toUpperCase()
    const service = options.service || 'api'
    const requestTarget = normalizeRequestTarget(target)
    const url = resolvePlatformServiceUrl(target, { enterpriseConfig, service })
    const headers = new Headers(options.headers || {})
    if (!headers.has('Accept')) headers.set('Accept', 'application/json')

    let token = ''
    try {
      token = String(await getAccessToken() || '').trim()
    } catch {
      throw new PlatformHttpError('auth-unavailable', { method, path: requestTarget.safePath })
    }
    if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`)

    const controller = new AbortControllerImpl()
    let timedOut = false
    const timeout = normalizeTimeout(options.timeoutMs, defaultTimeoutMs)
    const timer = setTimeoutImpl(() => {
      timedOut = true
      controller.abort()
    }, timeout)
    const externalSignal = options.signal
    const abortFromExternal = () => controller.abort()
    if (externalSignal?.aborted) controller.abort()
    else externalSignal?.addEventListener?.('abort', abortFromExternal, { once: true })

    let response
    try {
      response = await fetchImpl(url, {
        method,
        headers,
        body: normalizeBody(options.body, headers),
        signal: controller.signal,
        credentials: options.credentials || 'same-origin'
      })
    } catch {
      const code = timedOut ? 'timeout' : (controller.signal.aborted ? 'aborted' : 'network')
      throw new PlatformHttpError(code, { method, path: requestTarget.safePath })
    } finally {
      clearTimeoutImpl(timer)
      externalSignal?.removeEventListener?.('abort', abortFromExternal)
    }

    if (!response?.ok) {
      const status = Number(response?.status) || 0
      const code = classifyHttpStatus(status)
      const event = { code, status, method, path: requestTarget.safePath }
      if (status === 401) {
        try { await onUnauthorized(event) } catch {}
      }
      throw new PlatformHttpError(code, event)
    }

    const data = await parseJsonResponse(response, method, requestTarget.safePath)
    return { status: response.status, headers: response.headers, data }
  }

  return Object.freeze({ requestJson })
}
