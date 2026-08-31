// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DEFAULT_ENTERPRISE_CONFIG } from '../../packages/eiscore-platform/src/enterprise-config.mjs'
import { planEnterpriseNavigation } from '../../packages/eiscore-platform/src/navigation.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const readSource = (path) => readFileSync(resolve(repoRoot, path), 'utf8')

const consumers = new Map([
  ['eiscore-base/src/views/DocumentIntakeCenter.vue', [
    '/materials/material/detail/',
    '/purchase/document/',
    '/production/app/',
    '/quality/app/',
    '/sales/app/'
  ]],
  ['eiscore-decision/src/views/DecisionHome.vue', [
    '/production/overview',
    '/quality/dashboard',
    '/equipment/dashboard'
  ]],
  ['eiscore-mobile/src/views/pda/PdaEntry.vue', [
    '/materials/inventory-check/warehouse/'
  ]],
  ['eiscore-production/src/components/ProductionAppGrid.vue', [
    '/quality/app/production_inspections',
    '/materials/inventory-stock-in?ioType=生产入库',
    '/materials/inventory-stock-out?ioType=生产领料'
  ]],
  ['eiscore-purchase/src/components/PurchaseAppGrid.vue', [
    '/materials/inventory-stock-in'
  ]]
])

for (const [path, expectedTargets] of consumers) {
  const source = readSource(path)
  assert.match(source, /from\s+['"]@eiscore\/platform\/navigation['"]/, path)
  assert.match(source, /navigateEnterprisePath\(/, path)
  assert.doesNotMatch(source, /window\.location\.href\s*=/, path)
  for (const target of expectedTargets) assert.ok(source.includes(target), `${path}: ${target}`)
}

const decisionSource = readSource('eiscore-decision/src/views/DecisionHome.vue')
assert.doesNotMatch(decisionSource, /qiankunWindow|window\.postMessage|eis:open-host-tab/)
assert.match(decisionSource, /tabKey:\s*card\.route/)
assert.match(decisionSource, /tabTitle:\s*card\.title/)

const productionSource = readSource('eiscore-production/src/components/ProductionAppGrid.vue')
assert.match(productionSource, /openProductionFlowTarget\([^)]*'生产检验',\s*'质量'\)/)
assert.match(productionSource, /openProductionFlowTarget\([^)]*'生产入库',\s*'仓储'\)/)
assert.match(productionSource, /openProductionFlowTarget\([^)]*'生产领料',\s*'仓储'\)/)

const materialDisabledConfig = {
  ...DEFAULT_ENTERPRISE_CONFIG,
  modules: { ...DEFAULT_ENTERPRISE_CONFIG.modules, materials: false }
}
const blockedMaterial = planEnterpriseNavigation(
  '/materials/inventory-stock-in?ioType=生产入库',
  materialDisabledConfig
)
assert.equal(blockedMaterial.ok, false)
assert.equal(blockedMaterial.reason, 'module-disabled')
assert.equal(blockedMaterial.moduleId, 'materials')
assert.deepEqual(blockedMaterial.query, { ioType: '生产入库' })

const qualityTarget = planEnterpriseNavigation('/quality/app/production_inspections')
assert.equal(qualityTarget.ok, true)
assert.equal(qualityTarget.moduleId, 'quality')

const decisionPackage = JSON.parse(readSource('eiscore-decision/package.json'))
assert.equal(decisionPackage.dependencies['@eiscore/platform'], 'file:../packages/eiscore-platform')
const decisionLock = JSON.parse(readSource('eiscore-decision/package-lock.json'))
assert.equal(decisionLock.packages['node_modules/@eiscore/platform'].link, true)

console.log('PASS: five cross-module consumers use enterprise navigation (7 full-page redirects removed)')
