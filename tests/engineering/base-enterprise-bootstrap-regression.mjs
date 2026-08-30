// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DEFAULT_ENTERPRISE_CONFIG, EnterpriseConfigError } from '../../packages/eiscore-platform/src/enterprise-config.mjs'
import {
  ENTERPRISE_CONFIG_GLOBAL,
  bootstrapEnterpriseConfig,
  renderEnterpriseConfigFailure
} from '../../eiscore-base/src/platform/enterprise-config.js'
import { createMicroApps } from '../../eiscore-base/src/micro/apps.js'

const repoRoot = resolve(import.meta.dirname, '../..')
const example = JSON.parse(readFileSync(resolve(repoRoot, 'config/enterprise.example.json'), 'utf8'))

const allApps = createMicroApps(DEFAULT_ENTERPRISE_CONFIG)
assert.deepEqual(
  allApps.map((app) => app.name),
  [
    'eiscore-hr',
    'eiscore-materials',
    'eiscore-sales',
    'eiscore-purchase',
    'eiscore-production',
    'eiscore-quality',
    'eiscore-equipment',
    'eiscore-decision',
    'eiscore-apps'
  ],
  'the default enterprise profile must preserve all existing qiankun registrations'
)

const configured = structuredClone(example)
configured.modules.quality = false
configured.modules.decision = false
configured.modules.production = false
const runtimeTarget = {}
const enterpriseConfig = await bootstrapEnterpriseConfig({
  isProduction: true,
  runtimeTarget,
  fetchImpl: async () => ({ ok: true, status: 200, json: async () => configured })
})
const descriptor = Object.getOwnPropertyDescriptor(runtimeTarget, ENTERPRISE_CONFIG_GLOBAL)
assert.equal(descriptor.writable, false)
assert.equal(descriptor.configurable, false)
assert.equal(runtimeTarget[ENTERPRISE_CONFIG_GLOBAL], enterpriseConfig)

const filteredApps = createMicroApps(enterpriseConfig)
assert.deepEqual(
  filteredApps.map((app) => app.name),
  allApps.map((app) => app.name).filter((name) => ![
    'eiscore-production',
    'eiscore-quality',
    'eiscore-decision'
  ].includes(name))
)
assert.ok(filteredApps.every((app) => app.props.enterpriseConfig === enterpriseConfig))

await assert.rejects(
  bootstrapEnterpriseConfig({
    isProduction: true,
    runtimeTarget: {},
    fetchImpl: async () => ({ ok: false, status: 404 })
  }),
  EnterpriseConfigError
)

const warnings = []
const developmentTarget = {}
const developmentConfig = await bootstrapEnterpriseConfig({
  isProduction: false,
  runtimeTarget: developmentTarget,
  fetchImpl: async () => ({
    ok: true,
    status: 200,
    json: async () => { throw new SyntaxError('HTML fallback') }
  }),
  onWarning: (warning) => warnings.push(warning.code)
})
assert.equal(developmentConfig, DEFAULT_ENTERPRISE_CONFIG)
assert.deepEqual(warnings, ['invalid-json'])

const root = {
  textContent: '',
  setAttribute(name, value) { this[name] = value }
}
assert.equal(renderEnterpriseConfigFailure({ querySelector: () => root }), true)
assert.equal(root.textContent, '系统配置加载失败，请联系管理员。')
assert.equal(root['data-eiscore-bootstrap'], 'config-error')

console.log(`PASS: base enterprise bootstrap (${allApps.length} default micro apps)`)
