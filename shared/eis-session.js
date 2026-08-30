// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createAuthSession } from '../packages/eiscore-platform/src/auth-session.mjs'

const authSession = createAuthSession()

export const getToken = () => authSession.getToken()

export const getUserInfo = () => authSession.getUserInfo()

export const clearAuthStorage = () => authSession.clearAuth()

export const clearAuthAndRedirect = (loginPath = '/login') => {
  clearAuthStorage()
  if (typeof window !== 'undefined' && window.location.pathname !== loginPath) {
    window.location.href = loginPath
  }
}
