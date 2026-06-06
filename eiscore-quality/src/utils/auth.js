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

export const clearAuthStorage = () => {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY)
    localStorage.removeItem(USER_INFO_KEY)
  } catch {
    // ignore storage errors
  }
}

export const clearAuthAndRedirect = (loginPath = '/login') => {
  clearAuthStorage()
  if (typeof window !== 'undefined' && window.location.pathname !== loginPath) {
    window.location.href = loginPath
  }
}

