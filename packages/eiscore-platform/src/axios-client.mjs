// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { getEnterpriseConfig } from './enterprise-config.mjs'
import {
  PlatformHttpError,
  classifyHttpStatus,
  resolvePlatformServiceUrl
} from './http-client.mjs'

export const DEFAULT_AXIOS_TIMEOUT_MS = 8_000

const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/
const SAFE_AXIOS_MESSAGE_PATTERNS = Object.freeze([
  /^Network Error$/i,
  /^Failed to fetch$/i,
  /^Request aborted$/i,
  /^canceled$/i,
  /^timeout of \d+ms exceeded$/i,
  /^Request failed with status code \d{3}$/i
])
const SAFE_ERROR_HEADER_NAMES = new Set([
  'accept',
  'accept-profile',
  'content-profile',
  'content-type'
])
const SENSITIVE_ERROR_MESSAGE_PATTERN = /(?:bearer\s+|(?:password|passphrase|token|secret|api[\s_-]?key|authorization)\s*[:=]|https?:\/\/|[?&][^=\s&]{1,80}=)/i
const SAFE_PATH = Symbol('eiscore.platform.safePath')
const REQUEST_CONTEXT = Symbol('eiscore.platform.requestContext')
const AUTO_SERVICE_PREFIXES = Object.freeze({ api: '/api', agent: '/agent' })

function invalidPath() {
  return new PlatformHttpError('invalid-path')
}

function serviceBaseUrl(enterpriseConfig, service, locationOrigin) {
  const configuredRoot = resolvePlatformServiceUrl('/', { enterpriseConfig, service })
  if (/^https?:\/\//i.test(configuredRoot)) return new URL(configuredRoot)
  if (typeof locationOrigin !== 'string' || !locationOrigin.trim()) throw invalidPath()
  let origin
  try {
    origin = new URL(locationOrigin)
  } catch {
    throw invalidPath()
  }
  if (origin.origin !== locationOrigin.replace(/\/$/, '') || origin.pathname !== '/') throw invalidPath()
  return new URL(configuredRoot, origin)
}

function rawAbsolutePath(target) {
  const schemeIndex = target.indexOf('://')
  const pathIndex = target.indexOf('/', schemeIndex + 3)
  if (pathIndex < 0) return '/'
  return target.slice(pathIndex).split(/[?#]/, 1)[0]
}

function hasTraversal(path) {
  try {
    return path.split('/').some((segment) => decodeURIComponent(segment) === '..')
  } catch {
    return true
  }
}

function autoServiceTarget(raw, options) {
  if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(raw)) {
    for (const candidate of Object.keys(AUTO_SERVICE_PREFIXES)) {
      try {
        return normalizePlatformAxiosTarget(raw, { ...options, service: candidate })
      } catch (error) {
        if (!(error instanceof PlatformHttpError) || error.code !== 'invalid-path') throw error
      }
    }
    throw invalidPath()
  }

  for (const [candidate, prefix] of Object.entries(AUTO_SERVICE_PREFIXES)) {
    const path = raw.split('?', 1)[0]
    if (path !== prefix && !path.startsWith(`${prefix}/`)) continue
    const suffix = raw.slice(prefix.length)
    const resourceTarget = !suffix
      ? '/'
      : (suffix.startsWith('?') ? `/${suffix}` : suffix)
    return normalizePlatformAxiosTarget(resourceTarget, {
      ...options,
      service: candidate
    })
  }
  throw invalidPath()
}

function normalizePlatformAxiosTarget(target, {
  enterpriseConfig,
  service,
  locationOrigin
}) {
  if (typeof target !== 'string') throw invalidPath()
  const raw = target.trim()
  if (
    !raw ||
    raw.startsWith('//') ||
    raw.includes('\\') ||
    raw.includes('#') ||
    CONTROL_CHARACTER_PATTERN.test(raw)
  ) throw invalidPath()

  if (service === 'auto') {
    return autoServiceTarget(raw, { enterpriseConfig, locationOrigin })
  }

  if (!/^[A-Za-z][A-Za-z\d+.-]*:/.test(raw)) {
    const resourceTarget = raw.startsWith('/') ? raw : `/${raw}`
    return {
      resourceTarget,
      service,
      url: resolvePlatformServiceUrl(resourceTarget, { enterpriseConfig, service })
    }
  }

  if (hasTraversal(rawAbsolutePath(raw))) throw invalidPath()
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    throw invalidPath()
  }
  if (parsed.username || parsed.password || parsed.hash) throw invalidPath()

  const root = serviceBaseUrl(enterpriseConfig, service, locationOrigin)
  const rootPath = root.pathname.replace(/\/+$/, '') || '/'
  const isWithinRoot = rootPath === '/'
    ? parsed.pathname.startsWith('/')
    : parsed.pathname === rootPath || parsed.pathname.startsWith(`${rootPath}/`)
  if (parsed.origin !== root.origin || !isWithinRoot) throw invalidPath()

  const resourcePath = rootPath === '/'
    ? parsed.pathname
    : (parsed.pathname.slice(rootPath.length) || '/')
  const resourceTarget = `${resourcePath}${parsed.search}`
  return {
    resourceTarget,
    service,
    url: resolvePlatformServiceUrl(resourceTarget, { enterpriseConfig, service })
  }
}

export function resolvePlatformAxiosUrl(target, {
  enterpriseConfig = getEnterpriseConfig(globalThis),
  service = 'api',
  locationOrigin = globalThis.location?.origin || ''
} = {}) {
  return normalizePlatformAxiosTarget(target, {
    enterpriseConfig,
    service,
    locationOrigin
  }).url
}

function headerName(headers, name) {
  if (!headers || typeof headers !== 'object') return ''
  if (typeof headers.has === 'function' && headers.has(name)) return name
  const lowerName = name.toLowerCase()
  return Object.keys(headers).find((key) => key.toLowerCase() === lowerName) || ''
}

function hasHeader(headers, name) {
  return !!headerName(headers, name)
}

function setHeader(headers, name, value) {
  if (typeof headers.set === 'function') {
    headers.set(name, value)
    return
  }
  const existingName = headerName(headers, name)
  headers[existingName || name] = value
}

function normalizeTimeout(value) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) return DEFAULT_AXIOS_TIMEOUT_MS
  return Math.max(100, Math.min(120_000, Math.floor(number)))
}

