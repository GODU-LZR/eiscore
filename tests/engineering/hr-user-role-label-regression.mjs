// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'acorn'
import { getRoleLabel } from '../../shared/eis-role-labels.mjs'

// Offline synthetic data only; no service requests or user/database changes.
const root = resolve(import.meta.dirname, '../..')
const roles = [
  ['super_admin', 'Super Admin', '超级管理员'],
  ['hr_admin', 'HR Admin', '人事管理员'],
  ['hr_clerk', 'HR Clerk', '人事文员'],
  ['dept_manager', 'Dept Manager', '部门主管'],
  ['employee', 'Employee', '员工']
].map(([code, name, label], index) => ({ code, name, label, id: `synthetic-role-${index}` }))

for (const role of roles) {
  assert.equal(getRoleLabel(role), role.label)
  assert.equal(getRoleLabel({ ...role, name: '' }), role.label)
  assert.equal(getRoleLabel({ ...role, name: '自定义中文岗位' }), '自定义中文岗位')
}
assert.equal(getRoleLabel({ code: 'custom', name: '自定义角色' }), '自定义角色')
assert.equal(getRoleLabel({ code: 'custom', name: 'Custom role' }), 'Custom role')
assert.equal(getRoleLabel({ code: 'custom', name: '' }), 'custom')
assert.equal(getRoleLabel({ code: 'constructor' }), 'constructor')
assert.equal(getRoleLabel({ code: 'toString', name: 'Custom' }), 'Custom')
assert.equal(getRoleLabel(null), '')
assert.equal(getRoleLabel(), '')

function pageScript(path) {
  const source = readFileSync(resolve(root, path), 'utf8').match(/<script setup>([\s\S]*?)<\/script>/)?.[1]
  assert.ok(source)
  return { source, ast: parse(source, { ecmaVersion: 'latest', sourceType: 'module' }) }
}

function compileVariable(script, name, bindings) {
  const node = script.ast.body.flatMap(item => item.declarations || []).find(item => item.id.name === name)?.init
  assert.ok(node, `${name} must exist in the actual page`)
  return Function(...Object.keys(bindings), `return (${script.source.slice(node.start, node.end)})`)(...Object.values(bindings))
}

const userPage = pageScript('eiscore-hr/src/views/HrUserManage.vue')
const roleOptions = { value: [] }
const roleSnapshot = structuredClone(roles)
const loadRoles = compileVariable(userPage, 'loadRoles', {
  getRoleLabel,
  roleOptions,
  request: async (config) => {
    assert.equal(config.url, '/roles?order=sort.asc')
    assert.equal(config.method, 'get')
    return roles
  }
})
await loadRoles()
assert.deepEqual(roleOptions.value, roles.map(role => ({ label: role.label, value: role.id })))
assert.deepEqual(roles, roleSnapshot, 'display translation must not mutate role IDs, codes or names')

const writes = []
let reloads = 0
const handleCreate = compileVariable(userPage, 'handleCreate', {
  roleOptions,
  gridRef: { value: { loadData: () => { reloads += 1 } } },
  ElMessage: { success: () => {}, error: message => assert.fail(message) },
  request: async (config) => {
    writes.push(config)
    return config.url === '/users' ? [{ id: 99 }] : []
  }
})
await handleCreate()
assert.equal(writes[0].url, '/users')
assert.equal(writes[0].data.status, 'created', 'new users must wait for activation before login')
assert.deepEqual(writes[1].data, { user_id: 99, role_id: roles[0].id })
assert.equal(reloads, 1)

const aclPage = pageScript('eiscore-hr/src/views/HrAclView.vue')
assert.equal(compileVariable(aclPage, 'roleLabel', { getRoleLabel })(roles[0]), '超级管理员')
const roleDescMap = compileVariable(aclPage, 'roleDescMap', {})
const columns = compileVariable(aclPage, 'roleColumns', {
  computed: getter => ({ value: getter() }),
  getRoleLabel,
  roleDescMap
}).value
const nameColumn = columns.find(column => column.prop === 'name')
const descriptionColumn = columns.find(column => column.prop === 'description')
assert.equal(nameColumn.formatter({ data: roles[1], value: roles[1].name }), '人事管理员')
assert.equal(nameColumn.formatter({ data: roles[1], value: '定制人事经理' }), '定制人事经理')
assert.equal(nameColumn.valueGetter({ data: roles[0] }), '超级管理员', 'built-in role edit value must use its Chinese label')
assert.equal(nameColumn.valueGetter({ data: roles[1] }), '人事管理员', 'all built-in role edit values must use Chinese labels')
const editedRole = { ...roles[0] }
assert.equal(nameColumn.valueSetter({ data: editedRole, newValue: '超级管理员' }), true)
assert.equal(editedRole.name, '超级管理员', 'editing a role must persist the Chinese value shown by the editor')
assert.equal(nameColumn.valueSetter({ data: editedRole, newValue: '超级管理员' }), false)
assert.equal(nameColumn.editable, true)
const roleWithEnglishDescription = { ...roles[0], description: 'All permissions' }
assert.equal(descriptionColumn.formatter({ data: roleWithEnglishDescription, value: 'All permissions' }), '拥有全部权限')
assert.equal(descriptionColumn.valueGetter({ data: roleWithEnglishDescription }), '拥有全部权限', 'built-in role edit values must use Chinese descriptions')
assert.equal(descriptionColumn.valueGetter({ data: { ...roles[1], description: 'HR full access' } }), '人事模块全权限')
const editedDescription = { ...roleWithEnglishDescription }
assert.equal(descriptionColumn.valueSetter({ data: editedDescription, newValue: '拥有全部权限' }), true)
assert.equal(editedDescription.description, '拥有全部权限')
assert.equal(descriptionColumn.valueSetter({ data: { code: 'custom', description: '自定义说明' }, newValue: '自定义说明' }), false)

console.log('HR role label regression passed: 5 built-in roles, custom names, stable IDs/codes, both page consumers, created status.')
