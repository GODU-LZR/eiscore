// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import {
  createAuthSession,
  isTokenExpired as platformIsTokenExpired,
  parseJwtPayload as platformParseJwtPayload,
  parseStoredToken
} from '@eiscore/platform/auth-session'

const authSession = createAuthSession({ tokenStorageFormat: 'plain' })

export { parseStoredToken }

export const getToken = () => authSession.getToken()

export const getAuthHeader = () => authSession.getAuthHeader()

export const setAuth = (token, userInfo) => authSession.setAuth(token, userInfo)

export const getUserInfo = () => authSession.getUserInfo()

export const parseJwtPayload = (token) => platformParseJwtPayload(token)

export const isTokenExpired = (token) => platformIsTokenExpired(token)

export const clearAuthStorage = () => authSession.clearAuth()

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
