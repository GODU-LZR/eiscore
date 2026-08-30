// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_ENTERPRISE_CONFIG,
  ENTERPRISE_MODULE_IDS,
  EnterpriseConfigError,
  loadEnterpriseConfig,
  parseEnterpriseConfig,
  validateEnterpriseConfig
} from '../../packages/eiscore-platform/src/enterprise-config.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const example = JSON.parse(readFileSync(resolve(repoRoot, 'config/enterprise.example.json'), 'utf8'))
const schema = JSON.parse(readFileSync(resolve(repoRoot, 'config/enterprise.schema.json'), 'utf8'))
const parsed = parseEnterpriseConfig(example, { source: 'test example' })

assert.equal(schema.properties.schemaVersion.const, 1)
assert.deepEqual(Object.keys(schema.properties.modules.properties).sort(), [...ENTERPRISE_MODULE_IDS].sort())
assert.equal(parsed.schemaVersion, 1)
assert.equal(parsed.enterprise.id, 'example-manufacturer')
assert.equal(Object.keys(parsed.modules).length, ENTERPRISE_MODULE_IDS.length)
assert.equal(parsed.endpoints.publicBaseUrl, 'https://erp.example.com')
assert.ok(Object.isFrozen(parsed))
assert.ok(Object.isFrozen(parsed.branding.login))
assert.throws(() => { parsed.modules.hr = false }, TypeError)

const disabledModule = structuredClone(example)
disabledModule.modules.decision = false
assert.equal(parseEnterpriseConfig(disabledModule).modules.decision, false)

const unsafe = structuredClone(example)
unsafe.endpoints.publicBaseUrl = 'http://insecure.example.com'
unsafe.endpoints.apiToken = 'do-not-print-this-value'
const unsafeIssues = validateEnterpriseConfig(unsafe)
assert.ok(unsafeIssues.some((issue) => issue.code === 'unsafe-url'))
assert.ok(unsafeIssues.some((issue) => issue.code === 'secret-key-forbidden'))
assert.throws(
  () => parseEnterpriseConfig(unsafe, { source: 'unsafe test' }),
  (error) => error instanceof EnterpriseConfigError && !error.message.includes('do-not-print-this-value')
)

let fetched = false
const fromGlobal = await loadEnterpriseConfig({
  globalConfig: disabledModule,
  fetchImpl: async () => {
    fetched = true
    throw new Error('should not fetch')
  }
})
assert.equal(fromGlobal.modules.decision, false)
assert.equal(fetched, false)

const warnings = []
const optionalMissing = await loadEnterpriseConfig({
  globalConfig: null,
  fetchImpl: async () => ({ ok: false, status: 404 }),
  onWarning: (warning) => warnings.push(warning)
})
assert.equal(optionalMissing, DEFAULT_ENTERPRISE_CONFIG)
assert.deepEqual(warnings.map((warning) => warning.code), ['config-missing'])

await assert.rejects(
  loadEnterpriseConfig({
    globalConfig: null,
    required: true,
    fetchImpl: async () => { throw new Error('network unavailable') }
  }),
  (error) => error instanceof EnterpriseConfigError && error.issues[0]?.code === 'fetch-failed'
)

const loaded = await loadEnterpriseConfig({
  globalConfig: null,
  required: true,
  fetchImpl: async () => ({ ok: true, status: 200, json: async () => example })
})
assert.equal(loaded.enterprise.displayName, example.enterprise.displayName)

const invalidJsonWarnings = []
const invalidJsonFallback = await loadEnterpriseConfig({
  globalConfig: null,
  fetchImpl: async () => ({
    ok: true,
    status: 200,
    json: async () => { throw new SyntaxError('HTML response') }
  }),
  onWarning: (warning) => invalidJsonWarnings.push(warning.code)
})
assert.equal(invalidJsonFallback, DEFAULT_ENTERPRISE_CONFIG)
assert.deepEqual(invalidJsonWarnings, ['invalid-json'])

console.log(`PASS: enterprise configuration contract (${ENTERPRISE_MODULE_IDS.length} modules)`)
