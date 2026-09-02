// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { DEFAULT_ENTERPRISE_CONFIG } from '../../packages/eiscore-platform/src/enterprise-config.mjs'
import {
  ENTERPRISE_NAVIGATION_EVENT,
  navigateExternalHttps,
  navigateEnterprisePath,
  planEnterpriseNavigation
} from '../../packages/eiscore-platform/src/navigation.mjs'

const internal = planEnterpriseNavigation('/sales/app/shipment_requests', DEFAULT_ENTERPRISE_CONFIG)
assert.deepEqual(internal, {
  ok: true,
  reason: '',
  moduleId: 'sales',
  path: '/sales/app/shipment_requests',
  query: {},
  href: '/sales/app/shipment_requests'
})

const withQuery = planEnterpriseNavigation(
  '/materials/inventory-stock-out?ioType=销售出库',
  DEFAULT_ENTERPRISE_CONFIG
)
assert.equal(withQuery.ok, true)
assert.equal(withQuery.moduleId, 'materials')
assert.deepEqual(withQuery.query, { ioType: '销售出库' })

for (const target of [
  'https://attacker.invalid/purchase/app/demands',
  '//attacker.invalid/purchase/app/demands',
  'javascript:alert(1)',
  '/purchase\\app\\demands',
  '/purchase/app/demands#unexpected'
]) {
  assert.deepEqual(planEnterpriseNavigation(target, DEFAULT_ENTERPRISE_CONFIG), {
    ok: false,
    reason: 'invalid-target',
    moduleId: '',
    path: '',
    query: {},
    href: ''
  })
}

const restricted = structuredClone(DEFAULT_ENTERPRISE_CONFIG)
restricted.modules.purchase = false
restricted.modules.materials = false
assert.deepEqual(
  planEnterpriseNavigation('/purchase/app/demands', restricted),
  {
    ok: false,
    reason: 'module-disabled',
    moduleId: 'purchase',
    path: '/purchase/app/demands',
    query: {},
    href: '/purchase/app/demands'
  }
)
assert.equal(
  planEnterpriseNavigation('/materials/inventory-stock-out', restricted).reason,
  'module-disabled'
)

class FakeCustomEvent {
  constructor(type, init) {
    this.type = type
    this.detail = init?.detail
  }
}

const dispatched = []
const hostRuntime = {
  CustomEvent: FakeCustomEvent,
  dispatchEvent(event) {
    dispatched.push(event)
    return true
  }
}
const hostedResult = navigateEnterprisePath('/materials/inventory-stock-out?ioType=销售出库', {
  enterpriseConfig: DEFAULT_ENTERPRISE_CONFIG,
  runtimeTarget: hostRuntime,
  hosted: true,
  tabKey: 'sales-outbound',
  tabTitle: '销售出库'
})
assert.equal(hostedResult.ok, true)
assert.equal(hostedResult.mode, 'host-event')
assert.equal(dispatched.length, 1)
assert.equal(dispatched[0].type, ENTERPRISE_NAVIGATION_EVENT)
assert.deepEqual(dispatched[0].detail, {
  path: '/materials/inventory-stock-out',
  query: { ioType: '销售出库' },
  tabKey: 'sales-outbound',
  tabTitle: '销售出库'
})

const assigned = []
const standaloneResult = navigateEnterprisePath('/purchase/app/demands', {
  enterpriseConfig: DEFAULT_ENTERPRISE_CONFIG,
  runtimeTarget: { location: { assign: (href) => assigned.push(href) } },
  hosted: false
})
assert.equal(standaloneResult.ok, true)
assert.equal(standaloneResult.mode, 'location-assign')
assert.deepEqual(assigned, ['/purchase/app/demands'])

let blockedSideEffect = false
const blockedResult = navigateEnterprisePath('/purchase/app/demands', {
  enterpriseConfig: restricted,
  runtimeTarget: {
    location: { assign: () => { blockedSideEffect = true } },
    CustomEvent: FakeCustomEvent,
    dispatchEvent: () => { blockedSideEffect = true }
  },
  hosted: false
})
assert.equal(blockedResult.ok, false)
assert.equal(blockedResult.reason, 'module-disabled')
assert.equal(blockedSideEffect, false)

const externalAssignments = []
assert.equal(navigateExternalHttps('https://admin.example.test/auth/handoff?handoff=opaque', {
  locationTarget: { assign: (href) => externalAssignments.push(href) }
}).ok, true)
assert.deepEqual(externalAssignments, ['https://admin.example.test/auth/handoff?handoff=opaque'])
for (const unsafeTarget of ['http://admin.example.test/auth/handoff', 'javascript:alert(1)', 'https://user:pass@admin.example.test/']) {
  assert.equal(navigateExternalHttps(unsafeTarget, { locationTarget: { assign: () => { blockedSideEffect = true } } }).ok, false)
}

console.log('PASS: enterprise navigation contract')
