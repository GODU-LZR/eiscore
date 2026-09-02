// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const AUTH_TOKEN_KEY = 'auth_token'
const USER_INFO_KEY = 'user_info'

export const parseStoredToken = (raw) => {
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && parsed.token) return String(parsed.token)
  } catch {
    // The legacy storage format is a plain token.
  }
  return String(raw)
}

export const getToken = () => {
  if (typeof localStorage === 'undefined') return ''
  const token = parseStoredToken(localStorage.getItem(AUTH_TOKEN_KEY))
  if (token.length > 32768) {
    clearAuthStorage()
    return ''
  }
  return token
}

export const getUserInfo = () => {
  if (typeof localStorage === 'undefined') return {}
  try {
    const parsed = JSON.parse(localStorage.getItem(USER_INFO_KEY) || '{}')
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export const clearAuthStorage = () => {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(AUTH_TOKEN_KEY)
  localStorage.removeItem(USER_INFO_KEY)
}

export const clearAuthAndRedirect = (loginPath = '/login') => {
  clearAuthStorage()
  if (typeof window !== 'undefined' && window.location.pathname !== loginPath) {
    window.location.href = loginPath
  }
}
