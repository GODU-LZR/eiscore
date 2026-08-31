// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import { createPermissionService } from '@eiscore/platform/permission'
import { getUserInfo } from '@/utils/auth'

const permissionService = createPermissionService({
  getUserInfo,
  moduleId: 'purchase',
  managerRole: 'purchase_manager'
})

export const getPermissions = permissionService.getPermissions
export const hasPerm = permissionService.hasPerm
export const hasAnyPerm = permissionService.hasAnyPerm
export const hasAllPerm = permissionService.hasAllPerm
