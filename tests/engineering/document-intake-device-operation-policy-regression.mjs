// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const repoRoot = resolve(import.meta.dirname, '../..')
const policyPath = resolve(repoRoot, 'eiscore-base/src/domain/document-intake-device-operation-policy.js')
const viewPath = resolve(repoRoot, 'eiscore-base/src/views/DocumentIntakeCenter.vue')
const policySource = readFileSync(policyPath, 'utf8')
const viewSource = readFileSync(viewPath, 'utf8')
const policy = await import(pathToFileURL(policyPath).href)

assert.deepEqual(policy.planDocumentIntakeDeviceStatus({
  id: 'device-1', deviceName: '采集电脑', deviceCode: 'COL-01', status: 'active'
}), {
  deviceId: 'device-1',
  nextStatus: 'disabled',
  label: '停用',
  actionKey: 'device-1:status',
  confirmMessage: '确认停用设备 采集电脑？',
  confirmTitle: '停用设备',
  confirmType: 'warning'
})
assert.deepEqual(policy.planDocumentIntakeDeviceStatus({
  id: 'device-2', deviceCode: 'COL-02', status: 'disabled'
}), {
  deviceId: 'device-2',
  nextStatus: 'active',
  label: '启用',
  actionKey: 'device-2:status',
  confirmMessage: '确认启用设备 COL-02？',
  confirmTitle: '启用设备',
  confirmType: 'info'
})
assert.deepEqual(policy.planDocumentIntakeDeviceStatus({ id: 'device-3', status: 'offline' }), {
  deviceId: 'device-3',
  nextStatus: 'disabled',
  label: '停用',
  actionKey: 'device-3:status',
  confirmMessage: '确认停用设备 device-3？',
  confirmTitle: '停用设备',
  confirmType: 'warning'
})
assert.equal(policy.planDocumentIntakeDeviceStatus(), null)
assert.equal(policy.planDocumentIntakeDeviceStatus({}), null)

assert.deepEqual(policy.planDocumentIntakeDeviceBindingCodeReset({ id: 'device-1', deviceName: '采集电脑' }), {
  deviceId: 'device-1',
  actionKey: 'device-1:reset-code',
  confirmMessage: '确认重置设备 采集电脑 的授权码？旧 token 将失效，需要重新绑定。'
})
assert.deepEqual(policy.planDocumentIntakeDeviceBindingCodeReset({ id: 'device-2', deviceCode: 'COL-02' }), {
  deviceId: 'device-2',
  actionKey: 'device-2:reset-code',
  confirmMessage: '确认重置设备 COL-02 的授权码？旧 token 将失效，需要重新绑定。'
})
assert.equal(policy.planDocumentIntakeDeviceBindingCodeReset(null), null)

assert.doesNotMatch(policySource, /from\s*['"](?:vue|element-plus|@element-plus\/icons-vue)['"]/)
assert.doesNotMatch(policySource, /\b(?:window|navigator|globalThis|document)\s*\./)
assert.doesNotMatch(policySource, /\b(?:localStorage|sessionStorage|XMLHttpRequest)\b|\bfetch\s*\(|\bRequest\s*\(/)
assert.doesNotMatch(policySource, /\bnew\s+Date\b|\bDate\s*\.|\b(?:setTimeout|setInterval)\s*\(/)
assert.ok(viewSource.includes("from '@/domain/document-intake-device-operation-policy.js'"))
for (const delegate of [
  'planDocumentIntakeDeviceStatus(row)',
  'planDocumentIntakeDeviceBindingCodeReset(row)',
  'updateDocumentIntakeDeviceStatus(plan.deviceId, plan.nextStatus)',
  'resetDocumentIntakeDeviceBindingCode(plan.deviceId)'
]) assert.ok(viewSource.includes(delegate), `missing page delegate: ${delegate}`)
assert.ok(viewSource.split(/\r?\n/).length <= 2017, 'DocumentIntakeCenter must not grow beyond its device-operation baseline')

console.log('PASS: document intake device operation policy regression')
