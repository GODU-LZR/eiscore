// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import {
  DEFAULT_ENTERPRISE_CONFIG,
  ENTERPRISE_MODULE_IDS,
  enterpriseModuleForPath,
  isEnterpriseModuleEnabled,
  parseEnterpriseConfig
} from '../../packages/eiscore-platform/src/enterprise-config.mjs'
import {
  isEnterprisePathEnabled,
  resolveEnterpriseNavigation
} from '../../eiscore-base/src/platform/enterprise-routing.js'

for (const moduleId of ENTERPRISE_MODULE_IDS) {
  assert.equal(enterpriseModuleForPath(`/${moduleId}`), moduleId)
  assert.equal(enterpriseModuleForPath(`/${moduleId}/detail/1?source=test`), moduleId)
  assert.equal(isEnterpriseModuleEnabled(DEFAULT_ENTERPRISE_CONFIG, moduleId), true)
  assert.equal(resolveEnterpriseNavigation({
    path: `/${moduleId}/detail/1`,
    enterpriseConfig: DEFAULT_ENTERPRISE_CONFIG
  }).type, 'allow')
}
assert.equal(enterpriseModuleForPath('/settings'), '')
assert.equal(enterpriseModuleForPath('/materials-old'), '')
assert.equal(isEnterpriseModuleEnabled(DEFAULT_ENTERPRISE_CONFIG, 'unknown'), false)

const configured = JSON.parse(JSON.stringify(DEFAULT_ENTERPRISE_CONFIG))
configured.enterprise.id = 'routing-test'
configured.modules.quality = false
configured.modules.mobile = false
configured.modules.production = false
configured.modules.decision = false
const restricted = parseEnterpriseConfig(configured, { source: 'routing test' })

assert.deepEqual(
  resolveEnterpriseNavigation({ path: '/quality/dashboard', enterpriseConfig: restricted }),
  { type: 'redirect', path: '/', reason: 'module-disabled', moduleId: 'quality' }
)
assert.equal(isEnterprisePathEnabled('/quality/dashboard', restricted), false)
assert.equal(isEnterprisePathEnabled('/settings', restricted), true)
assert.equal(resolveEnterpriseNavigation({
  path: '/materials',
  enterpriseConfig: restricted,
  mobileDevice: true
}).type, 'allow')
assert.deepEqual(
  resolveEnterpriseNavigation({
    path: '/materials',
    enterpriseConfig: DEFAULT_ENTERPRISE_CONFIG,
    mobileDevice: true
  }),
  { type: 'external', path: '/mobile/', reason: 'mobile-device', moduleId: 'mobile' }
)
assert.equal(resolveEnterpriseNavigation({
  path: '/eiscore',
  enterpriseConfig: DEFAULT_ENTERPRISE_CONFIG,
  mobileDevice: true,
  publicLanding: true
}).type, 'allow')
assert.equal(resolveEnterpriseNavigation({
  path: '/materials',
  enterpriseConfig: DEFAULT_ENTERPRISE_CONFIG,
  mobileDevice: true,
  skipMobileRedirect: true
}).type, 'allow')

console.log(`PASS: enterprise module routing (${ENTERPRISE_MODULE_IDS.length} modules)`)
