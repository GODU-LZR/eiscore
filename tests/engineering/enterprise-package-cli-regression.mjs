// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 林志荣

import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import {
  EnterprisePackageError,
  computeEnterprisePackageSha256,
  generateEnterprisePackageManifest,
  validateEnterprisePackage
} from '../../scripts/enterprise-package.mjs'

const repoRoot = resolve(import.meta.dirname, '../..')
const exampleRoot = resolve(repoRoot, 'enterprise-packs/example')
const tempRoot = mkdtempSync(resolve(tmpdir(), 'eiscore-enterprise-package-'))
const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'))
const writeJson = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
const issueCodes = (result) => result.issues.map((entry) => entry.code)
const expectGenerateIssue = (packRoot, code) => assert.throws(
  () => generateEnterprisePackageManifest({ packRoot, write: false }),
  (error) => error instanceof EnterprisePackageError && error.issues.some((entry) => entry.code === code)
)
const createPack = (name) => {
  const target = resolve(tempRoot, name)
  cpSync(exampleRoot, target, { recursive: true })
  return target
}
const rewriteManifestDigest = (packRoot, mutate) => {
  const path = resolve(packRoot, 'manifest.json')
  const manifest = readJson(path)
  mutate(manifest)
  manifest.packageSha256 = computeEnterprisePackageSha256(manifest)
  writeJson(path, manifest)
}

