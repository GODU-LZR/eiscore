// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createSafeStorage } from './safe-storage.mjs'

export const AUTH_TOKEN_KEY = 'auth_token'
export const USER_INFO_KEY = 'user_info'
export const DEFAULT_MAX_TOKEN_LENGTH = 8192

export function parseStoredToken(raw) {
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.token) {
      return String(parsed.token)
    }
  } catch {
    // Compatibility: installations may store the token as plain text.
  }
  return String(raw)
}

function decodeUtf8(binary) {
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
  if (typeof globalThis.TextDecoder === 'function') {
    return new globalThis.TextDecoder('utf-8', { fatal: true }).decode(bytes)
  }
  let escaped = ''
  for (const byte of bytes) escaped += `%${byte.toString(16).padStart(2, '0')}`
  return decodeURIComponent(escaped)
}

export function parseJwtPayload(token, { atobImpl = globalThis.atob } = {}) {
  try {
    const parts = String(token || '').split('.')
    if (parts.length !== 3 || typeof atobImpl !== 'function') return null
    const payload = parts[1]
    if (!payload || !/^[A-Za-z0-9_-]+$/.test(payload) || payload.length % 4 === 1) return null
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    const parsed = JSON.parse(decodeUtf8(atobImpl(padded)))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function resolveNow(now) {
  const value = typeof now === 'function' ? now() : now
  return Number(value)
}

export function isTokenExpired(token, { now = Date.now, atobImpl = globalThis.atob } = {}) {
  if (!token) return true
  const payload = parseJwtPayload(token, { atobImpl })
  if (!payload || typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) return true
  try {
    const nowMilliseconds = resolveNow(now)
    if (!Number.isFinite(nowMilliseconds)) return true
    return nowMilliseconds / 1000 >= payload.exp
  } catch {
    return true
  }
}

function resolveBrowserStorage(storage) {
  if (storage !== undefined) return storage
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

export function createAuthSession({
  storage,
  atobImpl = globalThis.atob,
  now = Date.now,
  maxTokenLength = DEFAULT_MAX_TOKEN_LENGTH,
  tokenStorageFormat = 'json'
} = {}) {
  const safeStorage = createSafeStorage(resolveBrowserStorage(storage))
  if (tokenStorageFormat !== 'json' && tokenStorageFormat !== 'plain') {
    throw new TypeError('Unsupported auth token storage format')
  }
  const configuredLimit = Number(maxTokenLength)
  const tokenLengthLimit = Number.isSafeInteger(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : DEFAULT_MAX_TOKEN_LENGTH

  function clearAuth() {
    const tokenRemoved = safeStorage.remove(AUTH_TOKEN_KEY)
    const userRemoved = safeStorage.remove(USER_INFO_KEY)
    return tokenRemoved && userRemoved
  }

  function getToken() {
    const token = parseStoredToken(safeStorage.getText(AUTH_TOKEN_KEY))
    if (token && token.length > tokenLengthLimit) {
      clearAuth()
      return ''
    }
    return token
  }

  function getAuthHeader() {
    const token = getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  function setAuth(token, userInfo) {
    if (String(token ?? '').length > tokenLengthLimit) {
      clearAuth()
      return false
    }
    const tokenStored = tokenStorageFormat === 'plain'
      ? safeStorage.setText(AUTH_TOKEN_KEY, token)
      : safeStorage.setJson(AUTH_TOKEN_KEY, { token })
    if (!tokenStored) {
      clearAuth()
      return false
    }
    if (userInfo && !safeStorage.setJson(USER_INFO_KEY, userInfo)) {
      clearAuth()
      return false
    }
    return true
  }

  function getUserInfo() {
    return safeStorage.getJson(USER_INFO_KEY)
  }

  function isAuthenticated() {
    const token = getToken()
    return Boolean(token) && !isTokenExpired(token, { now, atobImpl })
  }

  return Object.freeze({
    getToken,
    getAuthHeader,
    setAuth,
    clearAuth,
    getUserInfo,
    isAuthenticated
  })
}
