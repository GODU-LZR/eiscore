// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_ENTERPRISE_CONFIG,
  ENTERPRISE_CONFIG_SCHEMA_VERSION,
  ENTERPRISE_CONFIG_SUPPORTED_SCHEMA_VERSIONS,
  ENTERPRISE_MODULE_IDS,
  EnterpriseConfigError,
  loadEnterpriseConfig,
  parseEnterpriseConfig,
  validateEnterpriseConfig
} from '../../packages/eiscore-platform/src/enterprise-config.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const example = JSON.parse(readFileSync(resolve(repoRoot, 'config/enterprise.example.json'), 'utf8'))
const schema = JSON.parse(readFileSync(resolve(repoRoot, 'config/enterprise.schema.json'), 'utf8'))
const v2Example = JSON.parse(readFileSync(resolve(repoRoot, 'config/enterprise.v2.example.json'), 'utf8'))
const v2Schema = JSON.parse(readFileSync(resolve(repoRoot, 'config/enterprise.v2.schema.json'), 'utf8'))
const parsed = parseEnterpriseConfig(example, { source: 'test example' })
const parsedV2 = parseEnterpriseConfig(v2Example, { source: 'test v2 example' })

assert.equal(schema.properties.schemaVersion.const, 1)
assert.equal(v2Schema.properties.schemaVersion.const, 2)
assert.equal(ENTERPRISE_CONFIG_SCHEMA_VERSION, 2)
assert.deepEqual(ENTERPRISE_CONFIG_SUPPORTED_SCHEMA_VERSIONS, [1, 2])
assert.deepEqual(Object.keys(schema.properties.modules.properties).sort(), [...ENTERPRISE_MODULE_IDS].sort())
assert.deepEqual(Object.keys(v2Schema.properties.modules.properties).sort(), [...ENTERPRISE_MODULE_IDS].sort())
assert.equal(parsed.schemaVersion, 1)
assert.equal(parsedV2.schemaVersion, 2)
assert.equal('login' in parsedV2.branding, false)
assert.equal(parsed.enterprise.id, 'example-manufacturer')
assert.equal(Object.keys(parsed.modules).length, ENTERPRISE_MODULE_IDS.length)
assert.equal(parsed.endpoints.publicBaseUrl, 'https://erp.example.com')
assert.ok(Object.isFrozen(parsed))
assert.ok(Object.isFrozen(parsed.branding.login))
assert.ok(Object.isFrozen(parsedV2.branding))
assert.throws(() => { parsed.modules.hr = false }, TypeError)

assert.equal(schema.$defs.loginFields.properties.aboutImage.maxLength, 500)
assert.equal(schema.$defs.loginFields.properties.aboutImageAlt.maxLength, 200)
assert.equal(schema.$defs.loginFields.properties.overviewProductImage.maxLength, 500)
assert.equal(schema.$defs.loginFields.properties.overviewProductImageAlt.maxLength, 200)
assert.equal(schema.$defs.loginFields.properties.overviewFactoryImage.maxLength, 500)
assert.equal(schema.$defs.loginFields.properties.overviewFactoryImageAlt.maxLength, 200)
for (const aboutImage of ['', '/company-assets/about.png', 'https://example.test/about.png']) {
  const aboutConfig = structuredClone(example)
  aboutConfig.branding.login.aboutImage = aboutImage
  aboutConfig.branding.login.aboutImageAlt = '  Company service map  '
  const parsedAboutConfig = parseEnterpriseConfig(aboutConfig)
  assert.equal(parsedAboutConfig.branding.login.aboutImage, aboutImage)
  assert.equal(parsedAboutConfig.branding.login.aboutImageAlt, 'Company service map')
}
for (const aboutImage of ['javascript:alert(1)', 'data:image/png;base64,AA==', '//example.test/about.png']) {
  const unsafeAboutConfig = structuredClone(example)
  unsafeAboutConfig.branding.login.aboutImage = aboutImage
  assert.ok(validateEnterpriseConfig(unsafeAboutConfig).some((issue) => (
    issue.path === '$.branding.login.aboutImage' && issue.code === 'unsafe-url'
  )))
}
const longAboutAlt = structuredClone(example)
longAboutAlt.branding.login.aboutImageAlt = 'a'.repeat(201)
assert.ok(validateEnterpriseConfig(longAboutAlt).some((issue) => (
  issue.path === '$.branding.login.aboutImageAlt' && issue.code === 'text-too-long'
)))
for (const key of ['overviewProductImage', 'overviewFactoryImage']) {
  const invalidImage = structuredClone(example)
  invalidImage.branding.login[key] = 'javascript:alert(1)'
  assert.ok(validateEnterpriseConfig(invalidImage).some((issue) => (
    issue.path === `$.branding.login.${key}` && issue.code === 'unsafe-url'
  )))
}

const v2WithLegacyLogin = structuredClone(v2Example)
v2WithLegacyLogin.branding.login = { slogan: 'must remain in company_site.site_config' }
assert.ok(validateEnterpriseConfig(v2WithLegacyLogin).some((issue) => (
  issue.path === '$.branding.login' && issue.code === 'unknown-key'
)))

const unsupportedVersion = structuredClone(v2Example)
unsupportedVersion.schemaVersion = 3
assert.ok(validateEnterpriseConfig(unsupportedVersion).some((issue) => issue.code === 'unsupported-version'))

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
