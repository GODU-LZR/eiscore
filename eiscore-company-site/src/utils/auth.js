// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createAuthSession, parseStoredToken } from '@eiscore/platform/auth-session'
import { navigateEnterprisePath } from '@eiscore/platform/navigation'

const authSession = createAuthSession({ maxTokenLength: 32768 })

export { parseStoredToken }

export const getToken = () => authSession.getToken()

export const getUserInfo = () => authSession.getUserInfo() || {}

export const clearAuthStorage = () => authSession.clearAuth()

export const clearAuthAndRedirect = (loginPath = '/login') => {
  clearAuthStorage()
  if (typeof window !== 'undefined' && window.location.pathname !== loginPath) {
    navigateEnterprisePath(loginPath, { hosted: false })
  }
}
