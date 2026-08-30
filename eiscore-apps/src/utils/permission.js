// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { getUserInfo } from '@/utils/auth'

export const getPermissions = () => {
  try {
    const info = getUserInfo() || {}
    const perms = info?.permissions
    return Array.isArray(perms) ? perms : []
  } catch (e) {
    return []
  }
}

export const hasPerm = (perm) => {
  if (!perm) return true
  try {
    const info = getUserInfo() || {}
    const role = info?.app_role || info?.appRole || info?.role
    if (role === 'super_admin') return true
  } catch (e) {
    // ignore
  }
  return getPermissions().includes(perm)
}

export const hasAnyPerm = (permList = []) => {
  if (!permList || permList.length === 0) return true
  try {
    const info = getUserInfo() || {}
    const role = info?.app_role || info?.appRole || info?.role
    if (role === 'super_admin') return true
  } catch (e) {
    // ignore
  }
  const perms = getPermissions()
  return permList.some((perm) => perms.includes(perm))
}
