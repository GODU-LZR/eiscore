// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const policyPath = resolve(repoRoot, 'eiscore-base/src/domain/document-intake-watch-folder-policy.js')
const viewPath = resolve(repoRoot, 'eiscore-base/src/views/DocumentIntakeCenter.vue')
const policySource = readFileSync(policyPath, 'utf8')
const viewSource = readFileSync(viewPath, 'utf8')
const policy = await import(pathToFileURL(policyPath).href)

assert.deepEqual(policy.createDocumentIntakeWatchFolderForm(), {
  id: '', folderPath: '', folderName: '', defaultUserId: '', defaultRole: '', enabled: true
})
assert.notEqual(policy.createDocumentIntakeWatchFolderForm(), policy.createDocumentIntakeWatchFolderForm())
assert.deepEqual(policy.buildDocumentIntakeWatchFolderEditForm({
  id: 'folder-1', folderPath: 'D:/Inbox', folderName: '仓库', defaultUserId: 'user-1', defaultRole: '库管', enabled: false
}), {
  id: 'folder-1', folderPath: 'D:/Inbox', folderName: '仓库', defaultUserId: 'user-1', defaultRole: '库管', enabled: false
})
assert.deepEqual(policy.buildDocumentIntakeWatchFolderEditForm(), policy.createDocumentIntakeWatchFolderForm())
assert.deepEqual(policy.buildDocumentIntakeWatchFolderEditForm(null), policy.createDocumentIntakeWatchFolderForm())

const createPlan = policy.planDocumentIntakeWatchFolderSave({
  id: '', folderPath: ' D:/Inbox ', folderName: ' 仓库 ', defaultUserId: ' user-1 ', defaultRole: ' 库管 ', enabled: true
})
assert.deepEqual(createPlan, {
  mode: 'create',
  recordId: '',
  payload: { folderPath: 'D:/Inbox', folderName: '仓库', defaultUserId: 'user-1', defaultRole: '库管', enabled: true }
})
assert.deepEqual(policy.planDocumentIntakeWatchFolderSave({
  id: 'folder-1', folderPath: ' ', folderName: '', defaultUserId: '', defaultRole: '', enabled: false
}), {
  mode: 'update',
  recordId: 'folder-1',
  payload: { folderPath: '', folderName: '', defaultUserId: '', defaultRole: '', enabled: false }
})

assert.deepEqual(policy.planDocumentIntakeWatchFolderStatus({ id: 'folder-1', enabled: true }), {
  recordId: 'folder-1', nextEnabled: false, label: '停用', actionKey: 'folder-1:status'
})
assert.deepEqual(policy.planDocumentIntakeWatchFolderStatus({ id: 'folder-1', enabled: false }), {
  recordId: 'folder-1', nextEnabled: true, label: '启用', actionKey: 'folder-1:status'
})
assert.equal(policy.planDocumentIntakeWatchFolderStatus(), null)
assert.deepEqual(policy.planDocumentIntakeWatchFolderDeletion({ id: 'folder-1', folderName: '', folderPath: 'D:/Inbox' }), {
  recordId: 'folder-1', displayName: 'D:/Inbox', actionKey: 'folder-1:delete'
})
assert.equal(policy.planDocumentIntakeWatchFolderDeletion({}), null)

assert.doesNotMatch(policySource, /from\s*['"](?:vue|element-plus|@element-plus\/icons-vue)['"]/)
assert.doesNotMatch(policySource, /\b(?:window|navigator|globalThis|document)\s*\./)
assert.doesNotMatch(policySource, /\b(?:localStorage|sessionStorage|XMLHttpRequest)\b|\bfetch\s*\(|\bRequest\s*\(/)
assert.doesNotMatch(policySource, /\bnew\s+Date\b|\bDate\s*\.|\b(?:setTimeout|setInterval)\s*\(/)
assert.ok(viewSource.includes("from '@/domain/document-intake-watch-folder-policy.js'"))
for (const delegate of [
  'reactive(createDocumentIntakeWatchFolderForm())',
  'Object.assign(watchFolderForm, buildDocumentIntakeWatchFolderEditForm(row))',
  'planDocumentIntakeWatchFolderSave(watchFolderForm)',
  'planDocumentIntakeWatchFolderStatus(row)',
  'planDocumentIntakeWatchFolderDeletion(row)'
]) assert.ok(viewSource.includes(delegate), `missing page delegate: ${delegate}`)
assert.ok(viewSource.split(/\r?\n/).length <= 2029, 'DocumentIntakeCenter must not grow beyond its watch-folder-policy baseline')

console.log('PASS: document intake watch folder policy regression')
