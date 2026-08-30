// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import {
  DEFAULT_ENTERPRISE_CONFIG,
  ENTERPRISE_MODULE_DEPENDENCIES,
  ENTERPRISE_MODULE_IDS,
  parseEnterpriseConfig,
  validateEnterpriseConfig
} from '../../packages/eiscore-platform/src/enterprise-config.mjs'

assert.deepEqual(Object.keys(ENTERPRISE_MODULE_DEPENDENCIES), ENTERPRISE_MODULE_IDS)
const visited = new Set()
const visiting = new Set()
const visit = (moduleId) => {
  assert.ok(!visiting.has(moduleId), `enterprise module dependency cycle detected at ${moduleId}`)
  if (visited.has(moduleId)) return
  visiting.add(moduleId)
  for (const dependency of ENTERPRISE_MODULE_DEPENDENCIES[moduleId]) visit(dependency)
  visiting.delete(moduleId)
  visited.add(moduleId)
}
for (const moduleId of ENTERPRISE_MODULE_IDS) visit(moduleId)

for (const [moduleId, dependencies] of Object.entries(ENTERPRISE_MODULE_DEPENDENCIES)) {
  assert.ok(Object.isFrozen(dependencies), `${moduleId} dependencies must be read-only`)
  assert.equal(new Set(dependencies).size, dependencies.length, `${moduleId} dependencies must be unique`)
  for (const dependency of dependencies) {
    assert.ok(ENTERPRISE_MODULE_IDS.includes(dependency), `${moduleId} has unknown dependency ${dependency}`)
    assert.notEqual(dependency, moduleId, `${moduleId} must not depend on itself`)

    const invalid = JSON.parse(JSON.stringify(DEFAULT_ENTERPRISE_CONFIG))
    invalid.enterprise.id = `missing-${dependency}-for-${moduleId}`
    invalid.modules[dependency] = false
    const issues = validateEnterpriseConfig(invalid)
    assert.ok(
      issues.some((issue) => (
        issue.path === `$.modules.${moduleId}` && issue.code === `module-dependency-disabled:${dependency}`
      )),
      `${moduleId} should reject missing ${dependency}`
    )

    invalid.modules[moduleId] = false
    const ownDependencyIssue = validateEnterpriseConfig(invalid).find((issue) => (
      issue.path === `$.modules.${moduleId}` && issue.code === `module-dependency-disabled:${dependency}`
    ))
    assert.equal(ownDependencyIssue, undefined, `disabled ${moduleId} should not require ${dependency}`)
  }
}

assert.doesNotThrow(() => parseEnterpriseConfig(DEFAULT_ENTERPRISE_CONFIG, { source: 'dependency baseline' }))

console.log(`PASS: enterprise module dependencies (${ENTERPRISE_MODULE_IDS.length} modules)`)
