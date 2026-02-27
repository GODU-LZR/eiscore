/**
 * 移动端鉴权工具
 * 与基座共用同一套 JWT Token / PostgREST 接口
 */

const TOKEN_KEY = 'auth_token'
const USER_KEY = 'user_info'

/** 解析 JWT payload（纯前端，不做签名校验） */
export function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      window
        .atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )
    return JSON.parse(jsonPayload)
  } catch {
    return null
  }
}

/** 从 localStorage 读取实际 token 字符串 */
export function getToken() {
  const raw = localStorage.getItem(TOKEN_KEY)
  if (!raw) return ''
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.token) return parsed.token
  } catch {
    // ignore
  }
  return raw
}

/** token 是否已过期 */
export function isTokenExpired(token) {
  if (!token) return true
  const payload = parseJwt(token)
  if (!payload || typeof payload.exp !== 'number') return true
  return Date.now() / 1000 >= payload.exp
}

/** 保存鉴权信息（与基座保持格式一致） */
export function setAuth(token, userInfo) {
  localStorage.setItem(TOKEN_KEY, JSON.stringify({ token }))
  if (userInfo) {
    localStorage.setItem(USER_KEY, JSON.stringify(userInfo))
  }
}

/** 清除鉴权信息 */
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

/** 获取已登录的用户信息 */
export function getUserInfo() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

/** 检查当前是否已登录（token 存在且未过期） */
export function isAuthenticated() {
  const token = getToken()
  return !!token && !isTokenExpired(token)
}

/** 带 Authorization 的 fetch 封装 */
export async function authFetch(url, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(url, { ...options, headers })
  if (res.status === 401) {
    clearAuth()
    window.location.href = '/mobile/login'
  }
  return res
}
