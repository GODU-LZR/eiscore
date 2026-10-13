// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const roleNameMap = {
  super_admin: '超级管理员',
  hr_admin: '人事管理员',
  hr_clerk: '人事文员',
  dept_manager: '部门主管',
  employee: '员工'
}

export function getRoleLabel(role) {
  const name = String(role?.name || '').trim()
  const code = String(role?.code || '').trim()
  if (/\p{Script=Han}/u.test(name)) return name
  return (Object.hasOwn(roleNameMap, code) ? roleNameMap[code] : '') || name || code
}
