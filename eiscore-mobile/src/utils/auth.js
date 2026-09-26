// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

/**
 * 移动端鉴权适配器。
 * Token 与用户信息格式由平台会话契约统一，移动端只保留页面跳转策略。
 */

import {
  createAuthSession,
  isTokenExpired as platformIsTokenExpired,
  parseJwtPayload
} from '@eiscore/platform/auth-session'

const authSession = createAuthSession()

/** 解析 JWT payload（纯前端，不做签名校验） */
export const parseJwt = (token) => parseJwtPayload(token)

/** 从浏览器安全存储读取实际 token 字符串 */
export const getToken = () => authSession.getToken()

/** token 是否已过期 */
export const isTokenExpired = (token) => platformIsTokenExpired(token)

/** 保存鉴权信息（与基座保持格式一致） */
export const setAuth = (token, userInfo) => authSession.setAuth(token, userInfo)

/** 清除鉴权信息 */
export const clearAuth = () => authSession.clearAuth()

/** 获取已登录的用户信息 */
export const getUserInfo = () => authSession.getUserInfo()

/** 检查当前是否已登录（token 存在且未过期） */
export const isAuthenticated = () => authSession.isAuthenticated()

export const buildEnterpriseLoginUrl = (redirect = '') => {
  const url = new URL('/login', window.location.origin)
  url.searchParams.set('login', '1')
  const target = String(redirect || `${window.location.pathname}${window.location.search}${window.location.hash}`)
  if (target && target !== '/login') url.searchParams.set('redirect', target)
  return `${url.pathname}${url.search}${url.hash}`
}

export const redirectToEnterpriseLogin = (redirect = '') => {
  window.location.assign(buildEnterpriseLoginUrl(redirect))
}

/** 带 Authorization 的 fetch 兼容封装 */
export async function authFetch(url, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  const res = await fetch(url, { ...options, headers })
  if (res.status === 401) {
    clearAuth()
    redirectToEnterpriseLogin()
  }
  return res
}
