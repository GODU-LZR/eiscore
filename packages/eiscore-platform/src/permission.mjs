// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const SAFE_IDENTIFIER = /^[a-z][a-z0-9_-]*$/

function validateIdentifier(value, name) {
  const normalized = String(value || '')
  if (normalized && !SAFE_IDENTIFIER.test(normalized)) {
    throw new TypeError(`${name} must be a safe identifier`)
  }
  return normalized
}

export function createPermissionService({
  getUserInfo,
  moduleId = '',
  managerRole = '',
  catchReadErrors = true
} = {}) {
  if (typeof getUserInfo !== 'function') {
    throw new TypeError('getUserInfo must be a function')
  }

  const safeModuleId = validateIdentifier(moduleId, 'moduleId')
  const safeManagerRole = validateIdentifier(managerRole, 'managerRole')
  if (safeManagerRole && !safeModuleId) {
    throw new TypeError('managerRole requires moduleId')
  }
  const modulePermission = safeModuleId ? `module:${safeModuleId}` : ''
  const appPermissionPrefix = safeModuleId ? `app:${safeModuleId}_` : ''
  const operationPermissionPrefix = safeModuleId ? `op:${safeModuleId}_` : ''

  const readUserInfo = () => {
    if (!catchReadErrors) return getUserInfo() || {}
    try {
      return getUserInfo() || {}
    } catch {
      return {}
    }
  }

  const getPermissions = () => {
    const permissions = readUserInfo()?.permissions
    return Array.isArray(permissions) ? permissions : []
  }

  const getRole = () => {
    const userInfo = readUserInfo()
    return userInfo?.app_role || userInfo?.appRole || userInfo?.role || ''
  }

  const isModuleActionPermission = (permission) => (
    permission.startsWith(appPermissionPrefix) || permission.startsWith(operationPermissionPrefix)
  )

  const isManagerPermission = (permission) => (
    permission === modulePermission || isModuleActionPermission(permission)
  )

  const hasPerm = (permission) => {
    if (!permission) return true

    if (safeModuleId) {
      const permissions = getPermissions()
      const role = getRole()
      if (role === 'super_admin') return true
      if (permissions.includes(modulePermission) && isModuleActionPermission(permission)) return true
      if (safeManagerRole && role === safeManagerRole && isManagerPermission(permission)) return true
      return permissions.includes(permission)
    }

    if (getRole() === 'super_admin') return true
    return getPermissions().includes(permission)
  }

  const hasAnyPerm = (permissionList = []) => {
    if (!permissionList || permissionList.length === 0) return true
    const role = getRole()
    const permissions = getPermissions()
    if (role === 'super_admin') return true
    if (safeModuleId && permissions.includes(modulePermission) && permissionList.some(isModuleActionPermission)) return true
    if (safeManagerRole && role === safeManagerRole && permissionList.some(isManagerPermission)) return true
    return permissionList.some((permission) => permissions.includes(permission))
  }

  const hasAllPerm = (permissionList = []) => {
    if (!permissionList || permissionList.length === 0) return true
    const role = getRole()
    const permissions = getPermissions()
    if (role === 'super_admin') return true
    if (safeModuleId && permissions.includes(modulePermission) && permissionList.every(isModuleActionPermission)) return true
    if (safeManagerRole && role === safeManagerRole && permissionList.every(isManagerPermission)) return true
    return permissionList.every((permission) => permissions.includes(permission))
  }

  return Object.freeze({ getPermissions, hasPerm, hasAnyPerm, hasAllPerm })
}
