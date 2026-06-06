// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const getPermissions = () => {
  try {
    const raw = localStorage.getItem('user_info')
    const info = raw ? JSON.parse(raw) : {}
    return Array.isArray(info?.permissions) ? info.permissions : []
  } catch {
    return []
  }
}

export const hasPerm = (perm) => {
  if (!perm) return true
  try {
    const raw = localStorage.getItem('user_info')
    const info = raw ? JSON.parse(raw) : {}
    const role = info?.app_role || info?.appRole || info?.role
    if (role === 'super_admin') return true
  } catch {
    // ignore
  }
  return getPermissions().includes(perm)
}