function safeResourcePath(resourceTarget) {
  const path = String(resourceTarget || '/').split('?', 1)[0]
  return path.startsWith('/') ? path : '/'
}

function classifyAxiosError(error) {
  if (error instanceof PlatformHttpError) return error.code
  const status = Number(error?.response?.status) || 0
  if (status) return classifyHttpStatus(status)
  if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') return 'timeout'
  if (error?.code === 'ERR_CANCELED') return 'aborted'
  return 'network'
}

function safeAxiosErrorMessage(error) {
  if (error instanceof PlatformHttpError) return error.message
  const message = typeof error?.message === 'string' ? error.message.trim() : ''
  return SAFE_AXIOS_MESSAGE_PATTERNS.some((pattern) => pattern.test(message))
    ? message
    : '请求失败'
}

function safeMappedErrorMessage(candidate, fallback) {
  if (typeof candidate !== 'string') return fallback
  const message = candidate.trim()
  if (
    !message ||
    message.length > 200 ||
    CONTROL_CHARACTER_PATTERN.test(message) ||
    SENSITIVE_ERROR_MESSAGE_PATTERN.test(message)
  ) return fallback
  return message
}

async function resolveNotificationMessage(error, event, resolver) {
  const fallback = safeAxiosErrorMessage(error)
  if (typeof resolver !== 'function') return fallback
  try {
    return safeMappedErrorMessage(await resolver(error, event), fallback)
  } catch {
    return fallback
  }
}

function errorEvent(error) {
  const config = error?.config || {}
  const status = Number(error?.response?.status) || Number(error?.status) || 0
  return Object.freeze({
    code: classifyAxiosError(error),
    status,
    method: String(config.method || error?.method || 'GET').toUpperCase(),
    path: config[SAFE_PATH] || error?.path || '/'
  })
}

function safeErrorHeaders(headers) {
  if (!headers || typeof headers !== 'object') return {}
  const source = typeof headers.toJSON === 'function' ? headers.toJSON() : headers
  return Object.fromEntries(Object.entries(source).filter(([name]) => (
    SAFE_ERROR_HEADER_NAMES.has(name.toLowerCase())
  )))
}

