// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '../..')
const catalog = readFileSync(resolve(root, 'eiscore-hr/src/utils/permission-catalog.js'), 'utf8')
const hrApps = readFileSync(resolve(root, 'eiscore-hr/src/utils/hr-apps.js'), 'utf8')
const migration = readFileSync(resolve(root, 'database/migrations/sql/core-014-static-application-permissions.sql'), 'utf8')

const explicitAppKeys = [...catalog.matchAll(/\{ key: '([^']+)', name: '[^']+', perm: 'app:[^']+'/g)]
  .map(match => match[1])
const hrAppKeys = [...hrApps.matchAll(/aclModule: '([^']+)'/g)].map(match => match[1])
const auxiliary = [...catalog.matchAll(/\[\s*'([^']+)',\s*'[^']+',\s*\[([^\]]+)\]\s*\]/g)]
  .map(match => ({ key: match[1], actions: [...match[2].matchAll(/'([^']+)'/g)].map(item => item[1]) }))
const appKeys = [...new Set([...hrAppKeys, ...explicitAppKeys])]

for (const key of appKeys) {
  assert.match(migration, new RegExp(`'${key}',`), `core-014 missing static app: ${key}`)
}
for (const { key, actions } of auxiliary) {
  assert.match(migration, new RegExp(`'${key}'`), `core-014 missing auxiliary capability: ${key}`)
  assert.match(migration, new RegExp(`'${key}'.*'${actions[0]}'`, 's'))
}

assert.match(migration, /VALUES \('app:' \|\| item\.app_key, '应用-' \|\| item\.app_name, '应用', '进入', 'active'\)/)
assert.match(migration, /item\.app_name \|\| '-' \|\| action_label,\s*item\.app_name, action_label, 'active'/)
assert.match(migration, /IF item\.app_key NOT IN \([\s\S]*'app_center'[\s\S]*'ontology_workbench'[\s\S]*\)/)
assert.doesNotMatch(migration, /IF role_id IS NULL THEN\s*RETURN/)

for (const action of [
  'view', 'create', 'edit', 'delete', 'export', 'config', 'save_layout',
  'member_manage', 'shift_manage', 'shift_create', 'import', 'workflow_transition',
  'stock_in', 'stock_out', 'review', 'pause', 'resume', 'create_order', 'submit',
  'close', 'reopen', 'register_arrival', 'confirm', 'cancel', 'confirm_inbound',
  'mark_exception', 'reverse', 'audit', 'manage'
]) assert.match(migration, new RegExp(`'${action}'`), `core-014 missing action: ${action}`)

for (const label of [
  '查看', '新增', '编辑', '删除', '导入', '导出', '配置', '保存布局', '成员管理',
  '班次管理', '班次新增', '流程流转', '入库', '出库', '审核', '暂停', '恢复',
  '生成订单', '提交', '关闭', '重新打开', '登记到货', '确认', '取消', '确认入库',
  '标记异常', '反向处理', '审计'
]) assert.match(migration, new RegExp(`WHEN '[^']+' THEN '${label}'`), `core-014 missing label: ${label}`)

console.log('PASS: static ACL catalog matches frontend keys, auxiliary scope and Chinese operation labels')
