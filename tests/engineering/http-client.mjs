// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const RETRYABLE_STATUSES = new Set([408, 425, 429])
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

export function normalizePositiveInteger(value, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
  const fallbackNumber = Number(fallback)
  const safeFallback = Number.isFinite(fallbackNumber) && fallbackNumber > 0
    ? Math.floor(fallbackNumber)
    : min
  const number = Number(value)
  const chosen = Number.isFinite(number) && number > 0 ? Math.floor(number) : safeFallback
  return Math.max(min, Math.min(max, chosen))
}

export function isRemoteTarget(baseUrl) {
  return !/^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?(?:\/|$)/i.test(String(baseUrl || ''))
}

export function shouldRetryStatus(status) {
  return RETRYABLE_STATUSES.has(Number(status)) || Number(status) >= 500
}

export function shouldRetryMethod(method, retryUnsafeMethods = false) {
  const normalized = String(method || 'GET').toUpperCase()
  return retryUnsafeMethods || SAFE_METHODS.has(normalized)
}

export function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}

export async function withTimeout(fn, ms = 15000) {
  const timeoutMs = normalizePositiveInteger(ms, 15000, { min: 100, max: 10 * 60 * 1000 })
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fn(ctrl.signal)
  } finally {
    clearTimeout(timer)
  }
}

function normalizeBody(body) {
  if (body === undefined || body === null) return body
  if (typeof body === 'string') return body
  if (body instanceof Uint8Array || body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return body
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return body
  if (typeof FormData !== 'undefined' && body instanceof FormData) return body
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body
  return JSON.stringify(body)
}

function resolveRetryDelay(response, attempt, retryDelayMs) {
  const retryAfter = response?.headers?.get?.('retry-after')
  if (retryAfter) {
    const seconds = Number(retryAfter)
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 10000)
    const dateMs = Date.parse(retryAfter)
    if (Number.isFinite(dateMs)) return Math.min(Math.max(0, dateMs - Date.now()), 10000)
  }
  return normalizePositiveInteger(retryDelayMs, 500, { min: 50, max: 10000 }) * attempt
}

export function createHttpClient({
  baseUrl,
  requestAttempts,
  timeoutMs = 15000,
  retryDelayMs = 500,
  retryUnsafeMethods = false,
  fetchImpl = globalThis.fetch
} = {}) {
  const rootUrl = String(baseUrl || '').replace(/\/+$/, '')
  const attempts = normalizePositiveInteger(requestAttempts, isRemoteTarget(rootUrl) ? 3 : 1, { min: 1, max: 8 })
  const defaultTimeoutMs = normalizePositiveInteger(timeoutMs, 15000, { min: 100, max: 10 * 60 * 1000 })

  if (typeof fetchImpl !== 'function') {
    throw new Error('fetch implementation unavailable')
  }

  async function requestResponse(path, { method = 'GET', headers = {}, body, timeout = defaultTimeoutMs } = {}) {
    const normalizedMethod = String(method || 'GET').toUpperCase()
    const maxAttempts = shouldRetryMethod(normalizedMethod, retryUnsafeMethods) ? attempts : 1
    let lastError = null
    let lastResponse = null

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        lastResponse = null
        const response = await withTimeout(
          (signal) => fetchImpl(`${rootUrl}${path}`, {
            method: normalizedMethod,
            headers,
            body: normalizeBody(body),
            signal
          }),
          timeout
        )
        lastResponse = response
        if (!shouldRetryStatus(lastResponse.status) || attempt === maxAttempts) return lastResponse
        lastError = new Error(`HTTP ${lastResponse.status}`)
      } catch (error) {
        lastError = error
        if (attempt === maxAttempts) break
      }
      await sleep(resolveRetryDelay(lastResponse, attempt, retryDelayMs))
    }

    if (lastResponse) return lastResponse
    throw lastError || new Error(`${normalizedMethod} ${path} failed`)
  }

  async function requestJson(path, options = {}) {
    const res = await requestResponse(path, options)
    const text = await res.text()
    let data = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = text
    }
    return { res, status: res.status, ok: res.ok, data, text }
  }

  return { requestResponse, requestJson }
}
