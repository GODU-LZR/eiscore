// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

const getDeviceDisplayName = (row) => row?.deviceName || row?.deviceCode || row?.id || ''

export const planDocumentIntakeDeviceStatus = (row) => {
  if (!row?.id) return null
  const nextStatus = row.status === 'disabled' ? 'active' : 'disabled'
  const label = nextStatus === 'disabled' ? '停用' : '启用'
  return {
    deviceId: row.id,
    nextStatus,
    label,
    actionKey: `${row.id}:status`,
    confirmMessage: `确认${label}设备 ${getDeviceDisplayName(row)}？`,
    confirmTitle: `${label}设备`,
    confirmType: nextStatus === 'disabled' ? 'warning' : 'info'
  }
}

export const planDocumentIntakeDeviceBindingCodeReset = (row) => {
  if (!row?.id) return null
  return {
    deviceId: row.id,
    actionKey: `${row.id}:reset-code`,
    confirmMessage: `确认重置设备 ${getDeviceDisplayName(row)} 的授权码？旧 token 将失效，需要重新绑定。`
  }
}
