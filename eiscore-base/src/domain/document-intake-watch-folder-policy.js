// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

export const createDocumentIntakeWatchFolderForm = () => ({
  id: '',
  folderPath: '',
  folderName: '',
  defaultUserId: '',
  defaultRole: '',
  enabled: true
})

export const buildDocumentIntakeWatchFolderEditForm = (row = {}) => ({
  id: row?.id || '',
  folderPath: row?.folderPath || '',
  folderName: row?.folderName || '',
  defaultUserId: row?.defaultUserId || '',
  defaultRole: row?.defaultRole || '',
  enabled: row?.enabled !== false
})

export const buildDocumentIntakeWatchFolderPayload = (form) => ({
  folderPath: form.folderPath.trim(),
  folderName: form.folderName.trim(),
  defaultUserId: form.defaultUserId.trim(),
  defaultRole: form.defaultRole.trim(),
  enabled: form.enabled
})

export const planDocumentIntakeWatchFolderSave = (form) => ({
  mode: form.id ? 'update' : 'create',
  recordId: form.id || '',
  payload: buildDocumentIntakeWatchFolderPayload(form)
})

export const planDocumentIntakeWatchFolderStatus = (row) => {
  if (!row?.id) return null
  const nextEnabled = !row.enabled
  return {
    recordId: row.id,
    nextEnabled,
    label: nextEnabled ? '启用' : '停用',
    actionKey: `${row.id}:status`
  }
}

export const planDocumentIntakeWatchFolderDeletion = (row) => {
  if (!row?.id) return null
  return {
    recordId: row.id,
    displayName: row.folderName || row.folderPath || row.id,
    actionKey: `${row.id}:delete`
  }
}
