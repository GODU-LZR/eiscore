// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { getUserInfo } from '@/utils/auth'

export const getPermissions = () => {
  try {
    const info = getUserInfo() || {}
    return Array.isArray(info?.permissions) ? info.permissions : []
  } catch {
    return []
  }
}

export const hasPerm = (perm) => {
  if (!perm) return true
  try {
    const info = getUserInfo() || {}
    const role = info?.app_role || info?.appRole || info?.role
    if (role === 'super_admin') return true
  } catch {
    // ignore
  }
  return getPermissions().includes(perm)
}

