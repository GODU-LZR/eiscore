// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import {
  createAuthSession,
  parseJwtPayload
} from '@eiscore/platform/auth-session'

const LOGIN_ENDPOINT = '/api/rpc/login'
const GENERIC_LOGIN_ERROR = '登录失败，请检查账号和密码后重试。'

function asJson(response) {
  return response.json().catch(() => ({}))
}

function getPayloadValue(payload, data, key, fallback = '') {
  return data?.[key] ?? payload?.[key] ?? fallback
}

function createUserInfo(token, payload, data, profile = {}) {
  const permissions = Array.isArray(data?.permissions)
    ? data.permissions
    : (Array.isArray(payload?.permissions) ? payload.permissions : [])
  const username = String(payload?.username || data?.username || profile?.username || '')
  const appRole = getPayloadValue(payload, data, 'app_role', 'user')
  const roleId = profile?.role_id || profile?.roleId || ''
  const sopRole = profile?.sop_role || profile?.sopRole || getPayloadValue(payload, data, 'sop_role', '')

  return {
    token,
    user: {
      id: username,
      name: profile?.full_name || profile?.name || username,
      username,
      role: appRole,
      role_id: roleId,
      dbRole: payload?.role || 'web_user',
      permissions,
      avatar: profile?.avatar || payload?.avatar || '',
      sop_role: sopRole,
      sopRole
    }
  }
}

async function loadUserProfile({ token, payload, data, fetchImpl }) {
  const username = String(payload?.username || data?.username || '').trim()
  if (!username) return {}

  const encodedUsername = encodeURIComponent(username)
  const headers = {
    Accept: 'application/json',
    'Accept-Profile': 'public',
    'Content-Profile': 'public',
    Authorization: `Bearer ${token}`
  }
  const endpoints = [
    `/api/v_users_manage?username=eq.${encodedUsername}&select=username,full_name,avatar,role_id,sop_role`,
    `/api/v_users_manage?username=eq.${encodedUsername}&select=username,full_name,avatar,role_id`,
    `/api/users?username=eq.${encodedUsername}&select=username,full_name,avatar,role,sop_role`,
    `/api/users?username=eq.${encodedUsername}&select=username,full_name,avatar,role`
  ]

  for (const endpoint of endpoints) {
    try {
      const response = await fetchImpl(endpoint, { headers })
      if (!response.ok) continue
      const rows = await asJson(response)
      const profile = Array.isArray(rows) ? rows[0] : null
      if (profile) return profile
    } catch {
      // Profile enrichment is optional; the JWT identity remains sufficient to enter the app.
    }
  }
  return {}
}

export async function authenticateHuizhong({
  username,
  password,
  enabled = import.meta.env?.VITE_HUIZHONG_AUTH_ENABLED !== 'false',
  fetchImpl = globalThis.fetch,
  storage
} = {}) {
  if (!enabled) throw new Error('系统维护中，暂时无法登录。')
  const cleanUsername = String(username || '').trim()
  const cleanPassword = String(password || '')
  if (!cleanUsername || !cleanPassword) {
    throw new Error('请输入账号和密码。')
  }
  if (typeof fetchImpl !== 'function') {
    throw new Error('当前浏览器不支持登录请求。')
  }

  let response
  try {
    response = await fetchImpl(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ username: cleanUsername, password: cleanPassword })
    })
  } catch {
    throw new Error('暂时无法连接认证服务，请稍后重试。')
  }

  const data = await asJson(response)
  if (!response.ok) {
    throw new Error(String(data?.message || data?.error || GENERIC_LOGIN_ERROR))
  }

  const token = typeof data?.token === 'string' ? data.token : ''
  if (!token) throw new Error('认证服务未返回有效会话。')

  const payload = parseJwtPayload(token) || {}
  const profile = await loadUserProfile({ token, payload, data, fetchImpl })
  const userInfo = createUserInfo(token, payload, data, profile)
  const session = createAuthSession({ storage, tokenStorageFormat: 'plain' })
  if (!session.setAuth(token, userInfo.user)) {
    throw new Error('登录会话保存失败，请重试。')
  }

  return { token, userInfo }
}

export { GENERIC_LOGIN_ERROR, LOGIN_ENDPOINT, createUserInfo }
