// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'acorn'

// Offline source contract only. No browser, HTTP, database, or running service.
const root = resolve(import.meta.dirname, '../..')
const source = readFileSync(resolve(root, 'eiscore-hr/src/views/HrAclView.vue'), 'utf8')
const permissionSpec = readFileSync(resolve(root, 'eiscore-hr/src/utils/permission-spec.js'), 'utf8')
const layout = readFileSync(resolve(root, 'eiscore-base/src/layout/index.vue'), 'utf8')

const expectedModules = {
  home: '工作台', mms: '仓储管理', hr: '人事管理', app: '应用中心',
  'company-site': '企业站点运营', sales: '销售管理', purchase: '采购管理',
  production: '生产管理', quality: '质量管理', equipment: '设备管理', decision: '决策支持'
}
const staleModuleCodes = ['module:materials', 'module:apps', 'module:company_site', 'module:bi']
const specAst = parse(permissionSpec, { ecmaVersion: 'latest', sourceType: 'module' })
const moduleLabelsNode = specAst.body
  .find(item => item.type === 'ExportNamedDeclaration' && item.declaration?.declarations?.some(declaration => declaration.id.name === 'MODULE_LABELS'))
  ?.declaration.declarations.find(declaration => declaration.id.name === 'MODULE_LABELS').init
assert.ok(moduleLabelsNode)
const moduleLabels = Object.fromEntries(moduleLabelsNode.properties.map(({ key, value }) => [
  key.type === 'Identifier' ? key.name : key.value,
  value.value
]))
for (const [key, label] of Object.entries(expectedModules)) {
  assert.ok(moduleLabels[key], `module permission label catalog must include ${key}`)
}

assert.match(source, /const isAclVisibleApp = \(app\) => String\(app\?\.status \|\| ''\)\.toLowerCase\(\) !== 'archived'/)
assert.match(source, /\.filter\(isAclVisibleApp\)\s*\n\s*\.map\(resolveAppModuleKey\)/)
assert.doesNotMatch(source, /app\?\.app_type !== 'data'/)
assert.doesNotMatch(source, /app\?\.app_type === 'data'/)
assert.doesNotMatch(source, /Object\.entries\(\{[\s\S]*?view:/)
assert.match(source, /\{ label: '流程发起', value: 'workflow_start' \}/)
assert.match(source, /if \(value\.startsWith\('status_transition\.'\)\) return '状态变更'/)
assert.match(source, /const staticAclKeys = computed\(\(\) =>/)
assert.match(source, /dynamicAclKeys = computed\(\(\) => Array\.from\(new Set\(\[/)
assert.match(source, /buildAclKeyOrFilter\(key => `code\.eq\.app:/)
assert.match(source, /buildAclKeyOrFilter\(key => `code\.like\.op:/)
assert.match(source, /buildAclKeyOrFilter\(key => `module\.eq\./)
assert.match(source, /status: 'created'/)
assert.match(source, /write-url="\/v_roles_manage"\s+write-mode="patch"/)
assert.match(source, /:show-status-col="false"/)
assert.match(source, /activeTab\.value === 'field' && !fieldModule\.value && !fieldModuleGroup\.value/)
assert.match(source, /const dedupePermissionPayload = \(items\) => \{/)
assert.match(source, /const uniquePayload = dedupePermissionPayload\(payload\)/)
assert.match(source, /data: \{ payload: uniquePayload \}/)
assert.match(source, /buildStaticPermissionPayload\(\)\.map\(\(item\) => \(\{[\s\S]*roles: \['super_admin'\]/)
assert.match(source, /data: \{ payload: buildModulePermissionPayload\(\) \}/)
assert.match(source, /permsModuleGridRef\.value\?\.loadData\(\)/)

const aclScript = source.match(/<script setup>([\s\S]*?)<\/script>/)?.[1]
assert.ok(aclScript)
const aclAst = parse(aclScript, { ecmaVersion: 'latest', sourceType: 'module' })
const modulePayloadNode = aclAst.body.flatMap(item => item.declarations || [])
  .find(item => item.id.name === 'buildModulePermissionPayload')?.init
assert.ok(modulePayloadNode)
const sidebarKeys = Object.keys(expectedModules)
const sidebarLabels = expectedModules
const buildModulePermissionPayload = Function('SIDEBAR_MODULE_KEYS', 'SIDEBAR_MODULE_LABELS', 'MODULE_LABELS', `return (${aclScript.slice(modulePayloadNode.start, modulePayloadNode.end)})`)(sidebarKeys, sidebarLabels, moduleLabels)
const modulePayload = buildModulePermissionPayload()
assert.deepEqual(modulePayload.map(({ code, name, module, action }) => [code, name, module, action]),
  Object.entries(expectedModules).map(([key, label]) => [`module:${key}`, `模块-${label}`, '模块', '显示']))
assert.equal(new Set(modulePayload.map(item => item.code)).size, modulePayload.length)
assert.equal(new Set(modulePayload.map(item => item.name)).size, modulePayload.length)
for (const stale of staleModuleCodes) assert.equal(modulePayload.some(item => item.code === stale), false, `stale module must not be seeded: ${stale}`)
assert.ok(modulePayload.every(item => item.action === '显示' && item.roles.includes('super_admin')))

assert.match(source, /const moduleFilters = computed\(\(\) => SIDEBAR_MODULE_KEYS\.map\(/)
assert.match(source, /SIDEBAR_MODULE_LABELS\[value\] \|\| MODULE_LABELS\[value\]/)

const sidebarPermissionMap = {
  canHome: 'module:home', canMms: 'module:mms', canHr: 'module:hr', canApps: 'module:app',
  canCompanySite: 'module:company-site', canSales: 'module:sales', canPurchase: 'module:purchase',
  canProduction: 'module:production', canQuality: 'module:quality', canEquipment: 'module:equipment',
  canDecision: 'module:decision'
}
for (const [name, code] of Object.entries(sidebarPermissionMap)) {
  const block = layout.match(new RegExp(`const ${name} = computed\\(\\(\\) =>([\\s\\S]*?)\\n\\)`))?.[1] || ''
  if (name === 'canDecision') {
    assert.match(layout, /const decisionPermissionKeys = \['decision',/)
  } else if (name === 'canApps') {
    assert.match(block, /module:app/)
  } else if (name === 'canCompanySite') {
    assert.match(block, /module:company-site/)
  } else {
    assert.match(block, new RegExp(code.replace(':', ':')))
  }
}

const script = source.match(/<script setup>([\s\S]*?)<\/script>/)?.[1]
assert.ok(script)
const ast = parse(script, { ecmaVersion: 'latest', sourceType: 'module' })
const declaration = ast.body.flatMap(item => item.declarations || [])
  .find(item => item.id.name === 'dedupePermissionPayload')
assert.ok(declaration)
const dedupePermissionPayload = Function(`return (${script.slice(declaration.init.start, declaration.init.end)})`)()
const duplicatePayload = [
  { code: 'app:chain_test', name: '本地验收工作流' },
  { code: 'op:chain_test.view', name: '本地验收工作流-查看' },
  { code: 'app:chain_test', name: '__eiscore_ui_chain' },
  { code: 'op:chain_test.view', name: '__eiscore_ui_chain-查看' }
]
assert.deepEqual(dedupePermissionPayload(duplicatePayload), duplicatePayload.slice(2),
  'duplicate permission codes must be reduced to the last module definition')
assert.deepEqual(dedupePermissionPayload([{ code: '' }, { name: 'missing code' }]), [])

console.log('PASS: ACL frontend keeps non-archived app types and stable action codes with Chinese labels')
