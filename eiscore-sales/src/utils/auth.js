// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const AUTH_TOKEN_KEY = 'auth_token'
const USER_INFO_KEY = 'user_info'

export const parseStoredToken = (raw) => {
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.token) {
      return String(parsed.token)
    }
  } catch {
    // fallback to plain token
  }
  return String(raw)
}

export const getToken = () => {
  if (typeof localStorage === 'undefined') return ''
  const token = parseStoredToken(localStorage.getItem(AUTH_TOKEN_KEY))
  if (token && token.length > 8192) {
    clearAuthStorage()
    return ''
  }
  return token
}

export const getAuthHeader = () => {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export const parseJwtPayload = (token) => {
  try {
    const parts = String(token || '').split('.')
    if (parts.length !== 3) return null
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    return JSON.parse(atob(padded))
  } catch {
    return null
  }
}

export const isTokenExpired = (token) => {
  if (!token) return true
  const payload = parseJwtPayload(token)
  if (!payload || typeof payload.exp !== 'number') return true
  return Date.now() / 1000 >= payload.exp
}

export const clearAuthStorage = () => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(USER_INFO_KEY)
  } catch {
    // ignore storage errors
  }
}

export const redirectToLogin = (loginPath = '/login') => {
  if (typeof window === 'undefined') return
  if (window.location.pathname !== loginPath) {
    window.location.href = loginPath
  }
}

export const clearAuthAndRedirect = (loginPath = '/login') => {
  clearAuthStorage()
  redirectToLogin(loginPath)
}
