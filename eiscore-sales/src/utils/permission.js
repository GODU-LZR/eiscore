// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const getPermissions = () => {
  try {
    const raw = localStorage.getItem('user_info')
    const info = raw ? JSON.parse(raw) : {}
    const perms = info?.permissions
    return Array.isArray(perms) ? perms : []
  } catch (e) {
    return []
  }
}

const getRole = () => {
  try {
    const raw = localStorage.getItem('user_info')
    const info = raw ? JSON.parse(raw) : {}
    return info?.app_role || info?.appRole || info?.role || ''
  } catch (e) {
    return ''
  }
}

export const hasPerm = (perm) => {
  if (!perm) return true
  const perms = getPermissions()
  const role = getRole()
  if (role === 'super_admin') return true
  if (perms.includes('module:sales') && (perm.startsWith('app:sales_') || perm.startsWith('op:sales_'))) return true
  if (role === 'sales_manager' && (perm === 'module:sales' || perm.startsWith('app:sales_') || perm.startsWith('op:sales_'))) return true
  return perms.includes(perm)
}

export const hasAnyPerm = (permList = []) => {
  if (!permList || permList.length === 0) return true
  const role = getRole()
  const perms = getPermissions()
  if (role === 'super_admin') return true
  if (perms.includes('module:sales') && permList.some((perm) => perm.startsWith('app:sales_') || perm.startsWith('op:sales_'))) return true
  if (role === 'sales_manager' && permList.some((perm) => perm === 'module:sales' || perm.startsWith('app:sales_') || perm.startsWith('op:sales_'))) return true
  return permList.some((perm) => perms.includes(perm))
}

export const hasAllPerm = (permList = []) => {
  if (!permList || permList.length === 0) return true
  const role = getRole()
  const perms = getPermissions()
  if (role === 'super_admin') return true
  if (perms.includes('module:sales') && permList.every((perm) => perm.startsWith('app:sales_') || perm.startsWith('op:sales_'))) return true
  if (role === 'sales_manager' && permList.every((perm) => perm === 'module:sales' || perm.startsWith('app:sales_') || perm.startsWith('op:sales_'))) return true
  return permList.every((perm) => perms.includes(perm))
}