function sanitizeRejectedAxiosError(error, event) {
  if (!error || typeof error !== 'object') return
  const originalConfig = error.config || {}
  const safeConfig = {
    method: String(originalConfig.method || event.method).toLowerCase(),
    url: event.path,
    headers: safeErrorHeaders(originalConfig.headers)
  }
  const timeout = Number(originalConfig.timeout)
  if (Number.isFinite(timeout) && timeout > 0) safeConfig.timeout = timeout

  const message = safeAxiosErrorMessage(error)
  try { error.message = message } catch {}
  try {
    if (typeof error.stack === 'string') {
      const lines = error.stack.split('\n')
      error.stack = [`${error.name || 'Error'}: ${message}`, ...lines.slice(1)].join('\n')
    }
  } catch {}
  try { error.config = safeConfig } catch {}
  try { error.request = undefined } catch {}
  try { error.cause = undefined } catch {}
  try {
    if (error.response && typeof error.response === 'object') {
      error.response.config = safeConfig
      error.response.request = undefined
    }
  } catch {}
}

async function callSafely(callback, ...args) {
  try {
    await callback(...args)
  } catch {}
}

async function resolveDecision(callback, fallback, ...args) {
  try {
    return (await callback(...args)) !== false
  } catch {
    return fallback
  }
}

export function createPlatformAxiosClient({
  axios,
  enterpriseConfig = getEnterpriseConfig(globalThis),
  service = 'api',
  locationOrigin = globalThis.location?.origin || '',
  getAccessToken = () => '',
  onUnauthorized = () => {},
  notifyError = () => {},
  shouldNotifyError = () => true,
  shouldHandleUnauthorized = () => true,
  resolveErrorMessage,
  defaultProfile = '',
  defaultAccept = '',
  timeoutMs = DEFAULT_AXIOS_TIMEOUT_MS,
  unauthorizedMessage = '登录已过期，请重新登录'
} = {}) {
  if (!axios || typeof axios.create !== 'function') {
    throw new TypeError('An Axios-compatible create function is required')
  }

  const client = axios.create({ timeout: normalizeTimeout(timeoutMs) })

  client.interceptors.request.use(async (config) => {
    const normalized = normalizePlatformAxiosTarget(config.url, {
      enterpriseConfig,
      service,
      locationOrigin
    })
    config.url = normalized.url
    config[SAFE_PATH] = safeResourcePath(normalized.resourceTarget)
    const requestContext = Object.freeze({
      path: config[SAFE_PATH],
      service: normalized.service
    })
    config[REQUEST_CONTEXT] = requestContext
    if (!config.headers || typeof config.headers !== 'object') config.headers = {}

    let token
    try {
      token = String(await getAccessToken() || '').trim()
    } catch {
      throw new PlatformHttpError('auth-unavailable', {
        method: config.method,
        path: config[SAFE_PATH]
      })
    }
    if (token) setHeader(config.headers, 'Authorization', `Bearer ${token}`)

    const profile = typeof defaultProfile === 'function'
      ? defaultProfile(config, requestContext)
      : defaultProfile
    if (profile && !hasHeader(config.headers, 'Accept-Profile')) {
      setHeader(config.headers, 'Accept-Profile', String(profile))
    }
    if (profile && !hasHeader(config.headers, 'Content-Profile')) {
      setHeader(config.headers, 'Content-Profile', String(profile))
    }
    if (defaultAccept && !hasHeader(config.headers, 'Accept')) {
      setHeader(config.headers, 'Accept', String(defaultAccept))
    }
    return config
  })

  client.interceptors.response.use(
    (response) => response.data,
    async (error) => {
      const event = errorEvent(error)
      const requestConfig = error?.config || {}
      const requestContext = requestConfig[REQUEST_CONTEXT] || Object.freeze({
        path: event.path,
        service: service === 'auto' ? '' : service
      })
      const shouldNotify = await resolveDecision(
        shouldNotifyError,
        true,
        requestConfig,
        requestContext,
        error,
        event
      )
      if (event.status === 401) {
        const shouldHandle = await resolveDecision(
          shouldHandleUnauthorized,
          true,
          requestConfig,
          requestContext,
          error,
          event
        )
        if (shouldHandle) {
          if (shouldNotify) await callSafely(notifyError, unauthorizedMessage, event)
          await callSafely(onUnauthorized, event)
        }
      } else if (shouldNotify) {
        const message = await resolveNotificationMessage(error, event, resolveErrorMessage)
        await callSafely(notifyError, message, event)
      }
      sanitizeRejectedAxiosError(error, event)
      return Promise.reject(error)
    }
  )

  return client
}
