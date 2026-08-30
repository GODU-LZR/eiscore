// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { getUserInfo } from '@/utils/auth'

const readUserInfo = () => getUserInfo() || {}

export const getPermissions = () => {
  const perms = readUserInfo()?.permissions
  return Array.isArray(perms) ? perms : []
}

export const hasPerm = (perm) => {
  if (!perm) return true
  const info = readUserInfo()
  const role = info?.app_role || info?.appRole || info?.role
  if (role === 'super_admin') return true
  return getPermissions().includes(perm)
}

export const hasAnyPerm = (permList = []) => {
  if (!permList || permList.length === 0) return true
  const info = readUserInfo()
  const role = info?.app_role || info?.appRole || info?.role
  if (role === 'super_admin') return true
  const perms = getPermissions()
  return permList.some((perm) => perms.includes(perm))
}