try {
  const clean = createPack('clean')
  const first = generateEnterprisePackageManifest({ packRoot: clean, write: false })
  const second = generateEnterprisePackageManifest({ packRoot: clean, write: false })
  assert.deepEqual(first, second, 'manifest generation must be deterministic')
  assert.equal(first.packageSha256, computeEnterprisePackageSha256(first))
  assert.equal(validateEnterprisePackage({ packRoot: clean }).ok, true)
  assert.ok(issueCodes(validateEnterprisePackage({ packRoot: clean, production: true })).includes('production-package-must-be-approved'))

  const unknown = createPack('unknown')
  writeFileSync(resolve(unknown, 'unexpected.txt'), 'unexpected payload\n', 'utf8')
  expectGenerateIssue(unknown, 'unknown-payload-file')

  const unknownManifestField = createPack('unknown-manifest-field')
  rewriteManifestDigest(unknownManifestField, (manifest) => { manifest.customerBranch = 'forbidden' })
  expectGenerateIssue(unknownManifestField, 'unknown-key')

  const unknownSeedField = createPack('unknown-seed-field')
  const unknownSeedPath = resolve(unknownSeedField, 'data/company-site.json')
  const unknownSeed = readJson(unknownSeedPath)
  unknownSeed.publishImmediately = true
  writeJson(unknownSeedPath, unknownSeed)
  expectGenerateIssue(unknownSeedField, 'unknown-key')

  const sql = createPack('sql')
  mkdirSync(resolve(sql, 'data'), { recursive: true })
  writeFileSync(resolve(sql, 'data/tenant.sql'), 'CREATE TABLE forbidden_customer_table (id integer);\n', 'utf8')
  expectGenerateIssue(sql, 'database-code-file-forbidden')

  const customerCode = createPack('customer-code')
  mkdirSync(resolve(customerCode, 'assets'), { recursive: true })
  writeFileSync(resolve(customerCode, 'assets/customer-override.js'), 'export const customerOverride = true\n', 'utf8')
  expectGenerateIssue(customerCode, 'customer-code-file-forbidden')

  const duplicate = createPack('duplicate')
  rewriteManifestDigest(duplicate, (manifest) => manifest.files.push(structuredClone(manifest.files[0])))
  assert.ok(issueCodes(validateEnterprisePackage({ packRoot: duplicate })).includes('duplicate-path'))

  const unsorted = createPack('unsorted')
  rewriteManifestDigest(unsorted, (manifest) => manifest.files.reverse())
  assert.ok(issueCodes(validateEnterprisePackage({ packRoot: unsorted })).includes('file-list-not-sorted'))

  const traversal = createPack('traversal')
  rewriteManifestDigest(traversal, (manifest) => { manifest.files[0].path = '../outside.json' })
  assert.ok(issueCodes(validateEnterprisePackage({ packRoot: traversal })).includes('unsafe-path'))

  const drift = createPack('drift')
  writeFileSync(resolve(drift, 'data/company-site.json'), '\n', { flag: 'a' })
  const driftCodes = issueCodes(validateEnterprisePackage({ packRoot: drift }))
  assert.ok(driftCodes.includes('file-byte-drift'))
  assert.ok(driftCodes.includes('file-hash-drift'))

  const packageDrift = createPack('package-drift')
  const packageDriftManifestPath = resolve(packageDrift, 'manifest.json')
  const packageDriftManifest = readJson(packageDriftManifestPath)
  packageDriftManifest.packageSha256 = '0'.repeat(64)
  writeJson(packageDriftManifestPath, packageDriftManifest)
  assert.ok(issueCodes(validateEnterprisePackage({ packRoot: packageDrift })).includes('package-hash-drift'))

  const mismatch = createPack('mismatch')
  const mismatchRuntimePath = resolve(mismatch, 'runtime/eiscore-enterprise.json')
  const mismatchRuntime = readJson(mismatchRuntimePath)
  mismatchRuntime.enterprise.id = 'different-enterprise'
  writeJson(mismatchRuntimePath, mismatchRuntime)
  expectGenerateIssue(mismatch, 'enterprise-id-mismatch')

  const dependency = createPack('dependency')
  const dependencyRuntimePath = resolve(dependency, 'runtime/eiscore-enterprise.json')
  const dependencyRuntime = readJson(dependencyRuntimePath)
  dependencyRuntime.modules.apps = false
  writeJson(dependencyRuntimePath, dependencyRuntime)
  expectGenerateIssue(dependency, 'runtime-module-dependency-disabled:apps')

  const secret = createPack('secret')
  const secretSeedPath = resolve(secret, 'data/company-site.json')
  const secretSeed = readJson(secretSeedPath)
  secretSeed.site.settings = { api_key: 'redacted-placeholder' }
  writeJson(secretSeedPath, secretSeed)
  expectGenerateIssue(secret, 'secret-key-forbidden')

  const ddl = createPack('ddl')
  const ddlSeedPath = resolve(ddl, 'data/company-site.json')
  const ddlSeed = readJson(ddlSeedPath)
  ddlSeed.site.settings = { migration: 'CREATE FUNCTION customer_override()' }
  writeJson(ddlSeedPath, ddlSeed)
  expectGenerateIssue(ddl, 'database-code-forbidden')

  const databaseCode = createPack('database-code')
  const databaseCodeSeedPath = resolve(databaseCode, 'data/company-site.json')
  const databaseCodeSeed = readJson(databaseCodeSeedPath)
  databaseCodeSeed.site.settings = { authorization: 'GRANT SELECT ON company_site.site_config TO customer_role' }
  writeJson(databaseCodeSeedPath, databaseCodeSeed)
  assert.throws(
    () => generateEnterprisePackageManifest({ packRoot: databaseCode, write: false }),
    (error) => error instanceof EnterprisePackageError &&
      error.issues.some((entry) => entry.code === 'secret-key-forbidden') &&
      error.issues.some((entry) => entry.code === 'database-code-forbidden')
  )

  const embeddedValues = createPack('embedded-values')
  const embeddedValuesSeedPath = resolve(embeddedValues, 'data/company-site.json')
  const embeddedValuesSeed = readJson(embeddedValuesSeedPath)
  embeddedValuesSeed.site.settings = {
    accessToken: 'redacted',
    connection: ['postgresql', '://example-user:', 'example-password', '@db.example.com/example'].join(''),
    localSource: ['C:', '\\', 'customer', '\\', 'source.json'].join(''),
    embeddedImage: ['data:image/svg+xml;base64', 'PHN2Zy8+'].join(',')
  }
  writeJson(embeddedValuesSeedPath, embeddedValuesSeed)
  assert.throws(
    () => generateEnterprisePackageManifest({ packRoot: embeddedValues, write: false }),
    (error) => {
      const codes = error instanceof EnterprisePackageError ? issueCodes({ issues: error.issues }) : []
      return [
        'secret-key-forbidden',
        'credential-url-forbidden',
        'local-path-forbidden',
        'data-url-forbidden'
      ].every((code) => codes.includes(code))
    }
  )

  const malformedManifest = createPack('malformed-manifest')
  rewriteManifestDigest(malformedManifest, (manifest) => { manifest.enterprise = null })
  const malformedResult = validateEnterprisePackage({ packRoot: malformedManifest })
  assert.equal(malformedResult.ok, false)
  assert.ok(issueCodes(malformedResult).includes('object-required'))

  const missingAsset = createPack('missing-asset')
  const missingAssetSeedPath = resolve(missingAsset, 'data/company-site.json')
  const missingAssetSeed = readJson(missingAssetSeedPath)
  missingAssetSeed.site.trademark.logoAssetPath = 'assets/logo.svg'
  writeJson(missingAssetSeedPath, missingAssetSeed)
  expectGenerateIssue(missingAsset, 'missing-asset')

  const published = createPack('published-seed')
  const publishedSeedPath = resolve(published, 'data/company-site.json')
  const publishedSeed = readJson(publishedSeedPath)
  publishedSeed.content.pages.push({ slug: 'about', status: 'published' })
  writeJson(publishedSeedPath, publishedSeed)
  expectGenerateIssue(published, 'seed-content-must-be-draft')

  const pendingApproval = createPack('pending-approval')
  rewriteManifestDigest(pendingApproval, (manifest) => {
    manifest.status = 'approved'
    manifest.governance.factStatus = 'confirmed'
    manifest.governance.assetStatus = 'pending'
    manifest.governance.productionApproved = true
    manifest.governance.confirmedBy = 'authorized-reviewer'
    manifest.governance.confirmedAt = '2026-09-04T00:00:00+08:00'
  })
  expectGenerateIssue(pendingApproval, 'approved-assets-cannot-be-pending')

  const externalProductionAsset = createPack('external-production-asset')
  const externalRuntimePath = resolve(externalProductionAsset, 'runtime/eiscore-enterprise.json')
  const externalRuntime = readJson(externalRuntimePath)
  externalRuntime.branding.logoUrl = 'https://cdn.example.com/temporary-logo.svg'
  writeJson(externalRuntimePath, externalRuntime)
  rewriteManifestDigest(externalProductionAsset, (manifest) => {
    manifest.status = 'approved'
    manifest.governance.factStatus = 'confirmed'
    manifest.governance.productionApproved = true
    manifest.governance.confirmedBy = 'authorized-reviewer'
    manifest.governance.confirmedAt = '2026-09-04T00:00:00+08:00'
  })
  const externalSeedPath = resolve(externalProductionAsset, 'data/company-site.json')
  const externalSeed = readJson(externalSeedPath)
  externalSeed.governance.factStatus = 'confirmed'
  writeJson(externalSeedPath, externalSeed)
  expectGenerateIssue(externalProductionAsset, 'production-external-asset-forbidden')

  const production = createPack('production')
  rewriteManifestDigest(production, (manifest) => {
    manifest.status = 'approved'
    manifest.governance.factStatus = 'confirmed'
    manifest.governance.productionApproved = true
    manifest.governance.confirmedBy = 'authorized-reviewer'
    manifest.governance.confirmedAt = '2026-09-04T00:00:00+08:00'
  })
  const productionSeedPath = resolve(production, 'data/company-site.json')
  const productionSeed = readJson(productionSeedPath)
  productionSeed.governance.factStatus = 'confirmed'
  writeJson(productionSeedPath, productionSeed)
  generateEnterprisePackageManifest({ packRoot: production })
  assert.equal(validateEnterprisePackage({ packRoot: production, production: true }).ok, true)

  console.log('PASS: deterministic enterprise package generation and fail-closed validation')
} finally {
  rmSync(tempRoot, { recursive: true, force: true })
}
